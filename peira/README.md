# Peira

**Blinded, randomised N-of-1 self-experiments — with Bayesian evidence instead of p-values.**

A single-page experiment runner in the style of [Meridian](../meridian/), [Gnomon](../gnomon/), and [Pharmakon](../pharmakon/): no install, no account, no server. Named for *peira* (πεῖρα), the Greek for a trial or an attempt — the root of *empirical* and, through Latin, of *experiment*. Here the trial is on yourself, and a lot decides which jar you take from each day. Everything lives in your browser.

[**Live app →**](https://drakemorrison.github.io/aristeia/peira/)

Inspired by [n1.tools](https://n1.tools): the same "randomise what you take, log the outcome, let the numbers speak" loop, but with real blinding and a Bayesian readout.

---

## The idea

Does the supplement / routine / gadget actually do anything *for you*? Tracking alone can't answer that — you always know what you took, and expectation does the rest. Peira runs the experiment properly:

1. **Randomised.** Each period (a day by default) is drawn by lot, in balanced pairs so the two arms stay even.
2. **Blinded.** The app never learns which jar holds what. It only speaks in `jar 1` / `jar 2`; you find out at the end.
3. **Bayesian.** When you unblind, the evidence is reported as a Bayes factor, the probability and odds that the intervention is better, a credible interval, and a likelihood-ratio curve. No p-values, and since the analysis is Bayesian you can look as often as you like.

## Blinding without a helper

The trick is that the *mapping* is the only secret, and one physical shuffle hides it:

1. Make the intervention and the control indistinguishable (identical capsules, identical containers).
2. Put one in each of two identical jars. Hide a slip inside each lid naming its contents.
3. Shuffle the jars until you've lost track. Stick on the labels **1** and **2**.
4. Each day the app tells you which jar. You take from it, log the outcome, and — optionally — guess which condition it was.
5. When you stop, open the slips and tell the app which condition was in jar 1. It reveals the whole allocation and analyses by condition.

The draft screen prints these steps with your own words filled in, including how many doses to stock. The schedule itself is stored base64-encoded so a glance at a backup file can't unblind you by accident, and only days that have already happened are ever shown.

## Design options

- **Period length** — 1 day is the classic daily coin flip; longer periods suit slow-acting interventions. With multi-day periods the analysis uses period means, because the period is what was randomised.
- **Number of periods** — fixed, or `0` for open-ended: keep going and stop when the evidence is strong enough. Lots are drawn in balanced pairs as you go.
- **Washout days** at the start of each period, still logged but excluded from analysis.
- **Balanced pairs** (AB or BA per pair of periods) or a **simple coin flip**.
- **Outcomes** — up to six per experiment: a rating scale (chips), a free number with a unit, or yes/no. The first is the primary.
- **Skipped days** are excluded; the optional daily guess feeds the blinding check.

## The evidence

For each outcome, comparing intervention to control:

- **Bayes factor BF₁₀** — the JZS default Bayes factor (Rouder et al. 2009): a Cauchy prior on the standardised effect size, scale 0.707 by default (0.5 and 1.0 available in settings). Labelled on the usual anecdotal / moderate / strong / very strong / extreme scale; shown as BF₀₁ when it favours no effect.
- **P(intervention higher)** and its **odds** — from the posterior of the mean difference under flat priors on the means and Jeffreys' prior on σ (a t distribution centred on the observed difference), with a **95% credible interval**.
- **Likelihood ratios** — how many times more likely the data are under the best-fitting effect than under no effect, the full LR curve across hypothesised effects, and the **1/8 likelihood interval** (effects at least ⅛ as well supported as the best).
- **Blinding check** — how often your daily guesses were right, and the posterior probability you were guessing better than chance. If the blind leaked, the card says so.

While the experiment runs, an optional **blinded interim** card shows the Bayes factor for "the two jars differ" — the Bayes factor is symmetric in direction, so peeking can't tip you off which jar is which. A common stopping rule is to keep going until BF₁₀ passes 10 (or drops below 1/10).

The Bayes factor integral, t-distribution, and incomplete beta are implemented in the page itself and were checked against an independent numerical integration of the underlying model.

## Features

- **Today card** — day and period counters, which jar to draw from, one-tap *taken* / *skip*, the outcome form, a guess, and a note
- **Lots strip** — every day of the experiment grouped by period: which jar (or, once unblinded, which condition), washout hatching, a dot when the outcome is logged; tap any past day to edit it
- **Interim evidence** — direction-free Bayes factor per outcome while blinded
- **Results** — hero numbers, a plain-language verdict, an outcome-over-time chart with condition means, and the likelihood-ratio curve
- **Multiple experiments** — drafts, running, and unblinded side by side; repeat an old one as a fresh draft
- **Import / Export** — JSON for all experiments (schedules stay encoded), CSV day table per experiment
- **Backup reminders** — off / daily / weekly, Meridian-style
- **PWA** — installable, works offline
- **Light and dark themes**
- **Keyboard shortcuts** — `T` mark today taken, `N` new experiment, `S` settings, `E` export CSV, `I` import JSON, `Escape` close

## Data

Everything stays in your browser via `localStorage`. Nothing is sent anywhere. The CSV columns are `day,date,period,<label>,condition,washout,taken,skipped,guess,<one column per outcome>,note`; the condition column is only filled once unblinded.

*This is a personal experimentation tool, not medical advice. Don't blind yourself to anything you'd need to know in an emergency.*
