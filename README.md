# HablaBot - AI-Powered Spanish Conversation Tutor

HablaBot is a Progressive Web App (PWA) for interactive Spanish conversation practice with an
AI tutor over real-time voice. Built entirely client-side using vanilla JavaScript, with no
build step and no framework.

## Features

- **AI Conversation Partner**: Practice Spanish with María over a live, real-time voice
  conversation, powered by the OpenAI Realtime API (`gpt-realtime-2.1`) — not a text chatbot
  with text-to-speech bolted on. Speech recognition (Whisper) and turn-taking (server-side
  voice activity detection) both happen server-side; there's no push-to-talk button, you just
  talk and María responds when you pause.
- **16 Conversation Scenarios**: Restaurant, travel, shopping, family, work, health, emergency,
  café, meeting someone new, bank/post office, tech support call, apartment hunting,
  hairdresser, gym, school, and celebrations.
- **Three Difficulty Levels**: Beginner, intermediate, advanced — chosen once at the start of
  each session (vocabulary complexity, phrasing, and pause tolerance all adjust accordingly).
  There's no attempt to adapt difficulty automatically mid-conversation; a 15-30 minute session
  is too short a timescale for that to mean anything.
- **Vocabulary Manager**: Add words manually or import/export via CSV, with search and
  category/difficulty filtering. This is a plain word list, not a spaced-repetition or flashcard
  system — HablaBot deliberately doesn't try to be an SRS app (see `docs/DECISIONS.md` for why).
  Target words from your list get woven into each session's conversation prompt.
- **Progressive Web App**: Installable, works offline for cached pages (no network requests are
  needed until you actually start a conversation, which requires the OpenAI API).
- **Local-First**: Your vocabulary, settings, and API key are stored in your browser
  (IndexedDB/localStorage), not on any HablaBot server. See Privacy below for what that does and
  doesn't protect against.

## Quick Start

### Prerequisites

1. **Browser**: Chrome (or another Chromium-based browser) is recommended and the only one
   confirmed to work reliably for full conversations. Firefox has a known, unresolved
   intermittent disconnect bug on longer conversations (see `docs/DECISIONS.md`); Safari and
   Edge haven't been tested.
