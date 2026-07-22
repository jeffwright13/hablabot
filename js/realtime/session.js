// HablaBot Realtime Session Manager
// Uses the OpenAI Realtime API via WebRTC — the correct browser-side transport.
//
// Why WebRTC instead of WebSocket:
//   The browser WebSocket API cannot send custom headers, so auth must go in
//   the subprotocol list. But RFC 6455 bans '=' in subprotocol names, and
//   Chrome enforces this. WebRTC's SDP exchange is a normal HTTPS POST, so
//   auth headers work fine. Audio is also simpler: mic goes in via addTrack(),
//   AI audio comes back as a remote MediaStream track played by an <audio> element.
//
// Flow:
//   1. POST /v1/realtime/client_secrets with API key + session config → ephemeral token
//   2. getUserMedia for mic
//   3. Create RTCPeerConnection, add mic track, create data channel for events
//   4. createOffer → setLocalDescription
//   5. POST /v1/realtime/calls with SDP offer + ephemeral key → SDP answer
//   6. setRemoteDescription → WebRTC connected
//   7. Data channel opens → send session.update to configure VAD, instructions, etc.
//   8. Optionally send response.create to trigger opening greeting
//
// NOTE (2026-07-22): OpenAI migrated the Realtime API's REST/session schema
// (endpoints, model name, and several server event names) since this file was
// first written. Updated against OpenAI's current docs — see docs/DECISIONS.md
// for exactly what changed and what's still best-effort (the transcription
// event's payload shape wasn't confirmed verbatim from docs).

class RealtimeSession {
  constructor() {
    this.pc = null;          // RTCPeerConnection
    this.dc = null;          // RTCDataChannel ('oai-events')
    this.audioEl = null;     // <audio> element for AI output
    this.mediaStream = null; // mic MediaStream

    this.isConnected = false;
    this.isSpeaking = false; // true while AI audio transcript is streaming

    // Accumulate streaming AI transcript deltas
    this.aiTranscriptBuffer = '';

    // Internal
    this._autoGreet = true;
    this._sessionConfigured = false;
    this._connectedAt = null; // timestamp for diagnosing session-length limits

    // Auto-reconnect: sessions appear to have a ~1 minute hard limit (56.6s
    // measured in manual testing, matching this file's own original "60s TTL"
    // comment on the ephemeral token) — rather than surface that to the user
    // as an error every ~minute, transparently start a new session a capped
    // number of times before actually giving up. Known limitation: each
    // reconnect is a genuinely new underlying Realtime session, so the model
    // has no memory of turns from before the reconnect, even though the
    // persona/instructions carry over identically.
    this._lastConnectArgs = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._reconnectDelayMs = 1000;

    // --- Public callbacks ---
    // (status: 'connecting'|'active'|'idle'|'error'|'reconnecting', meta?: { unexpected?: boolean }) => {}
    // meta.unexpected is true when 'idle' comes from the connection dropping on
    // its own (dc.onclose, auto-reconnect attempts exhausted) rather than a
    // deliberate disconnect() call — the UI should tell the user their session
    // died, not silently go quiet. 'reconnecting' fires for each transparent
    // auto-reconnect attempt in between.
    this.onStatusChange = null;
    // (text) => {}  — user's speech, fully transcribed by Whisper
    this.onUserTranscript = null;
    // () => {}  — server VAD detected user speech start
    this.onUserSpeechStart = null;
    // () => {}  — server VAD detected user speech end
    this.onUserSpeechEnd = null;
    // (text, isFinal) => {}  — AI transcript streaming then final
    this.onAITranscript = null;
    // () => {}  — AI started generating a response
    this.onAIAudioStart = null;
    // () => {}  — AI response fully complete
    this.onAIAudioEnd = null;
    // (message) => {}
    this.onError = null;
  }

