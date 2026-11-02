# Keryx

**A small feed reader: one unread list across your RSS and Atom feeds.**

A single-page app in the style of [Meridian](../meridian/) and [Gnomon](../gnomon/): no install, no account, no server. Named for the *keryx* (κῆρυξ), the herald who carried news between cities. It starts subscribed to [Vitalik Buterin's blog](https://vitalik.eth.limo/).

[**Live app →**](https://drakemorrison.github.io/aristeia/keryx/)

---

## How it works

- **Feeds are fetched when you open keryx**, and again when you come back to it after half an hour. There is no background polling, because a page can't run while it's closed. Press ↻ to check now.
- **Fetching happens in your browser**, straight from each site. That only works if the site allows cross-origin reads (it sends `Access-Control-Allow-Origin`). Vitalik's feed does. A feed that doesn't shows an error under its name; it would need a proxy.
- **Tapping a title opens the post** on its own site and marks it read. The dot beside a post toggles read/unread. Feeds that include text show a short plain-text snippet. Feed HTML is never rendered, so nothing a feed contains can run in the page.
- **A newly added feed's back catalogue starts read.** Only posts from the last 30 days come in unread.
- **The app badge and tab title show the unread count**, where the platform supports it.

## Sync

Subscriptions and read marks sync through the shared aristeia link (see the [root README](../README.md#sync)). Fetched posts are cached per device and refetched on each one.

## Keys

`R` refresh · `A` mark all shown read · `U` toggle unread/all · `S` feeds & settings · `Esc` close.

## Data

Subscriptions can be exported as OPML from the settings panel, for moving to another reader. localStorage keys: `keryx_feeds`, `keryx_read`, `keryx_cache` (fetched posts), `keryx_view`, `keryx_theme`.
