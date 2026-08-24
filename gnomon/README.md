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
- **PWA** — installable, works offline
- **Light and dark themes**
- **Keyboard shortcuts** — `/` focus input, `X` stop, `S` settings, `E` export, `I` import, `Escape` close

## Usage

Open `index.html` (or serve the directory) and log the first activity. On mobile, use "Add to Home Screen" to install it as an app.

## Data

Everything stays in your browser via `localStorage`. Nothing is sent anywhere. Use Export CSV to back up or move your data — columns are `id,timestamp,iso,kind,text` with millisecond epoch timestamps.
