# Real API Pricing website

React + TypeScript + Vite, with a locally bundled Plotly renderer. The website reads the repository's adopted data; it does not fetch live prices or recompute quota adoption.

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

`npm run data` verifies all point IDs, monthly fees, monthly allowances, and real prices against `../data/adopted.csv`, checks configuration references, and writes `public/data/`. `npm run build` runs this adapter, TypeScript, then Vite. The generated data and `dist/` are ignored by Git.

## Data and behavior

- Three linked views: price–capability scatterplot, real-price ranking, and monthly-allowance ranking. Four leaderboards remain independent.
- All adopted points and all archived benchmark configurations are selected initially. Model selection expands to channels and individual plan/model points. Empty selection is distinct from selecting everything.
- Filters within one category are ORed; categories are ANDed. Harness, effort, and mode filters restrict benchmark references. Plans without matching scores stay in the table and in price/allowance views. Those ranking views use one row per plan/model, with any table score labeled as the highest matching reference.
- The frontier is recomputed for the filtered set with strict dominance. Equal coordinates are grouped only for rendering; every plan/configuration member remains inspectable. Lowest price is on the right. Endpoint extensions cannot imply the highest score at the cheapest price.
- Detail dialogs distinguish quota confidence from mapping confidence, show original adoption evidence, and link to public archives. Original-language evidence is retained; English display labels translate Chinese plan qualifiers without changing IDs or values.
- The table search and sorting affect the table and its CSV, while the global model/filter state affects both chart and table. Pagination displays 50 rows at a time; CSV exports all matching rows, not just the current page.
- Share links serialize state in the URL hash. Removed IDs and invalid settings are ignored with an explicit notice. CSV text is quoted and formula-like text escaped.
- PNG/SVG exports use the current chart. Mobile dialogs fill the screen; long ranking charts and wide tables scroll within their containers.

The raw downloads retain the original computed fields. The smaller website dataset omits duplicated per-board summary fields from point records because the complete configurations and explicit mappings carry them separately. Source numbers are unchanged.

## Vercel

For Git-based deployments, import `FeiZhuLulu/real-api-pricing` with:

| Setting                                         | Value                                                  |
| ----------------------------------------------- | ------------------------------------------------------ |
| Root Directory                                  | `web`                                                  |
| Include source files outside the Root Directory | Enabled — the adapter reads `../data` and `../derived` |
| Framework                                       | Vite                                                   |
| Install command                                 | `npm ci`                                               |
| Build command                                   | `npm run build`                                        |
| Output Directory                                | `dist`                                                 |

No environment secrets or server functions are required. Run the existing Python data pipeline before committing dataset updates; the frontend deploy consumes those committed outputs. The website does not modify research archives or replace the existing chart publisher.

A static preview upload was created on 2026-09-08:

- Preview: https://real-api-pricing-i44onrvli-feizhululus-projects.vercel.app
- Deployment: `dpl_3H49YUaTwTnBhRHhNWCXmf3aj795`
- Inspector: https://vercel.com/feizhululus-projects/real-api-pricing/3H49YUaTwTnBhRHhNWCXmf3aj795

The deployment connector reported creation, but Vercel authentication protects the URL. The available read connector cannot inspect this new project or issue a temporary share link, so online rendering has **not** been verified. Local production build and browser validation passed. Git integration and production promotion were not configured.

Imported browser cookies allowed access to the earlier deployment dashboard (Ready). Opening the updated preview still required Vercel SSO; the existing GitHub login reached an authenticator-code challenge. Complete that challenge in the browser before verifying the protected preview.

Chart navigation now exposes box zoom, pan, reset, and Plotly's + / − buttons. Reset restores the initial reversed logarithmic price axis and fits the score axis. Numbered markers match the clickable model key below the plot; PNG/SVG exports include this numbered key. The four prominent explorer entries lead to capability, real-price ranking, allowance ranking, and the full table.

The connector's 4 MB upload limit required excluding three redundant raw CSV mirrors (`points.csv`, `benchmark-points.csv`, `benchmark-configurations.csv`) from this static preview upload. Every website-linked download is included: adopted CSV, complete points/configurations/mappings JSON, conventions and linked evidence. The full local build retains all CSV mirrors.

## Validation

See `design-qa.md`. `npm test` covers source fidelity, all four board mappings, intersecting filters, empty and invalid selections, unscored models, API exclusion, strict dominance and ties, endpoint directions, language units, sharing, ordering and CSV export.

From the repository root, the existing independent check remains applicable:

```sh
python scripts/checks/verify_benchmark_configs.py
```

The implementation was completed directly by Codex after the user explicitly authorized bypassing unavailable Agent Bridge tools.

### Web-native rankings

