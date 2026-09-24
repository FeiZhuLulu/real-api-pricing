# Real API Pricing website

React + TypeScript + Vite, with a hand-written SVG chart (no charting library). The website reads the repository's adopted data; it does not fetch live prices or recompute quota adoption. Dataset sizes change over time — the root README carries generated statistics.

## Local development

Requires Node.js 20.19+ or 22.12+.

```sh
cd web
npm ci
npm run dev
```

Open the URL printed by Vite. English is the first-visit default. A saved language preference is used on subsequent visits; an explicit shared URL takes precedence.

```sh
npm test
npm run build
npm run preview
```

## Data adapter

`npm run data` verifies all point IDs, monthly fees, monthly allowances, and real prices against `../data/adopted.csv`, checks configuration references, and writes `public/data/`. `npm run build` runs this adapter, TypeScript, then Vite. The generated data and `dist/` are ignored by Git.

The raw downloads retain the original computed fields. The smaller website dataset omits duplicated per-board summary fields from point records because the complete configurations and explicit mappings carry them separately. Source numbers are unchanged.

## Data and behavior

- Three linked views: price–capability scatterplot, real-price ranking, and monthly-allowance ranking. Every leaderboard stays independent; scores are never mixed across boards.
- All adopted points and all archived benchmark configurations are selected initially. Model selection expands to channels and individual plan/model points. Empty selection is distinct from selecting everything.
- Filters within one category are ORed; categories are ANDed. Harness, effort, and mode filters restrict benchmark references. Plans without matching scores stay in the table and in price/allowance views. Those ranking views use one row per plan/model, with any table score labeled as the highest matching reference.
- The frontier is recomputed for the filtered set with strict dominance. Equal coordinates are grouped only for rendering; every plan/configuration member remains inspectable. Lowest price is on the right. Endpoint extensions cannot imply the highest score at the cheapest price.
- Detail dialogs distinguish quota confidence from mapping confidence, show original adoption evidence, and link to public archives. Original-language evidence is retained; English display labels translate Chinese plan qualifiers without changing IDs or values.
- The table search and sorting affect the table and its CSV, while the global model/filter state affects both chart and table. Tables and rankings scroll inside bounded panels and render progressively as you scroll; CSV and image exports include every matching row.
- Share links serialize state in the URL hash. Removed IDs and invalid settings are ignored with an explicit notice. CSV text is quoted and formula-like text escaped.
- PNG/SVG exports use the current chart. Mobile dialogs fill the screen; long ranking charts and wide tables scroll within their containers.
- Real-price and monthly-allowance ranking views use responsive React rows with comparison bars. Search is shared with the detail table and all filtered rows remain reachable; PNG/SVG exports capture the current view with its range and units labeled.

## Fee bands

Monthly-allowance fee bands share `../config/allowance-fee-bands.json` with Python chart generation. They use adopted USD monthly fees: [0,30], (30,100], (100,300]. "All" retains every allowance, including any future >$300 plan. The `feeBand` hash field is backward compatible and applies only to the allowance view; ranking, detail table, image export and CSV follow it. Regenerate static bands with `python scripts/plot_quotas.py --fee-bands-only`, publish via `python scripts/publish_charts.py --fee-bands-only`, and run `python scripts/checks/verify_fee_bands.py` for independent partition validation.

## Presentation aliases

GLM ¥49/149/469 is presented as v2 and ¥118/538/1078 as v3; v1 has no adopted data and is not fabricated. These are presentation aliases only — source IDs and historical evidence remain unchanged.

Provider marks live in `src/assets/provider-logos/`; unknown vendors fall back to a two-letter monogram.

## Packed mappings

The site payload omits mapping fields that exactly match their referenced configuration. `unpackData` restores them before use; a deep-equality test checks every restored mapping against the original derived data. Complete source downloads remain available.

## Chart engine

The scatterplot is a purpose-built SVG scene, not a charting library.

- **One scene, two renderers.** `Chart.tsx` renders a single `<ChartScene>` SVG with explicit colours: the page mounts it live, and PNG/SVG export renders the same component off-screen at 1200 px (with a title, the numbered key and the embedded DM Sans font), so downloads match the screen. The export uses the current zoom and theme.
- **Geometry lives in `chartScene.ts`** (pure, unit-tested): the reversed log price axis, 1-2-5 log ticks that thin whole decades on narrow plots and skip the unmetered `$0` slot, nice score ticks, and zoom-about-pointer / pan / box-zoom maths. Logos, names and leaders share the chart's coordinate system, so they can never lag a drag.
- **Names take the nearest free slot.** `placeTextLabels` tries above, below, right, left, then the diagonals, at three distances from the marker edge, and scores each candidate on label collisions, covered markers, crossing leaders, leader length and plot-edge overflow. A name with no clear slot is dropped instead of stacked. Widths come from canvas `measureText` with the rendered font (re-measured once the web font loads). During a gesture names ride with their points; the solver re-runs when the gesture settles.
- **Interaction.** Hover hit-tests in pixel space (badges win over dots by relative distance) and feeds the React hover card; click opens the evidence dialog; drag pans, Box zoom frames a rectangle, the wheel zooms inside the plot rectangle only, double-click on empty plot space or Reset restores the view, and arrow keys / + / − / 0 work when the plot has focus. Touch: horizontal drag pans, pinch zooms, vertical swipes keep scrolling the page.
- **Legend.** Channel entries show point counts; hovering one isolates that channel in the chart and rankings, clicking toggles the channel filter.

Channel colours come from `../config/channel-colors.json`, shared with the Python charts (its `channels` array is also the single id-prefix → channel map); `python scripts/checks/verify_palette.py` enforces a minimum CIEDE2000 distance between channels present in the data. Dark mode swaps near-black provider marks for light ink so they stay visible.

Long tables and rankings render in chunks as they scroll (CSV/PNG exports still include every row), and the dataset request starts from `index.html` in parallel with the JavaScript bundle.

## Validation

See `design-qa.md`. `npm test` covers source fidelity, every board's configuration mappings, intersecting filters, empty and invalid selections, unscored models, API exclusion, strict dominance and ties, endpoint directions, language units, sharing, ordering and CSV export.

From the repository root, the independent data check remains applicable:

```sh
python scripts/checks/verify_benchmark_configs.py
```

## Vercel deployment

The project deploys to Vercel through Git integration.

- **Root Directory is the repository root**, so the active configuration is the root `../vercel.json` (`web/vercel.json` was removed as unused). It sets the build command `npm --prefix web ci && npm --prefix web run build`, output directory `web/dist`, skips the default install step, and sets cache headers: `/data/*` revalidates every request (`public, max-age=0, must-revalidate`) while hashed `/assets/*` are immutable (`public, max-age=31536000, immutable`).
- Pushes to `main` deploy to production at <https://real-api-pricing.vercel.app>. Pull-request previews are built automatically but sit behind Vercel authentication.
- No environment secrets or server functions are required. Run the Python data pipeline before committing dataset updates; the frontend deploy consumes those committed outputs. The website does not modify research archives or replace the chart publisher.
