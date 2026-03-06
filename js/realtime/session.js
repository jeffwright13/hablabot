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
//   1. POST /v1/realtime/sessions with API key → ephemeral token (60s TTL)
//   2. getUserMedia for mic
//   3. Create RTCPeerConnection, add mic track, create data channel for events
//   4. createOffer → setLocalDescription
//   5. POST /v1/realtime?model=... with SDP offer + ephemeral key → SDP answer
//   6. setRemoteDescription → WebRTC connected
//   7. Data channel opens → send session.update to configure VAD, instructions, etc.
//   8. Optionally send response.create to trigger opening greeting

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

    // --- Public callbacks ---
    // (status: 'connecting'|'active'|'idle'|'error') => {}
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
  async connect(apiKey, options = {}) {
    if (this.isConnected) return;

    this._autoGreet = options.autoGreet !== false;
    this._sessionConfigured = false;

    try {
      this._setStatus('connecting');

      // Step 1: Exchange API key for a short-lived ephemeral token.
      const tokenRes = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || 'gpt-4o-realtime-preview',
          voice: options.voice || 'alloy'
        })
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Session creation failed (${tokenRes.status})`);
      }

      const { client_secret } = await tokenRes.json();
      const ephemeralKey = client_secret.value;

      // Step 2: Open microphone.
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Step 3: Create peer connection.
      this.pc = new RTCPeerConnection();

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
        this._send({
          type: 'session.update',
          session: {
            modalities: ['audio', 'text'],
            instructions: options.instructions || 'You are a helpful assistant.',
            voice: options.voice || 'alloy',
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 1500
            }
          }
        });
        this.isConnected = true;
        this._setStatus('active');
      };

      this.dc.onmessage = (e) => {
        try {
          this._handleMessage(JSON.parse(e.data));
        } catch (err) {
          console.error('RealtimeSession: failed to parse message', err);
        }
      };

      this.dc.onclose = () => {
        this.isConnected = false;
        this._setStatus('idle');
      };

      this.dc.onerror = (e) => {
        console.error('RealtimeSession: data channel error', e);
        if (this.onError) this.onError('Data channel error.');
      };

      // Step 7: Create SDP offer.
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Step 8: Exchange SDP with OpenAI using the ephemeral key in a normal HTTP header.
      const model = options.model || 'gpt-4o-realtime-preview';
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
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

  // Cleanly shut down mic, audio output, data channel, and peer connection.
  disconnect() {
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
    this._setStatus('idle');
  }

  // --- Private ---

  _send(obj) {
    if (this.dc && this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(obj));
    }
  }

  _setStatus(status) {
    if (this.onStatusChange) this.onStatusChange(status);
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

      case 'input_audio_buffer.speech_started':
        if (this.onUserSpeechStart) this.onUserSpeechStart();
        break;

      case 'input_audio_buffer.speech_stopped':
        if (this.onUserSpeechEnd) this.onUserSpeechEnd();
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (msg.transcript && this.onUserTranscript) {
          this.onUserTranscript(msg.transcript.trim());
        }
        break;

      case 'response.audio_transcript.delta':
        // First delta means AI started speaking.
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          if (this.onAIAudioStart) this.onAIAudioStart();
        }
        this.aiTranscriptBuffer += (msg.delta || '');
        if (this.onAITranscript) this.onAITranscript(this.aiTranscriptBuffer, false);
        break;

      case 'response.audio_transcript.done':
        if (this.onAITranscript) this.onAITranscript(this.aiTranscriptBuffer, true);
        this.aiTranscriptBuffer = '';
        break;

      case 'response.done':
        // Full response (audio + transcript) complete.
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
