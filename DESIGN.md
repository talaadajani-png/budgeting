# Design System — Budget & Finance Tracker

Visual direction taken from the user's reference dashboard (warm, pastel, rounded, friendly fintech).

## Palette
- `--bg`: warm ivory/cream `#F5F1E8`
- `--surface`: card background, slightly lighter/neutral `#FBF9F4` / `#EFEBE1`
- `--ink`: near-black for text + primary buttons `#1A1A1A`
- Accents (pastel, used as card fills + donut segments):
  - blush pink `#F4C6D7`
  - periwinkle blue `#BCC8F0`
  - butter yellow `#F2DE9E`
  - soft green (positive amounts) `#C7E3A4`
- Status badge tints: requested=blue, paid=pink, sent=green (reuse accent tints)

## Shape & type
- Card radius: ~24px (`rounded-3xl`), pills fully rounded (`rounded-full`)
- Soft shadows: low-opacity, large blur
- Display numbers: large, bold, tight tracking
- Buttons: black pill with light text; secondary = light pill with ink text

## Layout (dashboard `/`)
- Top bar: rounded search field with pill filter chips; right-side circular icon buttons (profile, notifications, settings)
- Title: "Your finances"
- Left column:
  - Hero donut chart, large total balance centered (e.g. "23.4k")
  - Period selector pill ("This week ▾")
  - Three stacked stat cards (pink / blue / yellow) each: icon + label, big number, ±% delta badge, small subtitle
- Right column:
  - "Accounts" or "Upcoming bills" cards row (black pill action button)
  - "Latest transactions" cards row with green/red amount badges
  - Filter tabs pill row (All / per account)
  - Transactions table: Type, Date, Name, Amount, Category/Recipient, Status (colored pill), action icons

## Budgeting semantics
- Donut center = total balance across linked accounts; segments = spending by category this month
- Stat cards = Income this month / Spending this month / Budget remaining
- Green amount = money in (income), red/ink = money out (spend)
