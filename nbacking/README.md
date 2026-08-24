# Nbacking

**Dual n-back working memory training.**

A single-page dual n-back trainer in the style of [Meridian](https://github.com/DrakeMorrison/meridian): no install, no account, no server. Sessions and stats live in your browser, and each completed session can post a datapoint to Beeminder.

[**Live app →**](https://drakemorrison.github.io/NBacking/)

---

## Features

- **Dual n-back** — 3×3 grid positions plus spoken letters (C H K L Q R S T), Jaeggi-style: 20+n trials, ~6 forced matches per modality
- **Adaptive difficulty** — ≥80% on both modalities levels up, <50% on either levels down (toggleable)
- **Stats** — current level, sessions today, day streak, best level, plus a progress chart of n-level and per-modality accuracy with hover details
- **Beeminder integration** — auto-post one datapoint per completed session (value 1, comment with level and scores), with idempotent retry via `requestid` and a "sync unsent" button
- **Import / Export** — CSV export and import for portability
- **Tones mode** — 8 distinct pitches instead of spoken letters, or as automatic fallback when speech synthesis is unavailable
- **Light and dark themes**
- **Keyboard shortcuts** — `A` position match, `L` sound match, `Space` start/stop, `S` settings, `E` export, `I` import, `Escape` close settings

## Usage

Open `index.html` (or serve the directory) and press Start. During a session, press `A` when the position matches the one n trials back, `L` when the letter matches.

For Beeminder: enter your username, [auth token](https://www.beeminder.com/api/v1/auth_token.json), and goal slug in Settings, then enable auto-post. The token is stored only in your browser's `localStorage`.

## Data

Everything stays in your browser via `localStorage`. Nothing is sent anywhere except the Beeminder datapoints you explicitly configure. Use Export CSV to back up or move your data.
