# Design: Cadrel reporting desk

The app and landing page share one fictional product brand. Cadrel is a made-up name (from "CAT" and
"dossier") for a reporting-control product used by the fictional broker-dealer Northwind Securities.
It is not a real product or company.

## Audience and voice

Regulatory reporting analysts, their managers, and compliance reviewers at a broker-dealer. They work
against a clock (files due 08:00 ET, repairs due in three trading days) and live in IDs, codes and
timestamps.

Voice: calm, exact, operational. Short labels, real units, no exclamation marks. Say what the system
found and what a person decides ("12 executions in the books never reached the feed"), never promise
outcomes. Monospace for every identifier, code and timestamp so they read like the records they are.

## Logo mark

A rounded square holding three event ticks on a rail, the last one offset, like an order lifecycle with
one event out of sequence. Inline SVG (`components/Logo.tsx`, `docs/index.html`):

```svg
<svg viewBox="0 0 32 32" aria-hidden="true">
  <rect width="32" height="32" rx="8" fill="#FFB020"/>
  <path d="M6 20h20" stroke="#14110A" stroke-width="2" stroke-linecap="round"/>
  <rect x="8" y="11" width="3" height="9" rx="1.5" fill="#14110A"/>
  <rect x="14.5" y="13" width="3" height="7" rx="1.5" fill="#14110A"/>
  <rect x="21" y="8" width="3" height="8" rx="1.5" fill="#14110A"/>
</svg>
```

Wordmark: "Cadrel" in IBM Plex Sans Condensed SemiBold, followed by a muted "reporting desk".

## Direction: the control room

Dark-first, like the screens on a trading-floor operations desk: graphite surfaces, one warm signal
colour that means "needs you now", and hairline structure instead of shadows. A light theme exists for
daytime and printing, with the same tokens.

### Palette (dark default / light)

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#0B0E13` | `#F4F2EC` | Page |
| `--surface` | `#12161D` | `#FFFFFF` | Panels |
| `--surface-2` | `#1A1F28` | `#ECE9E1` | Table heads, inputs, chips |
| `--line` | `#262C37` | `#D9D4C7` | Hairlines |
| `--text` | `#E8EAEE` | `#16181D` | Body |
| `--text-2` | `#A9B0BC` | `#4A4F59` | Secondary |
| `--muted` | `#8A92A0` | `#646A75` | Captions, axes |
| `--signal` | `#FFB020` | `#9A5B00` | Deadlines, primary action, focus |
| `--ice` | `#7CC4FF` | `#1F5F9E` | Data series 1, links |
| `--mint` | `#5BE49B` | `#17784A` | Pass, repaired |
| `--coral` | `#FF7A6B` | `#B23A2C` | Fail, reject, anomaly |
| `--violet` | `#B59CFF` | `#5B44B8` | AI only (buttons, panels, badges) |

Chart series by error code: LNK-01 coral, SEQ-02 signal, FLD-03 violet, LTE-04 ice. Contrast for every
text token on `--bg`, `--surface` and its tinted pill is checked by `scripts/check-contrast.mjs`
(WCAG AA, 4.5:1 for text).

### Typography

- IBM Plex Sans Condensed (600/700) for headings, KPI numbers and the wordmark.
- IBM Plex Sans (400/500/600) for body and UI.
- IBM Plex Mono (400/500) for IDs, codes, timestamps, SQL and table numbers.

All three are OFL-licensed and self-hosted by `next/font` (the landing page reuses the built woff2
files from `docs/fonts/`, with the license). No CDN.

### Layout model

- **Top navigation**, not a sidebar: brand left, six section tabs, then environment badge (Sample or
  Live), role chip ("Reporting analyst · TRV_DEMO_ROLE") and theme toggle on the right. Under 1024 px
  the tabs collapse into a sheet menu.
- **Deadline strip** under the nav on every screen: business clock, the next file deadline and the
  oldest open repair deadline with a live countdown, like a departures board.
- Content in a 12-column grid, max width 1440 px. Work screens use a list/detail split; the detail opens
  as a right-hand drawer on phones.

### Density, charts and motion

- Dense: 13 px table text, 36 px rows, tabular mono numerals. KPI tiles carry a sparkline and a delta
  against the prior trading days.
- Charts (Recharts): no gridline boxes, a single baseline, mono tick labels, tooltips on a solid surface,
  a legend on every multi-series chart. Anomaly charts draw the expected band as a faint ice fill.
- Motion: 160–220 ms ease-out transitions, counters that count up once on first paint, shimmer
  skeletons while loading, a drawer that slides in, and AI text that streams in word by word after
  staged steps. All motion stops under `prefers-reduced-motion`.

## How this differs from the catalog

Reviewed on 2026-11-20: Odometer (auto finance), Workforce Intelligence, Trade Surveillance, AML
Transaction Monitoring, Credit Risk Model Studio, Cross-Border FX and Cyber Risk Copilot, landing pages
and Try apps.

- They use a light or cream canvas, most with a dark left sidebar and a serif or gradient headline
  (Odometer green gradient, Workforce teal-to-coral serif), or a blue gradient hero (Trade
  Surveillance, Cross-Border FX). Cadrel is dark-first with **top navigation** and no sidebar.
- No gradient type and no blob backgrounds. The one accent is a flat **signal amber**, which no listed
  pack uses as its primary.
- Condensed sans plus mono gives a terminal and ticket feel; no other pack uses a condensed or mono-led
  type system.
- The landing hero is a **departures-board** panel of the deadline strip and file status, not a
  screenshot in a browser frame or a centred gradient banner.
