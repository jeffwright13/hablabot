// The fake-OpenAI layer: lets the real app run a "conversation" in a real
// browser with no network, no key and no cost.
//
// - HTTP: page.route() answers the two api.openai.com calls session.js makes
//   (the client_secrets token and the /realtime/calls SDP exchange) and blocks
//   any other api.openai.com request, so nothing can reach the real API.
// - WebRTC: an init script replaces RTCPeerConnection before the app loads.
//   Its 'oai-events' data channel records what the app sends and lets a test
//   push server events with window.__fakeRealtime.emit(event).
//
// It fakes OpenAI's side only. Everything in js/ runs unmodified.

const FAKE_EPHEMERAL_KEY = 'ek_fake_browser_test';
const FAKE_SDP_ANSWER = 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=fake\r\nt=0 0\r\n';
const TOKEN_LIFETIME_SECONDS = 60;

// Runs inside the page, before any app script. Must be self-contained: it is
// serialized by Playwright, so it can't use anything from this module's scope.
function installFakePeerConnection() {
  const fake = {
    sent: [],
    channel: null,
    emit(event) {
      if (!fake.channel || fake.channel.readyState !== 'open') {
        throw new Error('fake data channel is not open');
      }
      fake.channel.onmessage?.({ data: JSON.stringify(event) });
    },
    sentOfType(type) {
      return fake.sent.filter((message) => message.type === type);
    },
  };

  class FakeDataChannel {
    constructor(label) {
      this.label = label;
      this.readyState = 'connecting';
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      this.onerror = null;
    }
    send(data) {
      fake.sent.push(JSON.parse(data));
    }
    close() {
      if (this.readyState === 'closed') return;
      this.readyState = 'closed';
    }
  }

  class FakePeerConnection {
    constructor() {
      this.connectionState = 'new';
      this.iceConnectionState = 'new';
      this.onconnectionstatechange = null;
      this.oniceconnectionstatechange = null;
      this.ontrack = null;
    }
    addTrack() {}
    createDataChannel(label) {
      fake.channel = new FakeDataChannel(label);
      return fake.channel;
    }
    async createOffer() {
      return { type: 'offer', sdp: 'v=0\r\ns=fake-offer\r\n' };
    }
    async setLocalDescription() {}
    async setRemoteDescription() {
      // The real connection opens the channel shortly after the answer.
      setTimeout(() => {
        this.connectionState = 'connected';
        this.onconnectionstatechange?.();
        fake.channel.readyState = 'open';
        fake.channel.onopen?.();
      }, 0);
    }
    async getStats() {
      return new Map();
    }
    close() {
      this.connectionState = 'closed';
      if (fake.channel) fake.channel.close();
    }
  }

  // A silent synthetic microphone. Playwright's browsers on macOS leave
  // getUserMedia pending forever, fake-device flags or not (see
  // live/speech.js), and the fake connection never sends audio anyway.
  navigator.mediaDevices.getUserMedia = async () => {
    const context = new AudioContext();
    return context.createMediaStreamDestination().stream;
  };

  window.RTCPeerConnection = FakePeerConnection;
  window.__fakeRealtime = fake;
}

/**
 * Route api.openai.com to canned answers and install the fake peer
 * connection. Call before page.goto(). Returns the list of intercepted
 * requests, for assertions about what the app sent.
 */
export async function installFakeOpenAI(page) {
  const requests = [];
  await page.route('https://api.openai.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push({ path: url.pathname, body: request.postData() });
    if (url.pathname === '/v1/realtime/client_secrets') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          value: FAKE_EPHEMERAL_KEY,
          expires_at: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
        }),
      });
    } else if (url.pathname === '/v1/realtime/calls') {
      await route.fulfill({ status: 201, contentType: 'application/sdp', body: FAKE_SDP_ANSWER });
    } else {
      // Never let a browser test reach the real API.
      await route.abort('blockedbyclient');
    }
  });
  await page.addInitScript(installFakePeerConnection);
  return requests;
}

/** Push one server event into the app's data channel. */
export function emitServerEvent(page, event) {
  return page.evaluate((e) => window.__fakeRealtime.emit(e), event);
}

/** Everything the app has sent on the data channel so far. */
export function sentEvents(page, type) {
  return page.evaluate((t) => (t ? window.__fakeRealtime.sentOfType(t) : window.__fakeRealtime.sent), type);
}

// Server event shapes, as session.js consumes them (see its _handleMessage).
export const serverEvents = {
  sessionUpdated(transcription) {
    return { type: 'session.updated', session: { audio: { input: { transcription } } } };
  },
  userAudioItem(id, transcript = null) {
    return {
      type: 'conversation.item.done',
      item: { id, type: 'message', role: 'user', content: [{ type: 'input_audio', transcript }] },
    };
  },
  transcriptCompleted(id, transcript) {
    return { type: 'conversation.item.input_audio_transcription.completed', item_id: id, transcript };
  },
  // A whole tutor reply: session.js builds the text from deltas and commits it
  // on .done, then response.done ends the turn.
  assistantTurn(text) {
    return [
      { type: 'response.output_audio_transcript.delta', delta: text },
      { type: 'response.output_audio_transcript.done', transcript: text },
      { type: 'response.done', response: { status: 'completed' } },
    ];
  },
};

/** Push several server events in order. */
export async function emitServerEvents(page, events) {
  for (const event of events) await emitServerEvent(page, event);
}
