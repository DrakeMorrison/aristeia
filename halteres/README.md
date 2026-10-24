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

**Every second or third day**, the book says, swap the one-hand swings for two-hand swings with the same bell — active rest for the grip and back. Pick the cadence in settings (default every 3rd day, or off) and the swings card defaults to two-hand on the day it comes due, counted in practice days so a week off doesn't spend the rest. Two-hand days are tracked in the log and horizon but don't drive progression: the plan, "best full session", the move-up clock, and the test all read one-hand work only.

And when you've been at the same load for **four weeks with at least 60% of days practiced**, a notice appears telling you it's time to move up — with a one-tap button that adds the next pair to today's plan. Any change in your logged work (a pair added, a bell graduated, even a step back) resets that clock.

## Off days: bodyweight strength aerobics

Some days the bells aren't there. Switch to the **bodyweight** tab (or press `B`) and log a strength-aerobics session instead. It uses pistols, one-arm push-ups and pull-ups, worked in **ladders**: 1 rep of each exercise in turn, then 2 of each, then 3 of each, then back to 1. One climb to the top rung is one ladder. Keep every set far from failure and rest until you can breathe through your nose again. The work stays aerobic and you finish fresher than you started.

Each exercise card has a top rung (default 3) and a free-text **variation** (feet-elevated, +8 kg, archer…). Below the cards is a ladder counter and an optional duration. Like the kettlebell form, everything is prefilled from your last session. A strength-aerobics card under Progression shows, for each exercise, the current variation, how many sessions you've done at it, and your last and best volume at it. The intended way to progress is a harder variation, not grinding out more reps. These days show orange in the horizon strip and appear in the log and CSV. They post to Beeminder too: 1 with the per-session metric, 0 with swing reps or tonnage, so the day still shows on the goal. They don't count toward S&S attendance, the move-up clock or the stats strip, so an off day never moves your kettlebell progression.

## Barbell days: GZCLP

For stretches when you can only lift about three times a week, the **barbell** tab (or `G`) runs [GZCLP](https://www.reddit.com/r/Fitness/wiki/gzclp/). Four full-body workouts rotate A1 → B1 → A2 → B2, and the app always offers the next one, however long it's been. Missed days don't break anything, and you can still pick a different workout from the chips.

| Workout | T1 (heavy) | T2 (volume) | T3 (accessory) |
|---|---|---|---|
| A1 | squat | bench press | lat pulldown |
| B1 | overhead press | deadlift | dumbbell row |
| A2 | bench press | squat | lat pulldown |
| B2 | deadlift | overhead press | dumbbell row |

T1 is 5×3+, T2 is 3×10 and T3 is 3×15+. The + marks an as-many-reps-as-possible last set. Each card has the scheme, the weight (− / ＋ or type it, with plates per side for barbell lifts), made ✓ / missed ✕, and the reps on the last set. The app works out every plan from the log:

- **Made it** → same scheme, more weight: +5 kg / 10 lb on squat and deadlift, +2.5 kg / 5 lb on bench and press.
- **Missed** → same weight, next scheme: T1 5×3 → 6×2 → 10×1, T2 3×10 → 3×8 → 3×6.
- **Missed the last scheme** → reset. T1 goes back to 5×3 at 85% of the weight. The original program tests a new 5-rep max and takes 85% of that, so override the weight if you do that. T2 goes back to 3×10, 7.5–10 kg (15–20 lb) above where its last 3×10 run began.
- **T3** adds weight once the last set reaches 25 reps.

Editing or deleting a session re-derives everything after it. A barbell card under Progression shows each lift's next T1 and T2, an Epley e1RM from your best T1 last set, and the T3 targets. Weights are in kg or lb (settings); switching converts the history and rounds it to your plates. Barbell days show purple in the horizon and appear in the log and CSV. On Beeminder they count like strength-aerobics days. The S&S engine and stats ignore them.

Test rarely. The standard is 100 swings in 5:00, one minute of rest, then 10 get-ups in 10:00 with the goal bell — **Simple** at 32 kg, **Sinister** at 48 kg (both configurable, so the women's standards or any custom goal work too).

## Features

- **Today card** — practiced or ready, days since the last session, and the plan for today's session
- **Move-up nudge** — after 4 weeks at the same load with ≥60% attendance, a notice with a one-tap "+2 @next bell" button
- **Two-hand days** — a one-hand / two-hand toggle on the swings card that flips to two-hand when it's due, with a countdown in the today card
- **One-tap logging** — bell chips per exercise, a step-load counter, an optional timed-test mode with m:ss entries, and a note
- **Progression cards** — current bell → next bell with a 10-set progress bar, best full session, last test time, and the goal standard; a banner when both standards are met
- **Horizon strip** — the last 28 days at a glance: one-hand sessions, partial sessions, two-hand days, test days, bodyweight days, and barbell days
- **Barbell mode** — GZCLP's four-workout A/B rotation with automatic T1/T2/T3 progression, stage changes and resets, plates per side, and e1RM tracking
- **Bodyweight mode** — strength-aerobics ladders (pistols, one-arm push-ups, pull-ups) for off days, with per-exercise variation tracking
- **Stats** — sessions this week, 4-week average per week, total sessions, total tonnage
- **Honest log** — reverse-chronological sessions with test badges (green when the time standard was met); tap to edit time/work/times or delete
- **Beeminder** — optionally posts a datapoint per session (1, swing reps, or tonnage) straight from the browser; edits re-post, deletes zero out, offline sessions queue until you're back
- **Import / Export** — CSV for portability and analysis elsewhere
- **PWA** — installable, works offline
- **Light and dark themes**
- **Keyboard shortcuts** — `L` log session, `T` toggle timed test, `B` kettlebell / bodyweight, `G` kettlebell / barbell, `N` focus note, `S` settings, `E` export, `I` import, `Escape` close

## Usage

Open `index.html` (or serve the directory), set your bells in settings (default 16, 24, 32 kg), and log your first session. On mobile, use "Add to Home Screen" to install it as an app.

## Data

Everything stays in your browser via `localStorage`. Nothing is sent anywhere — unless you configure the Beeminder integration in settings, in which case session datapoints (and your auth token, stored locally) go directly from your browser to `beeminder.com` via its CORS-enabled API. Each session maps to one datapoint by `requestid`, so editing a session updates its datapoint and deleting one zeroes it out. Use Export CSV to back up or move your data — columns are `id,timestamp,iso,swings,getups,test,swings_time,getups_time,note,two_hand`, with work encoded as `weight×count` terms (`24x8+28x2` = 8 sets at 24 kg and 2 at 28 kg) test times in seconds, and `two_hand` as 0/1 (older exports without the column import fine). Bodyweight sessions share the file as `kind=bw` rows, with `ladders`, `duration` (seconds), and a `<exercise>_top` / `<exercise>_variation` pair per exercise (empty top = skipped). Barbell sessions are `kind=bb` rows with `day`, `unit`, and `barbell`, the lifts as `lift:tier:scheme:weight:made:last-set-reps` joined by `;` (`squat:1:0:60:1:7;bench:2:0:40:1:0`, where scheme 0 is the first rep scheme for that tier).

*This is a personal logging tool, not coaching or medical advice.*
