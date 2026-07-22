import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RealtimeSession from '../js/realtime/session.js';

// --- WebRTC mocks -----------------------------------------------------
// jsdom implements none of RTCPeerConnection/RTCDataChannel/getUserMedia, so
// connect() needs all three faked. These mocks are deliberately minimal --
// just enough surface area for session.js's actual code paths to run.

class MockDataChannel {
  constructor() {
    this.readyState = 'connecting';
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.sent = [];
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 'closed';
  }
  // --- test helpers, not part of the real DataChannel API ---
  simulateOpen() {
    this.readyState = 'open';
    if (this.onopen) this.onopen();
  }
  simulateMessage(obj) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(obj) });
  }
}

class MockPeerConnection {
  constructor(config) {
    this.config = config;
    this.connectionState = 'new';
    this.iceConnectionState = 'new';
    this.onconnectionstatechange = null;
    this.oniceconnectionstatechange = null;
    this.ontrack = null;
    this.dataChannel = null;
    MockPeerConnection.instances.push(this);
  }
  createDataChannel() {
    this.dataChannel = new MockDataChannel();
    return this.dataChannel;
  }
  async createOffer() {
    return { type: 'offer', sdp: 'mock-offer-sdp' };
  }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  addTrack() {}
  close() {
    this.connectionState = 'closed';
  }
  async getStats() {
    // RTCStatsReport is Map-like (forEach over report objects) -- a real Map
    // matches that shape closely enough for testing.
    return this.mockStatsReport || new Map();
  }
  // --- test helper ---
  setConnectionState(state) {
    this.connectionState = state;
    if (this.onconnectionstatechange) this.onconnectionstatechange();
  }
}
MockPeerConnection.instances = [];

function mockTrack() {
  return { stop: vi.fn() };
}

// Installs global.fetch / global.RTCPeerConnection / getUserMedia mocks.
// Returns a mutable state object tests can flip mid-run (e.g. state.sdpOk =
// false) to simulate a later request failing, without needing to rebuild
// the whole mock.
function installMocks() {
  MockPeerConnection.instances = [];
  global.RTCPeerConnection = MockPeerConnection;
  global.navigator.mediaDevices = {
    getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [mockTrack()] }),
  };

  const state = { tokenOk: true, sdpOk: true, expiresAt: null };

  global.fetch = vi.fn((url) => {
    if (url.includes('/client_secrets')) {
      return state.tokenOk
        ? Promise.resolve({
            ok: true,
            json: async () => ({
              value: 'ephemeral-key',
              ...(state.expiresAt ? { expires_at: state.expiresAt } : {}),
            }),
          })
        : Promise.resolve({ ok: false, status: 401, json: async () => ({ error: { message: 'bad key' } }) });
    }
    if (url.includes('/calls')) {
      return state.sdpOk
        ? Promise.resolve({ ok: true, text: async () => 'mock-answer-sdp' })
        : Promise.resolve({ ok: false, status: 409 });
    }
    throw new Error('unexpected fetch url: ' + url);
  });

  return state;
}

function latestPc() {
  return MockPeerConnection.instances[MockPeerConnection.instances.length - 1];
}

// Drives connect() through to a fully 'active' session: awaits connect(),
// then simulates the data channel actually opening (a separate async event
// in real WebRTC that connect() itself doesn't wait for).
async function connectAndOpen(session, apiKey = 'sk-test', options = {}) {
  await session.connect(apiKey, options);
  const pc = latestPc();
  pc.dataChannel.simulateOpen();
  return pc;
}

