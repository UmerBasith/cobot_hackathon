# UI rules — make it look like a funded startup, not a student project

## Must do
1. **Rebrand first** (2 min): `src/config.ts` (name, tagline, headline with ONE highlighted phrase, features, steps,
   stats), `index.html` `<title>`, `--brand-hue` in `src/index.css`. Search the code for "NovaSense" and replace.
2. **Pick colour by domain** (`--brand-hue` / `--accent-hue`):
   health 185/150 · agriculture 150/95 · energy 75/30 · safety/security 15/265 · finance 160/230 ·
   education 250/195 · robotics/industry 265/195 (default) · environment 145/195 · city/transport 230/170.
3. Use kit components only. Spacing: cards `p-5`/`p-6`, grids `gap-4`/`gap-5`, page max width `max-w-6xl`/`max-w-7xl`.
4. Every page has: a clear title (PageIntro), real-looking numbers, at least one chart or visual, one primary action.
5. Every async action shows a state: loading (Button `loading`, Skeleton), success (toast), empty (EmptyState), error (toast).
6. Real content only: realistic Indian context names/places/values (Chennai, ₹, lakh where natural). No lorem ipsum.
7. Status colours are semantic: green good, amber watch, red bad (`statusColors`, Badge tones).
8. Motion is subtle: Reveal/Stagger on landing sections, CountUp on numbers. Nothing bouncy or slow (> 0.8 s).
9. Must work at 1366×768 and 1920×1080 (projectors). Check no horizontal scroll. Mobile is a bonus.
10. Dark mode works out of the box via the toggle — check the main page once in dark.

## Must NOT do
- No Streamlit, no Bootstrap, no default unstyled HTML forms or tables.
- No more than 2 font families (kit uses Space Grotesk headings + Inter body + JetBrains Mono labels).
- No emoji as UI icons (use lucide-react). No random gradients everywhere — gradient only on the one highlight phrase,
  brand buttons and the CTA band.
- No walls of text. Max ~2 lines per card description.
- Don't leave the /kit page or example pages (Simulation/Assistant/Settings) in the nav unless they fit the product.
  Remove or rename them in `appNav` (AppShell.tsx) and routes (App.tsx).

## Landing page formula (already built in sections/Landing.tsx — just fill config.ts)
Hero (badge + 2-line headline with gradient phrase + subline + 2 buttons + live preview card) →
Features (6 cards) → How it works (3 steps) → Impact (4 count-up stats) → CTA band → Footer with team.
Customise the HeroPreview mini-cards in Landing.tsx to show THIS product's data.

## Dashboard formula
Row 1: 4 StatTiles · Row 2: main chart (2/3) + breakdown donut (1/3) · Row 3: the hero interaction
(form/sliders → result with RingGauge + reasons + recommendation) · Row 4: table of records / history.
