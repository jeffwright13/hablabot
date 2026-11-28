// HablaBot AI model registry
//
// The ONLY place model IDs live. OpenAI's supported models change often (the
// Realtime API schema and model names changed once already, in July 2026), so
// a model change should be an edit here plus a test, never a hunt through
// session.js and app.js. Settings can override each role (Settings → Advanced);
// resolveModels() turns those overrides into the IDs actually sent.
//
// Source for everything below: OpenAI's models and deprecations pages
// (developers.openai.com/api/docs/models, /api/docs/deprecations), read
// 2026-11-24. Re-check them before changing anything here, and update the
// docs/SPEC.md §7 table and its "last checked" date to match.
const MODELS_LAST_CHECKED = '2026-11-24';

// Role -> default model ID.
const DEFAULT_MODELS = Object.freeze({
  // Speech-to-speech conversation over WebRTC (/v1/realtime/calls). Current and
  // not deprecated as of MODELS_LAST_CHECKED.
  realtime: 'gpt-realtime-2.1',
  // Input transcription inside that session (session.update ->
  // audio.input.transcription). DEPRECATED: shutdown 2027-02-26 (see
  // KNOWN_SHUTDOWNS). OpenAI names gpt-live-transcribe or gpt-transcribe as
  // replacements. A Firefox live test on 2026-11-24 saw both silently produce
  // no transcript, but automated Chrome live tests on 2026-11-27/28 saw both
  // transcribe every turn (DECISIONS). Choosing one is docs/PLAN.md Stage 13b;
  // the tripwire test in tests/models.test.js fails 30 days before the
  // shutdown.
  transcription: 'gpt-4o-transcribe',
});

// Default voice for the Realtime session (audio.output.voice). Voice IDs are
// provider IDs that can change like model IDs, so the default lives here too
// and no other file hardcodes one (tests/default-voice.test.js). Chosen by the
// user on 2026-11-25 after a listening comparison in which alloy, marin and
// cedar all passed (DECISIONS). A voice saved in Settings still wins.
const DEFAULT_VOICE = 'marin';

// Announced shutdown dates (YYYY-MM-DD) for models this app uses by default.
const KNOWN_SHUTDOWNS = Object.freeze({
  'gpt-4o-transcribe': '2027-02-26', // notice 2026-08-26
});

// Retired or deprecated ID (lowercase) -> replacement. Applied to stored
// Settings overrides so a saved ID can't silently pin the app to a dead model.
// An explicit list rather than a name pattern: patterns break whenever OpenAI
// changes its naming, and can catch IDs they shouldn't. Each replacement must
// not itself appear as a key (tested).
const RETIRED_MODELS = Object.freeze({
  // Shut down 2026-05-07. HablaBot's original model before the July 2026
  // migration. The replacement is this app's choice: the deprecations entry
  // read didn't name one.
  'gpt-4o-realtime-preview': 'gpt-realtime-2.1',
  'gpt-4o-mini-realtime-preview': 'gpt-realtime-2.1-mini',
  // Shut down 2026-07-23 (notice 2026-04-22). Replacement is documented.
  'gpt-realtime-mini-2025-10-06': 'gpt-realtime-2.1-mini',
  // Shutdown 2027-01-20 (notice 2026-07-20). Replacements are documented.
  'gpt-realtime': 'gpt-realtime-2.1',
  'gpt-realtime-2025-08-28': 'gpt-realtime-2.1',
  'gpt-4o-realtime': 'gpt-realtime-2.1',
  'gpt-realtime-mini': 'gpt-realtime-2.1-mini',
  'gpt-realtime-mini-2025-12-15': 'gpt-realtime-2.1-mini',
  'gpt-4o-mini-realtime': 'gpt-realtime-2.1-mini',
  // No transcription entries: none of the documented replacements works as a
  // drop-in for this app's session (see DEFAULT_MODELS.transcription).
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function retiredReplacement(id) {
  return RETIRED_MODELS[id.trim().toLowerCase()];
}

// overrides: { role: id } from Settings; blank, missing or non-string means
// "use the default". Unknown roles are ignored; unknown IDs pass through, so
// a new model can be tried from Settings before this file knows about it.
function resolveModels(overrides) {
  const source = overrides && typeof overrides === 'object' ? overrides : {};
  const resolved = {};
  for (const [role, fallback] of Object.entries(DEFAULT_MODELS)) {
    const value = source[role];
    const id = typeof value === 'string' && value.trim() ? value.trim() : fallback;
    resolved[role] = retiredReplacement(id) || id;
  }
  return resolved;
}

// Rewrites retired IDs in stored overrides (the krashen migrate-on-read
// pattern). Pure: returns a new object plus whether anything changed, so the
// caller decides whether to persist.
function migrateRetiredModels(stored) {
  if (!stored || typeof stored !== 'object') return { models: {}, changed: false };
  const models = { ...stored };
  let changed = false;
  for (const [role, value] of Object.entries(models)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const replacement = retiredReplacement(value);
    if (replacement) {
      models[role] = replacement;
      changed = true;
    }
  }
  return { models, changed };
}

// Default models whose announced shutdown is within `warnDays` of `today`
// (or already past).
function defaultsNearShutdown(today, warnDays) {
  const near = [];
  for (const [role, model] of Object.entries(DEFAULT_MODELS)) {
    const shutdownDate = KNOWN_SHUTDOWNS[model];
    if (!shutdownDate) continue;
    const daysLeft = (Date.parse(`${shutdownDate}T00:00:00Z`) - today.getTime()) / MS_PER_DAY;
    if (daysLeft <= warnDays) near.push({ role, model, shutdownDate });
  }
  return near;
}

const HablaBotModels = {
  MODELS_LAST_CHECKED,
  DEFAULT_MODELS,
  DEFAULT_VOICE,
  KNOWN_SHUTDOWNS,
  RETIRED_MODELS,
  resolveModels,
  migrateRetiredModels,
  defaultsNearShutdown,
};

window.HablaBotModels = HablaBotModels;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HablaBotModels;
}