describe('RealtimeSession.connect', () => {
  let session;

  beforeEach(() => {
    installMocks();
    session = new RealtimeSession();
  });

  it('reaches active state and sends a correctly-shaped session.update', async () => {
    const statuses = [];
    session.onStatusChange = (status) => statuses.push(status);

    const pc = await connectAndOpen(session, 'sk-test', {
      instructions: 'You are María.',
      voice: 'marin',
    });

    expect(session.isConnected).toBe(true);
    expect(statuses).toEqual(['connecting', 'active']);

    const update = pc.dataChannel.sent.find(m => m.type === 'session.update');
    expect(update.session.type).toBe('realtime');
    expect(update.session.instructions).toBe('You are María.');
    expect(update.session.audio.output.voice).toBe('marin');
    expect(update.session.audio.input.turn_detection.type).toBe('server_vad');
    expect(update.session.audio.input.transcription.model).toBe('gpt-4o-transcribe');
    expect(update.session.audio.input.transcription.language).toBe('es');
  });

  it('falls back to the original fixed turn_detection when no override is passed', async () => {
    const pc = await connectAndOpen(session, 'sk-test', {});
    const update = pc.dataChannel.sent.find(m => m.type === 'session.update');

    expect(update.session.audio.input.turn_detection).toEqual({
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 1500,
    });
  });

  it('honors an options.turnDetection override (e.g. from turn-profiles.js)', async () => {
    const customTurnDetection = {
      type: 'server_vad',
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 2200,
    };

    const pc = await connectAndOpen(session, 'sk-test', { turnDetection: customTurnDetection });
    const update = pc.dataChannel.sent.find(m => m.type === 'session.update');

    expect(update.session.audio.input.turn_detection).toEqual(customTurnDetection);
  });

  it('sends response.create to greet only when autoGreet is not false', async () => {
    const pc = await connectAndOpen(session, 'sk-test', { autoGreet: true });
    pc.dataChannel.simulateMessage({ type: 'session.updated' });

    expect(pc.dataChannel.sent.some(m => m.type === 'response.create')).toBe(true);
  });

  it('does not greet when autoGreet is false', async () => {
    const pc = await connectAndOpen(session, 'sk-test', { autoGreet: false });
    pc.dataChannel.simulateMessage({ type: 'session.updated' });

    expect(pc.dataChannel.sent.some(m => m.type === 'response.create')).toBe(false);
  });

  it('a bad API key fails immediately with status error, no reconnect scheduled', async () => {
    const mockState = installMocks();
    mockState.tokenOk = false;
    session = new RealtimeSession();

    const statuses = [];
    const errors = [];
    session.onStatusChange = (status, meta) => statuses.push({ status, meta });
    session.onError = (msg) => errors.push(msg);

    await expect(session.connect('sk-bad')).rejects.toThrow('bad key');

    expect(statuses.at(-1)).toEqual({ status: 'error', meta: {} });
    expect(errors).toEqual(['bad key']);
    expect(session.isConnected).toBe(false);
  });
});

