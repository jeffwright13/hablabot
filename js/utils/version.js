// HablaBot version display
//
// package.json is the single source of truth for the version (bumped only via
// `npm version`, per ~/coding/CLAUDE.md). This reads it at runtime, the same
// approach apg-web uses, so the UI never needs hand-editing on a release. Kept
// as a function taking `fetchFn` rather than an inline <script> so it can be
// unit-tested without a real network.
const VERSION_SOURCE = './package.json';

async function displayAppVersion(element, fetchFn = window.fetch.bind(window)) {
  if (!element) return;

  try {
    const response = await fetchFn(VERSION_SOURCE);
    if (!response.ok) return;

    const data = await response.json();
    if (data && typeof data.version === 'string' && data.version) {
      element.textContent = `v${data.version}`;
    }
  } catch (error) {
    // The placeholder already in the HTML stays visible; nothing else depends
    // on the version, so this is a warning, not an error.
    console.warn('Could not load version from package.json:', error);
  }
}

window.HablaBotVersion = { displayAppVersion };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { displayAppVersion };
}