Real-price and monthly-allowance views use responsive React rows with comparison bars, instead of a Plotly chart with hundreds of category labels. Search is shared with the detail table; 15 rows appear per page and all filtered rows remain available. PNG/SVG exports capture the current ranking page, with its range and units labeled. CSV continues to export the entire filtered table.

Latest preview (ranking redesign): https://real-api-pricing-kiemmndso-feizhululus-projects.vercel.app — deployment dpl_9QarArMJP3qVisxAF7aM3AFqExV8. Browser authentication now succeeds; the actual deployed app and new ranking rows were inspected on 2026-09-08. Earlier authentication-block notes above describe previous attempts. Production has not been promoted.

Monthly-allowance fee bands share `../config/allowance-fee-bands.json` with Python chart generation. They use adopted USD monthly fees: [0,30], (30,100], (100,300]. All retains every allowance, including any future >$300 plan. The `feeBand` hash field is backward compatible and applies only to allowance view; ranking, detail table, image export and CSV follow it. Regenerate static bands with `python scripts/plot_quotas.py --fee-bands-only` and publish via `python scripts/publish_charts.py --fee-bands-only`; run `python scripts/checks/verify_fee_bands.py` for independent partition validation.

Latest fee-band preview: https://real-api-pricing-jdhgq7oyu-feizhululus-projects.vercel.app (dpl_8mTPFPEMsuZBsKprEyJT3yr2qzwh). Browser verification confirmed the three fee-band controls and the selected middle band's 18 results.


Current presentation (2026-09-08): GLM ¥49/149/469 is v2; ¥118/538/1078 is v3. v1 has no adopted data and is not fabricated. These are presentation aliases; source IDs and historical evidence remain unchanged. The page background is #F5F3ED. Provider marks live in src/assets/provider-logos/; unknown vendors still fall back to a two-letter monogram. $100 now belongs to the middle fee band, giving 117 / 36 / 24 subscriptions per band.

### AA snapshot update (2026-09-09)

The Intelligence Index uses v4.3 and Coding Agent Index uses v1.4, captured on September 9. Each board uses one complete current snapshot, retaining its configurations without mixing older index versions. AA estimates are explicitly marked in details, the table and CSV. The data adapter verifies 188 adopted points, 204 configurations and 886 mappings.

The site payload omits mapping fields that exactly match their referenced configuration. `unpackData` restores them before use; a deep-equality test checks every restored mapping against the original derived data. Complete source downloads remain available. This saves about 289 KB in the static upload without dropping data.

Earlier verified preview: https://real-api-pricing-r3pgysog6-feizhululus-projects.vercel.app (deployment `dpl_46Lvkra2NBjmz3oT5tpsCtcKZZcm`). Frontier points use centered provider logos; names sit beside them with leader lines, and the model cards below remain. Kimi uses a black K with a blue dot. PNG/SVG export embeds the same logo markers and retains the detail key. Production URL: https://real-api-pricing.vercel.app .

Rankings and the detail table use separate bounded scroll panels rather than pagination. Ranking PNG/SVG and table CSV exports include all filtered rows. The contribution link opens `.github/ISSUE_TEMPLATE/contribute-data.md` on GitHub.

### Scatter overlay: names, hover and panning (2026-09-09)

The logo markers and model names are HTML drawn over the Plotly canvas (`chartLabels.ts` + `Chart.tsx`), so three rules keep them part of the chart instead of a second layer floating above it:

- **Positions come from the live axis ranges, not `l2p`.** While Plotly pans it rewrites `axis.range` every frame but only rebuilds the pixel scale when the gesture ends, so `l2p` lags a drag. `dataToPixel` maps through `range` instead, and `plotly_relayouting` reprojects the overlay on every animation frame. Slots are only re-solved on `plotly_relayout`/`plotly_afterplot`/resize, so names travel with their points during a drag rather than reshuffling.
- **Names take the nearest free slot.** `placeTextLabels` tries above, below, right, left, then the diagonals, at three distances from the marker edge, and scores each candidate on label collisions, covered markers, crossing leaders, leader length and plot-edge overflow. A name with no clear slot is dropped instead of stacked; the point, its hover card and the table still carry it. Widths come from a hidden copy of the real label element, so CJK and Latin names reserve exactly what they render.
- **Hover and click belong to Plotly.** The overlay is `pointer-events: none`, which is why hovering a logo used to show nothing while hovering just beside it worked. Traces use `hoverinfo: "none"` and `plotly_hover` feeds a styled React card, plus a scaled logo or a grown dot for the hovered point. Frontier hit targets are the first trace and share the dot radius: Plotly keeps the earliest trace on a distance tie and its distance floor (`1 - 3/radius`) favours small markers, so a fat invisible marker would lose its own point to a neighbouring dot.

Exports rebake the same geometry into Plotly paper coordinates: logos as images, names as arrow-less annotations, leaders as dotted shapes, since annotation arrows cannot be dashed.
