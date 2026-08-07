# Pharmakon

**A stimulant-cycling tracker that keeps you honest.**

A single-page dose log in the style of [Meridian](https://github.com/DrakeMorrison/meridian) and [Gnomon](https://github.com/DrakeMorrison/gnomon): no install, no account, no server. Named for the Greek word that means both remedy and poison — the difference being only dose and timing, which is exactly what this app tracks. Everything lives in your browser.

[**Live app →**](https://drakemorrison.github.io/pharmakon/)

---

## The protocol

Two stimulants, nicotine and caffeine, cycled so neither gets a chance to become a habit:

1. **Same substance: 4 days apart.** Nicotine on day 1 means no nicotine until day 5.
2. **Never two stimulant days in a row.** Any dose means the next day is a rest day, whatever the substance.

The intended rhythm is nicotine · rest · caffeine · rest · repeat — but the app never assumes the calendar. Eligibility is always computed from your *actual* last doses, so if you skip a day (or a week), the schedule self-adjusts and tells you what's allowed when you pick back up.

## Honesty model

The app never blocks a dose. Logging one that breaks a rule asks you to confirm first — naming the rules it breaks and when the substance is next eligible — then records it badged with exactly which rule it broke (same-day repeat · consecutive stimulant day · same substance too soon). Violations are derived from the log at render time, never stored — correct an entry's timestamp and the whole history reclassifies.

## Features

- **Today card** — what's eligible right now, which substance is suggested (least recently used), or the per-substance countdown on rest days
- **One-tap logging** — a dose button per substance with editable mg presets, plus an optional note
- **Horizon strip** — the last 14 days and next 7 at a glance: what was taken, violation days, and forecast eligibility
- **Honest log** — reverse-chronological entries with violation badges; tap to edit time/substance/dose or delete
- **Stats** — clean streak, doses per substance, violations, average interval
- **Import / Export** — CSV for portability and analysis elsewhere
- **PWA** — installable, works offline
- **Light and dark themes**
- **Keyboard shortcuts** — `1` log nicotine, `2` log caffeine, `N` focus note, `S` settings, `E` export, `I` import, `Escape` close

## Usage

Open `index.html` (or serve the directory) and log your first dose. On mobile, use "Add to Home Screen" to install it as an app.

## Data

Everything stays in your browser via `localStorage`. Nothing is sent anywhere. Use Export CSV to back up or move your data — columns are `id,timestamp,iso,sub,dose,note` with millisecond epoch timestamps. Violations are intentionally not exported: they are always recomputed from the doses themselves.

*This is a personal logging tool, not medical advice.*