  // Connect to the OpenAI Realtime API via WebRTC.
  // options: { model, voice, instructions, autoGreet }
  // _isReconnect is internal — used by the auto-reconnect path in dc.onclose;
  // callers should never pass it.
  async connect(apiKey, options = {}, _isReconnect = false) {
    if (this.isConnected) return;

    if (!_isReconnect) {
      // Remember these so an unexpected disconnect can transparently start a
      // fresh session with the same persona/config.
      this._lastConnectArgs = { apiKey, options };
      this._reconnectAttempts = 0;
    }

    // Never re-greet on a reconnect — the user is mid-conversation, not
    // starting a new one, even though the underlying session is technically new.
    this._autoGreet = _isReconnect ? false : (options.autoGreet !== false);
    this._sessionConfigured = false;

    try {
      this._setStatus(_isReconnect ? 'reconnecting' : 'connecting');

      // Step 1: Exchange API key for a short-lived ephemeral token.
      const tokenRes = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session: {
            type: 'realtime',
            model: options.model || 'gpt-realtime-2.1',
            audio: {
              output: { voice: options.voice || 'alloy' }
            }
          }
        })
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Session creation failed (${tokenRes.status})`);
      }

      const tokenData = await tokenRes.json();
      const ephemeralKey = tokenData.value;

      // Step 2: Open microphone. Explicit echoCancellation/noiseSuppression/
      // autoGainControl rather than relying on browser defaults — without it,
      // the AI's own playback can leak into the mic and trigger the server
      // VAD's barge-in, cutting the AI off mid-sentence. (Diagnostic pass —
      // see onconnectionstatechange below for whether this is actually what's
      // happening vs. a dropped connection.)
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      // Step 3: Create peer connection. A STUN server is required — without
      // one, ICE has only local/host candidates to work with, which can
      // connect briefly and then fail once renegotiation is needed (this was
      // missing since the original Realtime API migration, confirmed by
      // Firefox's own "ICE failed, add a STUN server" diagnostic during
      // manual testing).
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Diagnostic: log WebRTC connection state changes so a mid-response
      // audio cutoff can be attributed to a dropped connection (vs. a VAD
      // barge-in, vs. something server-side) instead of failing silently.
      this.pc.oniceconnectionstatechange = () => {
        console.log('RealtimeSession: ICE connection state ->', this.pc.iceConnectionState);
      };
      this.pc.onconnectionstatechange = () => {
        console.log('RealtimeSession: peer connection state ->', this.pc.connectionState);
      };

      // Step 4: Route incoming AI audio to an <audio> element.
      this.audioEl = document.createElement('audio');
      this.audioEl.autoplay = true;
      this.pc.ontrack = (e) => {
        if (e.streams && e.streams[0]) {
          this.audioEl.srcObject = e.streams[0];
        }
      };

      // Step 5: Add mic track so the API receives our audio.
      this.mediaStream.getTracks().forEach(track => this.pc.addTrack(track, this.mediaStream));

      // Step 6: Create data channel for sending/receiving API events.
      this.dc = this.pc.createDataChannel('oai-events');

      this.dc.onopen = () => {
        // Session is live — configure it.
        // `modalities` -> `output_modalities`; voice/turn_detection/transcription
        // moved under nested audio.output / audio.input (confirmed working for
        // voice and turn_detection — VAD events fire and audio plays correctly).
        //
        // input_audio_transcription: a flat top-level field was tried based on
        // a community report, and the live API rejected it outright —
        // "Unknown parameter: 'session.input_audio_transcription'" — so this
        // really is nested under audio.input like the rest. The nested shape
        // was never rejected; it just silently returned transcript: null with
        // model 'whisper-1'. Switched to 'gpt-realtime-whisper', which OpenAI's
        // dedicated transcription guide describes as "natively streaming and
        // designed for realtime sessions" (vs. whisper-1's older batch model) —
        // verify against a live session.
        this._send({
          type: 'session.update',
          session: {
            type: 'realtime',
            output_modalities: ['audio'],
            instructions: options.instructions || 'You are a helpful assistant.',
            audio: {
              input: {
                transcription: { model: 'gpt-realtime-whisper' },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1500
                }
              },
              output: {
                voice: options.voice || 'alloy'
              }
            }
          }
        });
        this.isConnected = true;
        this._connectedAt = Date.now();
        this._setStatus('active');
      };

      this.dc.onmessage = (e) => {
        try {
          this._handleMessage(JSON.parse(e.data));
        } catch (err) {
          console.error('RealtimeSession: failed to parse message', err);
        }
      };

      // Fires when the connection drops on its own (network issue, or a
      // session/token lifetime limit on OpenAI's side) — NOT when disconnect()
      // is called deliberately, which nulls this handler out first (see
      // disconnect() below). Distinguishing the two matters because the UI
      // should surface "your session ended unexpectedly" rather than silently
      // going quiet, which is what an unattributed 'idle' looked like to the
      // user during manual testing ("froze").
      //
      // Also drives auto-reconnect: sessions appear to have a ~1 minute cap,
      // so a drop here is expected to happen periodically, not necessarily a
      // real failure — retry transparently before surfacing anything.
      this.dc.onclose = () => {
        const wasConnected = !!this._connectedAt;
        if (wasConnected) {
          const seconds = ((Date.now() - this._connectedAt) / 1000).toFixed(1);
          console.warn(`RealtimeSession: connection closed unexpectedly after ${seconds}s connected`);
        }
        this._teardown();

        if (wasConnected && this._lastConnectArgs && this._reconnectAttempts < this._maxReconnectAttempts) {
          this._reconnectAttempts++;
          console.log(`RealtimeSession: auto-reconnecting (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`);
          setTimeout(() => {
            this.connect(this._lastConnectArgs.apiKey, this._lastConnectArgs.options, true)
              .catch(err => console.error('RealtimeSession: auto-reconnect failed', err));
          }, this._reconnectDelayMs);
        } else {
          if (wasConnected && this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.error('RealtimeSession: auto-reconnect attempts exhausted, giving up');
          }
          this._setStatus('idle', { unexpected: wasConnected });
        }
      };

      this.dc.onerror = (e) => {
        console.error('RealtimeSession: data channel error', e);
        if (this.onError) this.onError('Data channel error.');
      };

      // Step 7: Create SDP offer.
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Step 8: Exchange SDP with OpenAI using the ephemeral key in a normal HTTP header.
      // Endpoint moved from /v1/realtime?model=... to /v1/realtime/calls — model
      // is now specified in the client_secrets request instead of a query param.
      const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        }
      });

      if (!sdpRes.ok) {
        throw new Error(`SDP exchange failed (${sdpRes.status})`);
      }

      await this.pc.setRemoteDescription({
        type: 'answer',
        sdp: await sdpRes.text()
      });

    } catch (err) {
      console.error('RealtimeSession: connect failed', err);
      if (this.onError) this.onError(err.message);
      this._setStatus('error');
      this.disconnect();
      throw err;
    }
  }

  // Cleanly shut down mic, audio output, data channel, and peer connection —
  // deliberate, user-initiated disconnect. Clears _lastConnectArgs so a
  // subsequent unrelated dc.onclose (there shouldn't be one, since _teardown
  // nulls dc.onclose below, but just in case) can't trigger an unwanted
  // auto-reconnect after the user has already ended the conversation.
  disconnect() {
    this._lastConnectArgs = null;
    this._teardown();
    this._setStatus('idle');
  }

  // --- Private ---

  // Tears down mic, audio output, data channel, and peer connection without
  // touching _lastConnectArgs/_reconnectAttempts or emitting a status change —
  // shared by disconnect() (deliberate) and the auto-reconnect path in
  // dc.onclose (which decides the status/reconnect logic itself afterward).
  _teardown() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioEl) {
      this.audioEl.srcObject = null;
      this.audioEl = null;
    }
    if (this.dc) {
      this.dc.onclose = null;
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.isConnected = false;
    this.isSpeaking = false;
    this._connectedAt = null;
  }

  _send(obj) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(obj));
    }
  }

  _setStatus(status, meta = {}) {
    if (this.onStatusChange) this.onStatusChange(status, meta);
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'session.created':
        console.log('RealtimeSession: session created');
        break;

      case 'session.updated':
        console.log('RealtimeSession: session configured');
        // Trigger the opening greeting once, after the session is fully configured.
        if (this._autoGreet && !this._sessionConfigured) {
          this._sessionConfigured = true;
          this._send({ type: 'response.create' });
        }
        break;

      // Diagnostic: logged explicitly so a mid-response audio cutoff can be
      // checked against whether server VAD falsely detected the user
      // interrupting (e.g. the AI's own playback leaking into the mic).
      case 'input_audio_buffer.speech_started':
        console.log('RealtimeSession: VAD detected user speech start (possible barge-in if AI was talking)');
        if (this.onUserSpeechStart) this.onUserSpeechStart();
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('RealtimeSession: VAD detected user speech stop');
        if (this.onUserSpeechEnd) this.onUserSpeechEnd();
        break;

      // OpenAI renamed this event to 'conversation.item.done' as part of the
      // same migration; the exact payload shape wasn't confirmed verbatim from
      // docs, so this checks a couple of plausible locations for the
      // transcript and warns rather than silently dropping the user's turn.
      // Kept the old event name too in case it's still emitted for back-compat.
      case 'conversation.item.input_audio_transcription.completed':
      case 'conversation.item.done': {
        const transcript = msg.transcript
          || msg.item?.content?.find(c => c.transcript)?.transcript;
        if (transcript && this.onUserTranscript) {
          this.onUserTranscript(transcript.trim());
        } else if (msg.type === 'conversation.item.done') {
          console.warn('RealtimeSession: conversation.item.done had no recognizable transcript field', JSON.stringify(msg));
        }
        break;
      }

      case 'response.audio_transcript.delta':
      case 'response.output_audio_transcript.delta':
        // First delta means AI started speaking.
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          if (this.onAIAudioStart) this.onAIAudioStart();
        }
        this.aiTranscriptBuffer += (msg.delta || '');
        if (this.onAITranscript) this.onAITranscript(this.aiTranscriptBuffer, false);
        break;

      case 'response.audio_transcript.done':
      case 'response.output_audio_transcript.done':
        if (this.onAITranscript) this.onAITranscript(this.aiTranscriptBuffer, true);
        this.aiTranscriptBuffer = '';
        break;

      case 'response.done':
        // Full response (audio + transcript) complete. Logged with status —
        // OpenAI marks interrupted/incomplete responses (e.g. cut off by a
        // barge-in) differently from a naturally completed one, which
        // distinguishes "AI got interrupted" from "connection dropped."
        console.log('RealtimeSession: response.done, status =', msg.response?.status, JSON.stringify(msg.response?.status_details || {}));
        if (this.isSpeaking) {
          this.isSpeaking = false;
          if (this.onAIAudioEnd) this.onAIAudioEnd();
        }
        break;

      case 'error':
        console.error('RealtimeSession: API error', msg.error);
        if (this.onError) this.onError(msg.error?.message || 'Realtime API error');
        break;
    }
  }
}

window.HablaBotRealtimeSession = new RealtimeSession();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealtimeSession;
}
