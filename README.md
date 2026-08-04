# Sundial

**One-tap timestamped activity logging.**

A single-page activity log in the style of [Meridian](https://github.com/DrakeMorrison/meridian): no install, no account, no server. Log what you're doing in one tap, and Sundial turns the timestamps into a report of how much time went where. Everything lives in your browser.

---

## How it works

Each log entry marks the **start** of an activity. Its duration runs until the next entry — so switching tasks is a single tap, and the clock never needs starting or stopping per task. Press **■ stop** when you're done tracking (breaks, end of day).

## Features

- **One-tap logging** — your recent activities become chips; tapping one logs it instantly. New activities are a quick type-and-enter.
- **Live "now" banner** — what you're doing and for how long, with a stop button
- **Reports** — time per activity (with share bars and percentages) for Today / Yesterday / 7 Days / 30 Days / All, plus a plaintext **Copy** button for pasting into notes or messages
- **Editable log** — tap any entry to adjust its time or text (forgot to log a switch? fix the timestamp), or delete it
- **Stats** — time tracked today, entries today, distinct activities, day streak
- **Import / Export** — CSV export and import for portability and analysis elsewhere
- **PWA** — installable, works offline
- **Light and dark themes**
- **Keyboard shortcuts** — `/` focus input, `X` stop, `S` settings, `E` export, `I` import, `Escape` close

## Usage

Open `index.html` (or serve the directory) and log your first activity. On mobile, use "Add to Home Screen" to install it as an app.

## Data

Everything stays in your browser via `localStorage`. Nothing is sent anywhere. Use Export CSV to back up or move your data — columns are `id,timestamp,iso,kind,text` with millisecond epoch timestamps.
