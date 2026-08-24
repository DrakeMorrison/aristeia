# Aristeia

> ἀριστεία — the hero's finest hour; excellence made visible through practice.
> *αἰὲν ἀριστεύειν* — ever to excel.

A suite of small, single-file PWAs for daily self-improvement logging. Each app
is self-contained (one `index.html`, a service worker, a manifest), stores data
locally in the browser, and works offline.

## The apps

| App | Purpose | Live |
|---|---|---|
| [meridian](meridian/) | Time tracker and prediction calibration | [open](https://drakemorrison.github.io/aristeia/meridian/) |
| [gnomon](gnomon/) | One-tap timestamped activity log for shadowing sessions | [open](https://drakemorrison.github.io/aristeia/gnomon/) |
| [pharmakon](pharmakon/) | Stimulant-cycling tracker: nicotine/caffeine alternation with honest violation flagging | [open](https://drakemorrison.github.io/aristeia/pharmakon/) |
| [halteres](halteres/) | Simple & Sinister kettlebell log: swings, get-ups, step-loading, and timed tests | [open](https://drakemorrison.github.io/aristeia/halteres/) |
| [nbacking](nbacking/) | Dual n-back working memory training with local stats and Beeminder integration | [open](https://drakemorrison.github.io/aristeia/nbacking/) |

## Architecture

Every app follows the same pattern:

- **Single file** — all HTML, CSS, and JS in one `index.html`
- **Offline-first PWA** — service worker (`sw.js`) + web manifest, installable to a phone home screen
- **Local data** — browser storage only, no backend; CSV export/backup where it matters
- **Relative paths** — each app runs from any subdirectory

## History

These apps began life as standalone repositories
([meridian](https://github.com/DrakeMorrison/meridian),
[gnomon](https://github.com/DrakeMorrison/gnomon),
[pharmakon](https://github.com/DrakeMorrison/pharmakon),
[halteres](https://github.com/DrakeMorrison/halteres),
[NBacking](https://github.com/DrakeMorrison/NBacking)) and were consolidated
here in August 2026 with full git history preserved via `git subtree`.
