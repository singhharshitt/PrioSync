# PrioSync Design System

Extracted from the codebase (`client/src/index.css`, live components) - not
aspirational. New UI must follow this; deviations need a reason.

## Typography

| Role | Face | Usage |
|---|---|---|
| UI / body | Inter 400-800 (`--font-sans`, app default) | Dashboards, tables, numbers, forms, small text |
| Headings | Plus Jakarta Sans 600-800 (`--font-display`, `h1-h3` rule) | Page titles, feature headings |
| Technical data | IBM Plex Mono 400-600 (`--font-mono`) | Scores, timers, IDs, durations, states - never prose |
| Brand only | Chillax (`chillax-*`, local files) | The "PrioSync" wordmark. Nothing else. |

## Color (from `:root` tokens)

- Brand: `--color-orange #FC703C`, `--color-cherry #5D0703`
- Surfaces: cream `#F4F3E6`, dark `#2B1B17`, ink `#1F1F1F`, muted `#4A3A36`
- Text: heading `#2B1B17`, body `#4A3A36`, light `#6B5B56`, inverse `#FFFFFF`
- Signal: success `#22c55e`, warning `#f97316`, error `#ef4444`, info `#3b82f6`
- Priority tiers: critical `#ef4444`, high `#f97316`, medium `#eab308`, low `#22c55e`
- Status: completed `#22c55e`, in-progress `#FC703C`, pending `#EEA175`

## Shape and depth

- Cards: `rounded-2xl`/`rounded-3xl`, warm hard shadows (`4px 4px 0 #452215`),
  thin borders (`border-[#FC703C]/10` on dark, `border-[#2B1B17]/5` on light).
- Pills/chips: `rounded-full`, 10-12px black uppercase labels.
- Numbers that matter render in Plex Mono with `tabular-nums`.

## Principles (enforced in review)

`calm, dark, focused, high information density, clear hierarchy, minimal
decoration, premium SaaS, technical but approachable.`

- One screen answers one decision ("What should I do now?" / "Am I on track?").
- No giant gradients, no glassmorphism piles, no neon, no sparkle confetti.
- Icons come ONLY through `components/icons/PrioIcon.jsx` (semantic names
  preferred: `task`, `bottleneck`, `criticalPath`...; vendored asset keys are
  allowed). Assets are local Tabler/Simple Icons paths in
  `components/icons/iconAssets.jsx` - raw imports of any icon package, or any
  new `<svg>` markup, are a review flag.
- Copy follows `docs/PRODUCT_WRITING_GUIDELINES.md` (numbers over adjectives).
- Mobile: grids collapse to one column, tap targets stay reachable, no
  horizontal scroll (`overflow-x-hidden` shells, `h-dvh` viewports).

## Change process

New patterns (cards, charts, flows) get built once, then reused - see
`StatCard`, `TaskCard`, `DependencyGraph`, `InsightStrip`, `DeviationsCard`,
`DayPlanCard`, `WhatIfPanel`, `PlanHistory`. Generated mockup code is
translated into these primitives; it is never pasted in.
