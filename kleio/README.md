# Kleio

**Learn history by building a timeline: place each event, then recall one detail about it.**

A single-page study app in the style of [Meridian](../meridian/), [Halteres](../halteres/) and [Peira](../peira/): no install, no account, no server. Named for *Kleio* (Κλειώ), Clio, the muse of history. Everything lives in your browser.

[**Live app →**](https://drakemorrison.github.io/aristeia/kleio/)

The core mechanic is the card game *Timeline*. You draw an event with its date hidden, then tap the gap in your timeline where it belongs. Spaced repetition decides which cards you draw, and every reveal asks one question about the event, so you learn what happened as well as when.

---

## Two memories per card

A card is graded twice, and the two grades are scheduled independently:

| Memory | Graded by | Grades |
|---|---|---|
| **When** | where you placed it | right gap: good · one gap off and within 25 years: hard · otherwise: again |
| **What** | the detail question (who, where, what resulted), self-graded | knew it: good · forgot: again |

Intervals grow SM-2 style: a first success waits 1–2 days, then about 4, then the previous interval times the card's ease (2.5 to start, lowered by hard and again answers). A lapse resets that memory to one day. A card is due when either memory is due.

## Review and Run

Both are the same loop: draw an event with its date hidden, tap the gap where it belongs, then answer one detail question.

- **Review**: today's due cards plus up to *N* new ones (5, 10, 20 or 30 a day), placed into a timeline seeded with a few cards you already know. The timeline grows as you go. This is the daily habit.
- **Run**: the board game. Start from one card and keep placing until you collect three strikes (configurable). Once the timeline has six cards, draws favour events that fall into narrow gaps, so a run gets harder the longer it lasts. Best streak is tracked.

Runs draw cards that may not be due, so they reschedule a memory only if it was due or new; a miss always counts, so playing for fun can't inflate an interval.

## Cards and decks

The starter deck is about 160 world-history events from the Great Pyramid to Lehman Brothers, each with a region, a line of context and one detail question. You can edit or delete any of them (deleted starter cards can be restored in settings) and add your own.

Decks can be switched off; their progress is kept. To add a deck, paste JSON into the Cards panel:

```json
[
  {
    "title": "Treaty of Kanagawa",
    "y": 1854, "m": 3, "d": 31,
    "region": "Japan",
    "deck": "Meiji",
    "blurb": "Japan opens two ports to American ships.",
    "details": [{ "q": "Who signed for the United States?", "a": "Matthew Perry" }]
  }
]
```

`title` and `y` (negative for BCE) are required. `y2` makes the card a span (a reign, a war, a geological period); spans are placed by their start year. Years can be as old as the Big Bang, and the editor accepts "541 million BC" or "200,000 BC". `m`, `d`, `c` (circa), `region`, `deck`, `blurb`, and `details` are optional. Events with no month count as ties with anything else in the same year. The panel's **Copy a prompt for an AI** button copies a prompt that asks for exactly this format.

## Logs, Beeminder, backup

- **Sessions**: every review and run is logged with cards played, placements right, details recalled and new cards met. The home screen shows a 28-day horizon, day streak, and 30-day *when* and *what* hit rates.
- **Beeminder**: one datapoint per session (1, cards played, or cards placed right; every mode or reviews only), posted straight from the browser with a requestid derived from the session, so re-posting updates rather than duplicates. Deleting a session zeroes its datapoint, and offline sessions queue.
- **Resume**: the session in progress is saved after every step, so a killed app reopens on the same card.
- **Data**: JSON export/import of your own cards, all progress and the session log (merging on import, never overwriting newer progress); CSV export of the session log; daily or weekly backup reminders.

## Keys

Home: `R` review · `G` run · `C` cards · `S` settings · `I` import.
Playing: `↑` `↓` pick a gap · `Enter` place · `Space` show answer · `1` forgot · `2` knew it · `Q` end.
