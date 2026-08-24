# Halteres

**A Simple & Sinister kettlebell log that carries you to the next bell.**

A single-page practice log in the style of [Meridian](https://github.com/DrakeMorrison/meridian), [Gnomon](https://github.com/DrakeMorrison/gnomon), and [Pharmakon](https://github.com/DrakeMorrison/pharmakon): no install, no account, no server. Named for the *halteres* (ἁλτῆρες), the stone and lead weights ancient Greek athletes swung and lifted — the kettlebell's oldest ancestor. Everything lives in your browser.

[**Live app →**](https://drakemorrison.github.io/halteres/)

---

## The practice

Pavel Tsatsouline's Simple & Sinister, done most days without a clock:

1. **100 one-hand swings** — 10 sets of 10
2. **10 Turkish get-ups** — 5 per side, singles

Progress happens by **step-loading in pairs**: move two sets at a time from your bell to the next bell up — 2, then 4, then 6… When all ten sets are at the heavier bell, it *is* your bell, and the counter starts again toward the next one. The app's session form is exactly that — a bell picker plus a "sets at the next bell" counter, prefilled from your last session so the default action is *do what you did last time*, and progression is one tap on `+` (which adds a pair).

And when you've been at the same load for **four weeks with at least 70% of days practiced**, a notice appears telling you it's time to move up — with a one-tap button that adds the next pair to today's plan. Any change in your logged work (a pair added, a bell graduated, even a step back) resets that clock.

Test rarely. The standard is 100 swings in 5:00 and 10 get-ups in 10:00 with the goal bell — **Simple** at 32 kg, **Sinister** at 48 kg (both configurable, so the women's standards or any custom goal work too).

## Features

- **Today card** — practiced or ready, days since the last session, and the plan for today's session
- **Move-up nudge** — after 4 weeks at the same load with ≥70% attendance, a notice with a one-tap "+2 @next bell" button
- **One-tap logging** — bell chips per exercise, a step-load counter, an optional timed-test mode with m:ss entries, and a note
- **Progression cards** — current bell → next bell with a 10-set progress bar, best full session, last test time, and the goal standard; a banner when both standards are met
- **Horizon strip** — the last 28 days at a glance: full sessions, partial sessions, and test days
- **Stats** — sessions this week, 4-week average per week, total sessions, total tonnage
- **Honest log** — reverse-chronological sessions with test badges (green when the time standard was met); tap to edit time/work/times or delete
- **Beeminder** — optionally posts a datapoint per session (1, swing reps, or tonnage) straight from the browser; edits re-post, deletes zero out, offline sessions queue until you're back
- **Import / Export** — CSV for portability and analysis elsewhere
- **PWA** — installable, works offline
- **Light and dark themes**
- **Keyboard shortcuts** — `L` log session, `T` toggle timed test, `N` focus note, `S` settings, `E` export, `I` import, `Escape` close

## Usage

Open `index.html` (or serve the directory), set your bells in settings (default 16, 24, 32 kg), and log your first session. On mobile, use "Add to Home Screen" to install it as an app.

## Data

Everything stays in your browser via `localStorage`. Nothing is sent anywhere — unless you configure the Beeminder integration in settings, in which case session datapoints (and your auth token, stored locally) go directly from your browser to `beeminder.com` via its CORS-enabled API. Each session maps to one datapoint by `requestid`, so editing a session updates its datapoint and deleting one zeroes it out. Use Export CSV to back up or move your data — columns are `id,timestamp,iso,swings,getups,test,swings_time,getups_time,note`, with work encoded as `weight×count` terms (`24x8+28x2` = 8 sets at 24 kg and 2 at 28 kg) and test times in seconds.

*This is a personal logging tool, not coaching or medical advice.*