describe('RealtimeSession auto-reconnect', () => {
  let session;

  beforeEach(() => {
    installMocks();
    session = new RealtimeSession();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects transparently when the peer connection reaches "failed"', async () => {
    const statuses = [];
    session.onStatusChange = (status, meta) => statuses.push({ status, meta });

    const pc1 = await connectAndOpen(session, 'sk-test', { instructions: 'persona A' });
    expect(MockPeerConnection.instances).toHaveLength(1);

    pc1.setConnectionState('failed');
    expect(session.isConnected).toBe(false);

    await vi.advanceTimersByTimeAsync(session._reconnectDelayMs);
    const pc2 = latestPc();
    pc2.dataChannel.simulateOpen();

    expect(MockPeerConnection.instances).toHaveLength(2);
    expect(session.isConnected).toBe(true);
    expect(statuses.map(s => s.status)).toEqual(['connecting', 'active', 'reconnecting', 'active']);
    // Never re-greets on a reconnect, regardless of the original autoGreet value.
    pc2.dataChannel.simulateMessage({ type: 'session.updated' });
    expect(pc2.dataChannel.sent.some(m => m.type === 'response.create')).toBe(false);
  });

  it('"disconnected" waits out a grace period before reconnecting, and skips it if recovered', async () => {
    const pc1 = await connectAndOpen(session, 'sk-test');
    pc1.setConnectionState('disconnected');

    // Recovers well within the 3s grace period -- should NOT trigger a reconnect.
    await vi.advanceTimersByTimeAsync(1000);
    pc1.setConnectionState('connected');
    await vi.advanceTimersByTimeAsync(3000);

    expect(MockPeerConnection.instances).toHaveLength(1);
    expect(session.isConnected).toBe(true);
  });

  it('"disconnected" past the grace period without recovery does reconnect', async () => {
    const pc1 = await connectAndOpen(session, 'sk-test');
    pc1.setConnectionState('disconnected');

    await vi.advanceTimersByTimeAsync(3000); // grace period elapses, still disconnected
    await vi.advanceTimersByTimeAsync(session._reconnectDelayMs);

    expect(MockPeerConnection.instances).toHaveLength(2);
  });

  it('regression: a reconnect attempt that itself fails keeps retrying instead of giving up after one try', async () => {
    const mockState = installMocks();
    session = new RealtimeSession();
    const statuses = [];
    session.onStatusChange = (status, meta) => statuses.push({ status, meta });

    const pc1 = await connectAndOpen(session, 'sk-test');
    pc1.setConnectionState('failed');

    // First two reconnect attempts fail (e.g. OpenAI 409 before it releases
    // the old call); the third succeeds.
    mockState.sdpOk = false;
    await vi.advanceTimersByTimeAsync(session._reconnectDelayMs); // attempt 1 -> fails
    await vi.advanceTimersByTimeAsync(session._reconnectDelayMs); // attempt 2 -> fails
    mockState.sdpOk = true;
    await vi.advanceTimersByTimeAsync(session._reconnectDelayMs); // attempt 3 -> succeeds
    latestPc().dataChannel.simulateOpen();

    expect(session.isConnected).toBe(true);
    expect(session._reconnectAttempts).toBe(3);
    // Must not have given up early: no 'idle' status in between the failures.
    expect(statuses.some(s => s.status === 'idle')).toBe(false);
  });

  it('gives up and surfaces an unexpected idle after exhausting all reconnect attempts', async () => {
    const mockState = installMocks();
    session = new RealtimeSession();
    session._maxReconnectAttempts = 2; // keep the test fast
    const statuses = [];
    session.onStatusChange = (status, meta) => statuses.push({ status, meta });

    const pc1 = await connectAndOpen(session, 'sk-test');
    pc1.setConnectionState('failed');
    mockState.sdpOk = false; // every reconnect attempt fails from here on

    await vi.advanceTimersByTimeAsync(session._reconnectDelayMs); // attempt 1
    await vi.advanceTimersByTimeAsync(session._reconnectDelayMs); // attempt 2 -- exhausted

    expect(session._reconnectAttempts).toBe(2);
    expect(statuses.at(-1)).toEqual({ status: 'idle', meta: { unexpected: true } });
    expect(session._lastConnectArgs).toBeNull();
  });

  it('a deliberate disconnect() does not trigger any reconnect attempt', async () => {
    const pc1 = await connectAndOpen(session, 'sk-test');

    session.disconnect();
    expect(session._lastConnectArgs).toBeNull();

    await vi.advanceTimersByTimeAsync(10000);
    expect(MockPeerConnection.instances).toHaveLength(1); // no reconnect happened
  });

  it('_onConnectionLost is idempotent -- a redundant signal for the same drop does not double-reconnect', async () => {
    const pc1 = await connectAndOpen(session, 'sk-test');

    // Simulate both onconnectionstatechange AND a (real-world-lagging)
    // dc.onclose firing for the same underlying drop.
    pc1.setConnectionState('failed');
    pc1.dataChannel.onclose?.();

    await vi.advanceTimersByTimeAsync(session._reconnectDelayMs);

    expect(session._reconnectAttempts).toBe(1); // not 2
    expect(MockPeerConnection.instances).toHaveLength(2); // exactly one reconnect happened
  });
});

describe('RealtimeSession._handleMessage transcript extraction', () => {
  let session;

  beforeEach(() => {
    session = new RealtimeSession();
  });

  it('extracts a top-level msg.transcript', () => {
    const received = [];
    session.onUserTranscript = (t) => received.push(t);

    session._handleMessage({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: '  hola  ',
    });

    expect(received).toEqual(['hola']);
  });

  it('extracts a transcript nested under item.content[]', () => {
    const received = [];
    session.onUserTranscript = (t) => received.push(t);

    session._handleMessage({
      type: 'conversation.item.done',
      item: { role: 'user', content: [{ type: 'input_audio', transcript: 'buenos días' }] },
    });

    expect(received).toEqual(['buenos días']);
  });

  it('warns instead of calling onUserTranscript when the transcript is null', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const received = [];
    session.onUserTranscript = (t) => received.push(t);

    session._handleMessage({
      type: 'conversation.item.done',
      item: { role: 'user', content: [{ type: 'input_audio', transcript: null }] },
    });

    expect(received).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no recognizable transcript field'),
      expect.any(String)
    );
    warnSpy.mockRestore();
  });

  it('logs a clear error when transcription fails outright, instead of no signal at all', () => {
    // Previously unhandled entirely -- every null-transcript investigation had
    // no way to see this even if it was the actual cause the whole time.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const received = [];
    session.onUserTranscript = (t) => received.push(t);

    session._handleMessage({
      type: 'conversation.item.input_audio_transcription.failed',
      item_id: 'item_123',
      error: { message: 'unsupported model' },
    });

    expect(received).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('input audio transcription failed'),
      expect.stringContaining('unsupported model')
    );
    errorSpy.mockRestore();
  });
});

