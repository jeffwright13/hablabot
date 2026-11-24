import { describe, it, expect, beforeEach, vi } from 'vitest';
import HablaBotModels from '../js/utils/models.js';
import { initModelSettings } from '../js/ui/model-settings.js';

// A stand-in for HablaBotConfig: just get/set over a plain object.
function fakeConfig(models = { realtime: '', transcription: '' }) {
  const settings = { models };
  return {
    get: (key) => settings[key],
    set: vi.fn(async (key, value) => {
      settings[key] = value;
    }),
  };
}

function fixture() {
  document.body.innerHTML = `
    <input id="realtime-model">
    <input id="transcription-model">
    <p id="model-settings-note"></p>`;
  return {
    inputs: {
      realtime: document.getElementById('realtime-model'),
      transcription: document.getElementById('transcription-model'),
    },
    note: document.getElementById('model-settings-note'),
  };
}

function typeAndCommit(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('change'));
}

describe('initModelSettings', () => {
  let elements;

  beforeEach(() => {
    elements = fixture();
  });

  it('shows each role\'s default as the placeholder and the saved override as the value', () => {
    const config = fakeConfig({ realtime: 'gpt-realtime-2.1-mini', transcription: '' });
    initModelSettings({ ...elements, config, registry: HablaBotModels });

    expect(elements.inputs.realtime.placeholder).toBe('gpt-realtime-2.1');
    expect(elements.inputs.realtime.value).toBe('gpt-realtime-2.1-mini');
    expect(elements.inputs.transcription.placeholder).toBe('gpt-4o-transcribe');
    expect(elements.inputs.transcription.value).toBe('');
  });

  it('saves a trimmed override for the edited role only', async () => {
    const config = fakeConfig({ realtime: 'kept', transcription: '' });
    initModelSettings({ ...elements, config, registry: HablaBotModels });

    typeAndCommit(elements.inputs.transcription, '  gpt-transcribe  ');
    await Promise.resolve();

    expect(config.set).toHaveBeenCalledWith('models', { realtime: 'kept', transcription: 'gpt-transcribe' });
    expect(elements.inputs.transcription.value).toBe('gpt-transcribe');
  });

  it('saves a cleared field as blank, meaning "use the default"', async () => {
    const config = fakeConfig({ realtime: 'gpt-realtime-2.1-mini', transcription: '' });
    initModelSettings({ ...elements, config, registry: HablaBotModels });

    typeAndCommit(elements.inputs.realtime, '   ');
    await Promise.resolve();

    expect(config.set).toHaveBeenCalledWith('models', { realtime: '', transcription: '' });
  });

  it('refresh() reloads the fields from config', () => {
    const config = fakeConfig();
    const controls = initModelSettings({ ...elements, config, registry: HablaBotModels });

    config.get('models').realtime = 'changed-elsewhere';
    controls.refresh();

    expect(elements.inputs.realtime.value).toBe('changed-elsewhere');
  });

  it('explains blank-means-default and when the IDs were last checked', () => {
    initModelSettings({ ...elements, config: fakeConfig(), registry: HablaBotModels });

    expect(elements.note.textContent).toContain('Leave blank');
    expect(elements.note.textContent).toContain(HablaBotModels.MODELS_LAST_CHECKED);
  });

  it('warns about a default model with an announced shutdown', () => {
    initModelSettings({ ...elements, config: fakeConfig(), registry: HablaBotModels });

    expect(elements.note.textContent).toContain('gpt-4o-transcribe');
    expect(elements.note.textContent).toContain('2027-02-26');
  });

  it('works without a note element', () => {
    expect(() =>
      initModelSettings({ inputs: elements.inputs, note: null, config: fakeConfig(), registry: HablaBotModels })
    ).not.toThrow();
  });
});
