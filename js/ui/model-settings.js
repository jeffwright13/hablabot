// HablaBot Settings → Advanced: per-role AI model overrides
//
// Lets a model be swapped from the UI without a code change, e.g. to try a
// replacement before a default model shuts down. Blank means "use the
// registry default" (js/utils/models.js), and each field's placeholder shows
// that default. Kept out of app.js so it can be unit-tested.
const MODEL_ROLE_LABELS = {
  realtime: 'Conversation model',
  transcription: 'Transcription model',
};

// inputs:   { [role]: HTMLInputElement }, one per role in registry.DEFAULT_MODELS
// note:     optional element for the explanatory text
// config:   HablaBotConfig (get/set)
// registry: HablaBotModels
// Returns { refresh } to reload the fields from config (e.g. on opening Settings).
function initModelSettings({ inputs, note, config, registry }) {
  const roles = Object.keys(registry.DEFAULT_MODELS).filter((role) => inputs[role]);

  function refresh() {
    const overrides = config.get('models') || {};
    for (const role of roles) {
      const input = inputs[role];
      input.placeholder = registry.DEFAULT_MODELS[role];
      input.value = typeof overrides[role] === 'string' ? overrides[role] : '';
    }
  }

  for (const role of roles) {
    const input = inputs[role];
    input.setAttribute('aria-label', MODEL_ROLE_LABELS[role] || role);
    // 'change' fires on blur or Enter: one save per edit, not per keystroke.
    input.addEventListener('change', () => {
      const value = input.value.trim();
      input.value = value;
      config.set('models', { ...(config.get('models') || {}), [role]: value });
    });
  }

  if (note) note.textContent = describeModels(registry);
  refresh();
  return { refresh };
}

function describeModels(registry) {
  const parts = [
    'Leave blank to use the default shown.',
    `Model IDs last checked against OpenAI's docs on ${registry.MODELS_LAST_CHECKED}.`,
  ];
  for (const [role, model] of Object.entries(registry.DEFAULT_MODELS)) {
    const shutdown = registry.KNOWN_SHUTDOWNS[model];
    if (shutdown) {
      const label = (MODEL_ROLE_LABELS[role] || role).toLowerCase();
      parts.push(`The default ${label}, ${model}, shuts down on ${shutdown}.`);
    }
  }
  return parts.join(' ');
}

window.HablaBotModelSettings = { initModelSettings };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initModelSettings };
}