describe('RealtimeSession AI transcript de-duplication', () => {
  let session;

  beforeEach(() => {
    session = new RealtimeSession();
  });

  it('does not commit the same final AI transcript to history twice in a row', () => {
    // Reproduces manual testing where each assistant reply appeared 2-3 times
    // with an identical timestamp -- best theory: the server emits the same
    // response under both the old and new event name aliases.
    const received = [];
    session.onAITranscript = (text, isFinal) => { if (isFinal) received.push(text); };

    session._handleMessage({ type: 'response.audio_transcript.delta', delta: 'Hola, ' });
    session._handleMessage({ type: 'response.audio_transcript.delta', delta: 'bienvenido.' });
    session._handleMessage({ type: 'response.audio_transcript.done' });

    // Same underlying response arriving again under the new event name alias.
    session._handleMessage({ type: 'response.output_audio_transcript.delta', delta: 'Hola, ' });
    session._handleMessage({ type: 'response.output_audio_transcript.delta', delta: 'bienvenido.' });
    session._handleMessage({ type: 'response.output_audio_transcript.done' });

    expect(received).toEqual(['Hola, bienvenido.']);
  });

  it('still commits a genuinely new reply that happens to follow immediately', () => {
    const received = [];
    session.onAITranscript = (text, isFinal) => { if (isFinal) received.push(text); };

    session._handleMessage({ type: 'response.audio_transcript.delta', delta: 'Primera respuesta.' });
    session._handleMessage({ type: 'response.audio_transcript.done' });

    session._handleMessage({ type: 'response.audio_transcript.delta', delta: 'Segunda respuesta.' });
    session._handleMessage({ type: 'response.audio_transcript.done' });

    expect(received).toEqual(['Primera respuesta.', 'Segunda respuesta.']);
  });

  it('does not fire onAITranscript at all for an empty buffer', () => {
    const received = [];
    session.onAITranscript = (text, isFinal) => { if (isFinal) received.push(text); };

    session._handleMessage({ type: 'response.audio_transcript.done' });

    expect(received).toEqual([]);
  });
});

describe('RealtimeSession connectivity diagnostics', () => {
  let session;

  beforeEach(() => {
    installMocks();
    session = new RealtimeSession();
  });

  it('logs the ephemeral token expiry when the server provides one', async () => {
    const mockState = installMocks();
    mockState.expiresAt = Math.floor(Date.now() / 1000) + 55; // ~55s from now
    session = new RealtimeSession();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await connectAndOpen(session, 'sk-test');

    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/expires_at in \d+s/));
    logSpy.mockRestore();
  });

  it('logs candidate-pair stats when the connection is lost', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const pc = await connectAndOpen(session, 'sk-test');

    pc.mockStatsReport = new Map([
      ['candidate-pair-1', {
        type: 'candidate-pair',
        state: 'succeeded',
        bytesSent: 12345,
        bytesReceived: 0, // nothing coming back -- the NAT-timeout signature
        packetsLost: 0,
        currentRoundTripTime: 0.05,
      }],
    ]);
    pc.setConnectionState('failed');
    await Promise.resolve(); // let the async getStats() call settle

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('stats at failed'),
      expect.objectContaining({ bytesSent: 12345, bytesReceived: 0 })
    );
    logSpy.mockRestore();
  });

  it('does not throw if getStats() is unavailable or the pc is already gone', async () => {
    const pc = await connectAndOpen(session, 'sk-test');
    pc.getStats = undefined;

    expect(() => pc.setConnectionState('failed')).not.toThrow();
  });
});
