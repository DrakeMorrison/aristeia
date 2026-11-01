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
| [halteres](halteres/) | Simple & Sinister kettlebell log: swings, get-ups, step-loading, and timed tests, plus bodyweight strength-aerobics off days and GZCLP barbell days | [open](https://drakemorrison.github.io/aristeia/halteres/) |
| [nbacking](nbacking/) | Dual n-back working memory training with local stats and Beeminder integration | [open](https://drakemorrison.github.io/aristeia/nbacking/) |
| [peira](peira/) | Blinded, randomised N-of-1 self-experiments: lots drawn per period, jar-based blinding, Bayes factors instead of p-values | [open](https://drakemorrison.github.io/aristeia/peira/) |
| [kleio](kleio/) | History on a timeline: place each event, recall one detail, with spaced repetition, a Timeline-style run mode and Beeminder integration | [open](https://drakemorrison.github.io/aristeia/kleio/) |

## Architecture

Every app follows the same pattern:

- **Single file** — all HTML, CSS, and JS in one `index.html`
- **Offline-first PWA** — service worker (`sw.js`) + web manifest, installable to a phone home screen
- **Local-first data** — each app reads and writes browser storage and never waits on a network; CSV export/backup where it matters
- **Optional sync** — once a device is paired, `sync.js` keeps it in step with your others
- **Relative paths** — each app runs from any subdirectory of a checkout that has `sync.js` beside it (without it, an app just doesn't sync)

## Sync

The landing page's **Sync** section pairs a device for every app with one link. Data syncs through [Automerge](https://automerge.org)'s public test server, `wss://sync.automerge.org`, so no device needs an account or a VPN. Changes made offline wait and catch up. Each device holds a full copy, and the server promises to keep nothing.

**Everything in a doc is end-to-end encrypted.** The key is in the `#` part of the sync link, which browsers never send to a server, and in each paired device's localStorage. Record ids, field names and values are all hidden, as are which docs belong to which app. The server still sees how many records and fields a doc has, their sizes and when they change, and it could withhold or delete them. Forged values are rejected and a mass deletion nobody recorded is undone, but a small deletion would sync. Treat the link like a password: if it leaks, the only remedy is to pair every device again with a new one.

The link names a root doc that maps each app to its own doc, so opening one app never loads another's history. All the apps share one origin, so pairing once covers them all, except on iPhone, where each Home Screen app has its own storage. There, install **the landing page** rather than the separate apps: everything opens inside one window and shares one pairing.

| App | Synced | Stays per device |
|---|---|---|
| meridian | finished log rows | running and paused timers, Slack, notifications |
| gnomon | log entries | report range |
| pharmakon | doses, checkups, presets | |
| halteres | all three session logs; bells, goal, two-hand spacing, bar unit | current tab, Beeminder settings and ledger |
| nbacking | sessions; level, trials, interval, adaptive | speech, Beeminder settings |
| peira | experiments, with each day's entry merging separately; analysis settings | selected experiment |
| kleio | your cards, deleted starters, schedules, finished sessions, deck settings | session in play, Beeminder settings and ledger |

Theme and backup settings stay per device everywhere. No token or webhook ever enters a doc, because a doc keeps its full history. A device with a Beeminder token posts every session it learns of, including ones logged elsewhere; the requestid makes that an upsert, so two configured devices don't double-count.

How merges work (the header of `sync.js` has more):

- **Each field of each record is its own register.** Editing a dose's amount on one device and its note on another keeps both. If both edit the same field at once, one value wins, the same one everywhere.
- **Local edits are a diff against what was last synced**, so a device that missed an edit can't undo it, and offline changes need no journal.
- **Deletes beat concurrent edits**, and stay deleted.
- **A few fields merge by rule when written concurrently:** a kleio schedule keeps the later review, whole; a card's first-seen date keeps the earlier; nbacking's posted flag is true if either side posted; a peira trial keeps its further-along status and longer allocation. Open-ended peira trials derive each lot from a salt, so two devices drawing the same period offline get the same lot.
- **A save that would drop most of a store is refused** and restored from the doc, unless it came from an explicit Clear; this guards against a failed read or evicted storage wiping every device. A doc that loses most of a store with no Clear recorded is repaired the same way.
- **Remote changes wait** while you're typing, editing in an overlay or mid-session, then apply.

The Automerge build is committed in `vendor/` so sync depends on no CDN; see its README.

## History

These apps began life as standalone repositories
([meridian](https://github.com/DrakeMorrison/meridian),
[gnomon](https://github.com/DrakeMorrison/gnomon),
[pharmakon](https://github.com/DrakeMorrison/pharmakon),
[halteres](https://github.com/DrakeMorrison/halteres),
[NBacking](https://github.com/DrakeMorrison/NBacking)) and were consolidated
here in August 2026 with full git history preserved via `git subtree`.
