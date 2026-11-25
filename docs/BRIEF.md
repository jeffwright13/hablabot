# HablaBot — Project Brief

_Stable document: what this is, why it exists, who it's for, and hard constraints.
Update when the fundamentals change; not a changelog. Feature detail lives in `SPEC.md`,
the reasoning behind choices in `DECISIONS.md`, upcoming work in `PLAN.md`._

---

## What It Is

HablaBot is a browser-based Spanish **speaking** partner. The learner holds a live, spoken
conversation with an AI tutor ("María") inside a chosen everyday scenario (restaurant, bank,
apartment hunting, …) at a chosen difficulty level. Speech in, speech out, no push-to-talk:
the learner talks, pauses, and the tutor answers.

## Why It Exists

Language acquisition spans four skills. Listening and reading come from heavy, generous input
(the Krashen / Dreaming Spanish approach; see the sibling `krashen` repo for reading). Speaking
needs a patient partner who is always available, never judges, and keeps the conversation
going. HablaBot's job is that speaking slice, and only that. It is deliberately **not** a
spaced-repetition or flashcard app (see `DECISIONS.md`, 2026-07-23). Corrections are implicit
recasts ("¡Ah, tienes mucha hambre!"), never "that's wrong."

## Who It's For

Currently a single personal user (the developer), plus anyone in the household using a
separate local profile. The architecture should not block a later public release, but nothing
is built for one yet: there are no accounts and no server.

## The Core Loop

1. The learner picks a local profile (each has its own vocabulary and session history).
2. The learner picks a scenario, a difficulty, and a session length.
3. HablaBot assembles a Spanish system prompt from the persona, dialect, scenario and
   difficulty. A few target words from the learner's own vocabulary list belong here too; that
   part is hidden while it's rebuilt (PLAN Stage 8).
4. A live voice session opens with the AI provider. The tutor greets the learner.
5. Turn-taking is automatic: server-side voice activity detection decides when the learner has
   finished, and pause tolerance depends on the difficulty level.
6. Both sides' words appear as text. (Target-word usage is tallied when vocabulary practice is
   on.)
7. When the session ends, its transcript and word-usage counts are saved locally.

## Constraints (Hard)

- **Browser-only, static hosting.** No backend server. Deployed to GitHub Pages. No build step:
  plain `<script>` tags exposing `window.*` globals.
- **User-supplied API key.** Stored in `localStorage` (plain text, said honestly in the README
  and `PRIVACY.md`). It is sent only to the AI provider.
- **All learner data stays local.** Vocabulary, sessions and transcripts live in per-profile
  IndexedDB databases. Profiles are local configurations, not authenticated identities.
- **Voice is required.** Text-to-speech output and speech recognition are core, not optional.
  Typed input is planned as an always-available *alternative* for learners who are more
  comfortable typing at times (PLAN Stage 11). The tutor still answers aloud, and the product
  stays speaking-first.
- **Spanish is the only target language** for now.
- **Provider churn is expected.** AI model IDs and API shapes change often. Model IDs must be
  replaceable without code edits scattered across files (see `SPEC.md`, AI Models).
- **Test-driven.** Every behavior change starts with a failing Vitest test, and a pre-commit
  hook blocks commits when tests fail (see `TESTING.md`).

## Out of Scope

- Spaced repetition, mastery scores, review scheduling (removed 2026-07-23).
- Mid-session automatic difficulty adaptation.
- Reading or writing practice (that's `krashen`'s territory).
- Server-side storage, sync, or accounts.
