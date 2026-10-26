# Gnomon

**One-tap timestamped activity logging.**

A single-page activity log in the style of [Meridian](https://github.com/DrakeMorrison/meridian): no install, no account, no server. Named for the part of the sundial that casts the shadow — Gnomon is built for shadowing: following someone's work (or your own) and logging what's happening as it happens, then turning the timestamps into a report of how much time went where. Everything lives in your browser.

[**Live app →**](https://drakemorrison.github.io/gnomon/)

---

## How it works

Each log entry marks the **start** of an activity. Its duration runs until the next entry — so recording a task switch is a single tap, and no clock ever needs starting or stopping per task. Press **■ stop** when observation pauses (breaks, end of session).

## Features

- **One-tap logging** — recent activities become chips; tapping one logs it instantly. New activities are a quick type-and-enter.
- **Live "now" banner** — the current activity and how long it's been running, with a stop button
- **Reports** — time per activity (with share bars and percentages) for Today / Yesterday / 7 Days / 30 Days / All, plus a plaintext **Copy** button for pasting into notes or a debrief
- **Editable log** — tap any entry to adjust its time or text (missed a switch? fix the timestamp), or delete it
- **Stats** — time tracked today, entries today, distinct activities, day streak
- **Import / Export** — CSV export and import for portability and analysis elsewhere
- **Sync (experimental)** — keep the log in step across devices with [Automerge](https://automerge.org); see below
- **PWA** — installable, works offline
- **Light and dark themes**
- **Keyboard shortcuts** — `/` focus input, `X` stop, `S` settings, `E` export, `I` import, `Escape` close

## Usage

Open `index.html` (or serve the directory) and log the first activity. On mobile, use "Add to Home Screen" to install it as an app.

## Data

Everything stays in your browser via `localStorage`. Nothing is sent anywhere unless you turn on sync. Use Export CSV to back up or move your data — columns are `id,timestamp,iso,kind,text` with millisecond epoch timestamps.

## Sync (experimental)

Settings → Sync → **Start Syncing** puts the log in an [Automerge](https://automerge.org) document and syncs it through a tailnet-only Automerge server on the mac-mini (`wss://mac-mini.tailc76981.ts.net`, behind `tailscale serve`). Open the sync link it shows on another device (or paste it into **Join**) and that device's existing entries merge in. After that, adds, edits and deletes sync both ways, and each device keeps working offline and catches up when it reconnects.

- Every device needs Tailscale connected to sync; the server only accepts connections from this site's origin. The doc is stored unencrypted on the mac-mini. Keep backups on.
- The library (`@automerge/vanillajs` via esm.sh, wasm via jsDelivr, both version-pinned) loads only once sync is on, and the service worker caches it so sync also starts on an offline open.
- Theme, report range and backup settings stay per-device.
