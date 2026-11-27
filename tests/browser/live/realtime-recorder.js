// Records every event on the app's real 'oai-events' data channel, both
// directions, without changing how session.js handles them. Live tests wait
// on these events instead of on fixed sleeps.

// Runs inside the page before any app script (serialized by Playwright).
function recorderInitScript() {
  const recorder = { received: [], sent: [] };
  const createDataChannel = RTCPeerConnection.prototype.createDataChannel;
  RTCPeerConnection.prototype.createDataChannel = function recordedCreateDataChannel(...args) {
    const channel = createDataChannel.apply(this, args);
    channel.addEventListener('message', (event) => {
      try {
        recorder.received.push(JSON.parse(event.data));
      } catch {
        // Not JSON; session.js logs its own parse failure.
      }
    });
    const send = channel.send.bind(channel);
    channel.send = (data) => {
      try {
        recorder.sent.push(JSON.parse(data));
      } catch {
        // Ignore non-JSON sends.
      }
      return send(data);
    };
    return channel;
  };
  window.__realtimeRecorder = recorder;
}

export async function installRealtimeRecorder(page) {
  await page.addInitScript(recorderInitScript);
}

export function countReceived(page, type) {
  return page.evaluate((t) => window.__realtimeRecorder.received.filter((e) => e.type === t).length, type);
}

/** Wait until more than `already` events of `type` have arrived. */
export async function waitForReceived(page, type, already, timeout) {
  await page.waitForFunction(
    ({ t, n }) => window.__realtimeRecorder.received.filter((e) => e.type === t).length > n,
    { t: type, n: already },
    { timeout },
  );
}

/**
 * Wait until the tutor's audio has finished playing. Over WebRTC the server
 * reports playback with output_audio_buffer.started, then .stopped (finished)
 * or .cleared (interrupted). response.done comes earlier, while the audio is
 * still playing, so speaking right after it barges in on the tutor.
 */
export async function waitForTutorToFinish(page, timeout) {
  await page.waitForFunction(
    () => {
      const count = (t) => window.__realtimeRecorder.received.filter((e) => e.type === t).length;
      return count('output_audio_buffer.started')
        <= count('output_audio_buffer.stopped') + count('output_audio_buffer.cleared');
    },
    undefined,
    { timeout },
  );
}

export function sentOfType(page, type) {
  return page.evaluate((t) => window.__realtimeRecorder.sent.filter((e) => e.type === t), type);
}

export function receivedOfType(page, type) {
  return page.evaluate((t) => window.__realtimeRecorder.received.filter((e) => e.type === t), type);
}