2. **OpenAI API Key**: Get one from the [OpenAI Platform](https://platform.openai.com/api-keys).
   Your account will need access to the Realtime API.
3. **Microphone Access**: Required for voice conversations.
4. **HTTPS or localhost**: Required for microphone access in the browser. Any static file server
   over `localhost` works for local use; a real deployment needs HTTPS.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jeffwright13/hablabot.git
   cd hablabot
   ```

2. **Serve the files** (there's no build step, just static files):
   ```bash
   npm run serve
   # runs `npx serve .` — prints the URL to open
   ```
   or, without Node:
   ```bash
   python3 -m http.server 8000
   # then open http://localhost:8000
   ```

3. **Configure your OpenAI API key**:
   - Go to the Settings tab
   - Enter your OpenAI API key
   - Click "Test" to verify it works

4. **Start a conversation**:
   - Go to the Conversation tab
   - Choose a scenario and difficulty level
   - Click "Start Conversation", accept the microphone permission prompt, and start talking —
     María will respond once you pause; there's nothing to hold down or click between turns.

## Installing as a PWA

HablaBot has a working `manifest.json` and service worker, so your browser's normal
"Install"/"Add to Home Screen" flow should be available. Note: the app ships without real PWA
icons (`assets/icons/` currently only contains a placeholder — see that directory for the exact
sizes needed); some browsers are stricter than others about installability without valid icons,
so this hasn't been confirmed to work reliably on every platform.

## How to Use

### Starting a Conversation

1. Choose a scenario and difficulty level
2. Set a session length (5-30 minutes, informational — the conversation doesn't hard-stop when
   it elapses)
3. Click "Start Conversation" and allow microphone access

### During the Conversation

Turn-taking is fully automatic — the app shows a listening indicator while you're speaking and
a processing indicator while María is composing a response. There's no button to hold or click
during the conversation itself; just talk naturally and pause when you're done speaking.

### Managing Vocabulary

1. **Add Words**: Vocabulary tab → "Add New Word"
2. **Import/Export CSV**: bulk-import a word list, or export your current list (e.g., to bring
   into a spreadsheet or another tool)
3. **Search & Filter**: by category or difficulty
4. Words in your list are eligible to be woven into future conversation sessions, matched to the
   session's chosen difficulty and scenario

## Configuration

### Settings

**API Configuration**
- OpenAI API Key (required to start any conversation)

**Voice Settings**
- AI voice persona (a fixed set of OpenAI Realtime API voices — not Spanish-specific; the model
  speaks whichever language it's instructed to in the selected voice)
- Speech rate (0.5x-1.5x, matching the Realtime API's own supported range)
- Volume

### Browser Permissions

- **Microphone**: required for the conversation feature
- **Storage**: used for vocabulary, settings, and conversation history, all local to your browser

## Privacy

- Vocabulary, settings, and conversation history are stored locally in your browser
  (IndexedDB/localStorage) — HablaBot has no backend and no server-side storage of its own
- Your OpenAI API key is stored in `localStorage` in **plain text**, not encrypted. Anything with
  script access to the page (e.g., a malicious browser extension) could read it. Treat it like
  any other credential you keep in browser storage.
- The only external network calls HablaBot makes are to OpenAI's API, to run the conversation
  itself

## Technical Details

### Architecture

- **Frontend**: Pure HTML5/CSS3/JavaScript ES6+, no framework, no build step
- **Conversation**: OpenAI Realtime API over WebRTC (`js/realtime/session.js`) — real-time voice
  in both directions, server-side speech-to-text (Whisper) and voice activity detection. The
  older Web Speech API browser-recognition path and a separate GPT-4 chat-completions engine
  both still exist on disk (`js/speech/`, `js/ai/conversation.js`) but are dead code, not loaded
  by `index.html` — kept for reference, not in the live path.
- **Storage**: IndexedDB for vocabulary/sessions/history, localStorage for settings and the API
  key
- **PWA**: Service worker (`sw.js`) for offline asset caching (network-first, falling back to
  cache only when offline)

### Browser Support

- **Chrome** (or Chromium-based): recommended, the only browser confirmed reliable for full
  conversations in testing
- **Firefox**: has a known, unresolved intermittent disconnect bug on longer conversations,
  root-caused to a NAT/router UDP timeout difference in Firefox's WebRTC implementation (see
  `docs/DECISIONS.md`). The app auto-reconnects when this happens, but it's a real, visible
  interruption.
- **Safari / Edge**: untested

### File Structure

```
hablabot/
├── index.html              # Main app entry point
├── manifest.json            # PWA manifest
├── sw.js                     # Service worker
├── css/
│   ├── main.css              # Main styles
│   ├── mobile.css            # Mobile-responsive styles
│   └── animations.css        # UI animations
├── js/
│   ├── app.js                 # Main application controller
│   ├── realtime/
│   │   ├── session.js               # OpenAI Realtime API / WebRTC connection
│   │   ├── session-vocab-bridge.js  # Tracks target-word usage during a live session
│   │   └── turn-profiles.js         # Per-difficulty pause-tolerance tuning
│   ├── ai/
│   │   ├── prompts.js         # Scenario/difficulty system prompts
│   │   └── conversation.js    # Dead code (pre-Realtime-API chat-completions engine)
│   ├── speech/                # Dead code (pre-Realtime-API Web Speech API path)
│   ├── vocabulary/
│   │   └── manager.js         # Vocabulary CRUD, CSV import/export, session word selection
│   ├── storage/
│   │   └── database.js        # IndexedDB wrapper
│   ├── ui/                    # UI components & state
│   └── utils/                 # Config, helpers, audio, per-user profile management
├── assets/                    # Icons (placeholder only), sounds, images
├── tests/                     # Vitest test suite
└── docs/
    └── DECISIONS.md            # Append-only architecture/design decision log
```

## Testing

`npm test` runs the Vitest suite in `tests/`. See `docs/DECISIONS.md` for testing conventions
and rationale.

## Troubleshooting

**Microphone not working**
- Ensure you're on `localhost` or HTTPS
- Check browser microphone permissions
- Try refreshing the page

**API key errors**
- Verify the key is correct and active
- Check your OpenAI account has credits and Realtime API access

**Conversation disconnects or cuts out**
- Try Chrome if you're on Firefox — see Browser Support above
- The app will attempt to auto-reconnect on an unexpected disconnect

**App not loading, or looks broken/unstyled**
- Hard-refresh (the service worker caches aggressively; a stale cache has caused this before —
  see `docs/DECISIONS.md`)
- Check the browser console for errors
- Try incognito/private mode to rule out extensions

### Getting Help

Check the GitHub issues for known problems, or open a new one.

## Contributing

Contributions welcome. See `docs/DECISIONS.md` for the reasoning behind existing architectural
choices before proposing changes to them.

## License

MIT License — see the `LICENSE` file.

## Acknowledgments

- OpenAI, for the Realtime API
- The Spanish language learning community
