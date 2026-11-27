# Privacy

Effective date: 2026-11-24

HablaBot is a static web app. It has no developer-operated server, no accounts, no analytics and
no telemetry. This page describes what the code actually does. Update it in the same commit as
any change to what data goes where.

## Stored in your browser only

| Data | Where | Notes |
|---|---|---|
| OpenAI API key | `localStorage` (`hablabot-config`) | **Plain text, not encrypted.** Any script running on the same origin can read it, for example a malicious extension or another site served from the same `*.github.io` origin. One key is shared by all profiles. |
| Settings (voice, speech rate, volume) | `localStorage` (`hablabot-config`) | |
| Profiles (name, avatar) | `localStorage` (`hablabot_users`, `hablabot_current_user`) | |
| Vocabulary list | IndexedDB, one database per profile | |
| Conversation sessions: **full transcripts** of what you and the tutor said, plus target-word usage counts | IndexedDB, one database per profile | Kept indefinitely. Nothing deletes them automatically, and the unused `dataRetentionDays` setting is not enforced. |

**Known defect:** deleting a profile does not yet delete its IndexedDB database, so its
transcripts remain in the browser. To remove them by hand, open DevTools → Application → IndexedDB
and delete the database. A fix is planned (`docs/PLAN.md`, Stage 5).

## Sent to third parties

| Recipient | What | When |
|---|---|---|
| **OpenAI** (`api.openai.com`) | Your API key (to get a short-lived session token); the system prompt, which includes your target vocabulary words; **your live microphone audio**; and OpenAI's generated replies | Whenever a conversation is running, and when you press **Test** on the API key |
| **Google STUN server** (`stun.l.google.com`) | Network connection metadata during WebRTC setup. It learns your public IP address, **not** your audio or content. | At the start of each conversation and each reconnect |

OpenAI's handling and retention of API data is governed by OpenAI's own policies, not by HablaBot.
Check OpenAI's current API data-usage terms; they are not restated here because they change.

No other network destinations are contacted. The service worker deliberately bypasses API
traffic, and it caches only the app's own static files.

## Developers: the automated live test

`npm run test:live` (`docs/TESTING.md`, layer 2) is a developer tool, not part of the app. It
reads `OPENAI_API_KEY` from the developer's environment into the test browser's localStorage and
sends **synthesized** speech (macOS `say`, never a person's voice) to OpenAI, so OpenAI receives
the same kinds of data as in a normal session. The key is never written to disk by the tests:
the live project records no traces, screenshots or video, and failure logs omit transcripts and
the key. The free browser tests (`npm run test:browser`) contact no third party: every
`api.openai.com` request is answered or blocked in the test browser.

## If a new provider is added

Adding a provider (for example an external text-to-speech service) means new rows in the tables
above: what is sent (for TTS, the tutor's reply text, which often echoes your own words), the
recipient's retention terms, and where its key is stored.
