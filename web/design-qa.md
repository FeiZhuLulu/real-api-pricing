# Website QA — 2026-09-08

Target: the accepted website plan, with Arena's clean spacing and restrained navigation and Artificial Analysis's model-selection/chart controls as references. This is an original project interface, not a pixel-for-pixel clone. The user's accepted top navigation replaces Arena's sidebar deliberately.

## Visual inspection

Browser: Codex in-app browser. Desktop viewport approximately 1265 × 712; responsive override 390 × 844. Arena reference captured in this conversation; the supplied AA reference was also reviewed. Browser screenshots are retained inline in the task, not copied into the repository.

Final reference and implementation screenshots were presented together in one comparison input. Arena's capture was 1150 × 912 and the implementation capture 1265 × 712; this was a composition/spacing comparison against the accepted design direction, not a claim of identical viewport or pixel fidelity.

- Desktop: clear header, generous opening whitespace, three view tabs, four independent board tabs, model/filter toolbar, channel legend, large plot and searchable detail table. Frontier endpoints visibly extend to the correct edges. All points are rendered; labels default to the frontier.
- Mobile initial finding (P2): the model selector and configuration selector competed for one row, breaking Chinese control labels vertically. Fixed with explicit wrapping and minimum widths; repeat capture showed readable separate rows.
- Mobile initial finding (P2): overflowing content caused a page-wide horizontal scrollbar. Fixed page containment while preserving independent horizontal scrolling for tables and ranking charts. Repeat capture showed no page-wide horizontal scrollbar.
- Mobile: full-screen filters, visible close control, two-column checkbox groups, sticky result action. Tested actual channel filtering. Long ranking plots preserve readable width and scroll rather than squeezing their data into narrow axes.
- Typography follow-up: strengthened secondary text contrast and added an intentional mobile line break to the Chinese headline. Source evidence keeps its original language and is labeled accordingly.

## Functional browser inspection

- Clear every selected point: graph and table both empty; reset available.
- Search Luna and select its whole model group: six plan/model points selected. Chinese switch preserved selection; a new tab restored the shared URL and the same six points.
- Apply the OpenAI channel filter: four Luna points remain in price/capability; monthly allowance shows three after excluding the API baseline.
- Four-board switching updates source dates, metrics, plotted coordinates and unscored counts. Highest-score mode returns one table row per adopted point.
- Open Luna plan detail: verified actual total tokens, month fee formula, adopted evidence archive, confidence, original configuration, score interval and mapping limitations. Escape closes the dialog.
- A rendered scatter point was clicked directly and opened the matching DeepSeek V4 Flash / Command Code evidence and score reference. Real-price ranking retained all 188 plan/model rows.
- PNG, SVG and CSV controls produced files in Downloads. SVG was 46,111 bytes and PNG 57,042 bytes for the exercised Code Arena summary. Exported CSV contained all 188 selected rows. Browser download-event waiting timed out although files were successfully saved; filesystem verification confirmed the actual downloads.
- No captured browser console errors or warnings during local rendering and interaction checks.

## Numerical and build checks

- `npm test`: 15 tests passed.
- `npm run build`: TypeScript and Vite passed. Plotly is bundled separately; Vite reports its expected large-chunk advisory.
- `python scripts/checks/verify_benchmark_configs.py`: passed, 128 configurations and 660 references.
- Adapter verified all 188 points against the current adopted CSV, including null API fees and allowances.

## Deployment boundary

Vercel created the preview deployment, but its login protection and the available connector's inability to read the new project prevented online verification. No authentication protection was disabled. This limitation is separate from the locally verified app.

Local implementation result: passed, with mobile ranking horizontal scrolling as documented behavior.
Online preview verification: blocked by Vercel access.

final result: passed

## Follow-up: labels, navigation and data discoverability (2026-09-08)

- Replaced offset model names with numbers centered on the actual markers and a matching clickable model/price/score key. Duplicate-coordinate members remain available: Code Arena number 5 opens both Claude Max 5x and 20x references.
- Added explicit box-zoom/pan/reset controls and visible zoom-in/out buttons. Browser check: zoom changed the log-axis ticks; Reset view restored the exact original ticks. Box zoom's pressed state switches correctly.
- Four visible data-entry cards now expose all capability points, 188 real-price rows, 177 subscription allowance rows, and the complete table. Full-table action scrolls to the section and transfers keyboard focus.
- Checked desktop and 390×844 layouts in the browser. Mobile uses two columns for entry cards, wraps chart controls, and retains horizontal ranking scrolling. The numbered markers no longer require guessing which nearby model name belongs to a point.
- PNG/SVG export calls complete successfully and include the numbered model key in the export layout. The browser reports “Chart exported”; this follow-up did not independently inspect newly saved download files.
- TypeScript/Vite build and all 15 data/domain tests pass; the adapter continues to verify 188 points, 128 configurations, and 660 references.
- New preview: `dpl_3H49YUaTwTnBhRHhNWCXmf3aj795`. Dashboard access succeeded after cookie import, but preview SSO requires a user-completed authenticator code. Online rendering remains unverified; no protection was disabled.

## Ranking redesign and correction (2026-09-08)

The earlier ranking-layout pass was not sufficiently verified. The user's screenshot demonstrated that all 188 Plotly category labels could compress into an unreadable plot. That earlier visual acceptance is superseded by this review.

Price and allowance views now use a dedicated React ranking component, with 15 full-height rows per page, aligned model/plan/channel and value columns, logarithmic comparison bars, shared search, and keyboard-accessible details. All filtered data remains available across pages and in the full table; no adopted data was removed. Ranking PNG/SVG export explicitly exports the current page. Capability scatter charts continue using Plotly.

Actual browser verification: desktop screenshot inspected; 390×844 screenshot inspected with Claude long names; 12 matched mobile rows measured 120px each with no horizontal overflow. Page 2 displays ranks 16–30. Luna search yields six rows and resets pagination. Clicking its first row opens the matching ChatGPT Pro 20x evidence. A nonexistent search shows the empty state and clear action. Build and 15 domain/data tests pass. These checks replace the former compressed ranking chart acceptance.

Online follow-up: the updated Vercel preview now opens the actual app after browser authentication. The English price-ranking page was inspected via accessibility state and screenshot, showing the redesigned rows and 1–15 / 188 pagination. URL: https://real-api-pricing-kiemmndso-feizhululus-projects.vercel.app .

## Monthly-fee bands (2026-09-08)

Shared presentation config: config/allowance-fee-bands.json. Bands are [0,30], (30,100), [100,300] USD/month, using adopted price_usd. No quota or adopted number changes. Full set remains available. Both frontend and Python verified 117 / 18 / 42 non-overlapping members, totaling all 177 current subscriptions. Boundary checks explicitly cover 0,30,30.01,99.99,100,300,300.01 and null. Web: 16 tests pass, build passes; actual desktop/monthly-fee buttons and 390×844 wrapping inspected; reload restored selected high band; monthly rank and table follow feeBand. Python rendered three bilingual SVG/PNG/text sets; publication index and bilingual README link them. Static title/legend/footer spacing corrected after image inspection. New preview https://real-api-pricing-jdhgq7oyu-feizhululus-projects.vercel.app (dpl_8mTPFPEMsuZBsKprEyJT3yr2qzwh) verified online with middle band selected and 18 results.


## Presentation revisions (2026-09-08)

User confirmed GLM ¥49/149/469=v2 and ¥118/538/1078=v3; v1 has no adopted rows. Display aliases were applied to web and Python rendering without changing adopted IDs or values. Charts regenerated. Fee bands now [0,30], (30,100], (100,300], verified as 117/36/24; 16 tests and build pass. Browser verified #F5F3ED background and provider placeholders. SVG art is pending Cursor; see src/assets/provider-logos/README.md. Latest preview https://real-api-pricing-dwdeng7ej-feizhululus-projects.vercel.app verified with the correct background and 55 logo slots.

## Provider logo acceptance — 2026-09-09
- Reviewed Cursor's SVG/PNG assets and channel + manufacturer BrandMarks integration.
- Command Code PNG uses Vite `?inline` so static text uploads preserve binary artwork.
- `npm test`: 17 passed. `npm run build`: type check and production build passed.
- Inspected desktop and 390×844 mobile model panels; logos load without broken images.
- Verified preview: 82 loaded logo images, none broken, body background rgb(245,243,237).
- Existing vendor=other records (Inkling, Inkling Small, Nemotron 3 Ultra) retain fallback marks; no manufacturer guessed.
- Preview: https://real-api-pricing-owzvswiml-feizhululus-projects.vercel.app

## Frontier point correction and AA update — 2026-09-09

## Wheel zoom and contribution links — 2026-09-09

Custom wheel zoom is restricted to the plot rectangle, including logo overlays, and keeps the cursor anchored on both reversed-log price and score axes. Real browser wheel testing confirmed: inside plot, ticks change with page scroll fixed at 360; outside plot, page scroll becomes 540 with ticks unchanged; Reset restores the original ticks and five logos. A regression test covers cursor anchoring, direction and reversible zoom; 19 tests and production build pass.

Header adds bilingual GitHub Issue evidence template and Star link/count via public repository API. Mobile 390×844 and Chinese labels inspected. The current network's GitHub API rate limit caused the count to be omitted; the Star link remains usable. No issue or Star action was submitted. Grok implemented the header through Agent Bridge, Codex reviewed it and implemented/tested wheel zoom. Preview verified: https://real-api-pricing-agvi8wdpm-feizhululus-projects.vercel.app .

- User clarified that the frontier coordinate itself must be a logo, not a numbered circle with a logo in its label. Grok implemented this through Agent Bridge; Codex independently reviewed and fixed neighbouring-label avoidance, logarithmic export annotation coordinates, logo export backgrounds and responsive export height.
- Desktop and 390×844 browser views inspected: five Code Arena frontier logos and five bottom cards remain; no numbered scatter text. Clicking Opus 5 opens both coincident Max plans. Zoom hides offscreen logos; Reset restores all five. The detail table has its own horizontal scroll container.
- Downloaded actual SVG and PNG. The first PNG exposed a mutable-layout height bug; the corrected PNG was downloaded and visually checked, with centered logo markers, readable names and five separate key rows.
- Kimi SVG and its assembly recipe now specify a black K and blue dot.
- AA data checks: 149 current AA configurations match raw scores, variants, harnesses and estimate flags. 188 points, 204 configurations, 886 references; prices, quotas and both Arena boards remain unchanged. All 18 web tests and TypeScript/Vite build pass.
- Final preview opened successfully and Code Arena logo buttons/cards were confirmed online: https://real-api-pricing-r3pgysog6-feizhululus-projects.vercel.app . A subsequent remote AA-page screenshot call timed out; AA v4.3 and estimate details had already been inspected locally. No production promotion.

## Overlay, label and hover rework — 2026-09-09

The user reported three defects from screenshots: names stayed behind while the chart was dragged, names crossed each other and their neighbours, and hovering a frontier logo showed nothing while hovering beside it did. Pan stays on the left button; right-button-only dragging was rejected as undiscoverable and unavailable on touch.

Browser verification in a real Chrome window at 1280×900 and at a 500px-wide window:

- Drag instrumentation confirmed `plotly_relayouting` firing mid-gesture; a pan moved a logo by −439px and its name by exactly the same offset, keeping the leader length. After the drag, logos and names still sat on the frontier line, and off-screen points dropped their marks.
- Frontier-only mode: five names, none truncated, none overlapping, short dotted leaders. First attempt truncated every name because measurement used an Inter stack while the page renders DM Sans, and then lost a sub-pixel to rounding; measurement now uses a hidden copy of the real label element plus one pixel.
- All-points mode before coordinator review: 28 names placed with no label-to-label overlap. AA Intelligence: six frontier names, no overlap.
- Hover on each of the five frontier logos returned that exact point. Before the trace-order and hit-radius fix, the GLM 5.3 logo reported a neighbouring GLM 5.3 Flash point at a different price. A non-frontier dot hover grew the dot and returned its own plan.
- Click through a logo still opens the matching evidence dialog (Claude Opus 5 with both coincident Max references). Ranking views render no overlay nodes.
- PNG and SVG exports downloaded and inspected: logos on coordinates, adjacent names with dotted leaders, numbered key retained.
- 20 tests pass, including a new placement regression test (no overlaps, inside the plot box, names dropped when a tight box leaves no room). TypeScript and the production build pass.

Not verified: a real touch device, and the deployed preview. `logoUrlMap` moved from `chartLabels.ts` to `ProviderLogo.tsx` so the placement geometry can be tested under Node.

### Coordinator review and independent scrolling

- Ranking and detail-table pagination removed. Each panel has native bounded scrolling, a sticky header, keyboard access and independent scroll position. Browser checks covered desktop wheel isolation, End reaching row 188, 390px layout, no-results search and the 36-row middle fee band including $100. All 177 subscription allowances remain available.
- Full ranking PNG downloaded at 1100 × 10282 with all 188 filtered rows; CSV still uses the entire selection.
- Review found label-to-marker collisions were only soft penalties. They are now hard exclusions. A clean browser reload showed 23 placeable names and all 5 frontier logos in Code Arena all-label mode, with no label-to-point overlap. Added a regression test for a point-filled plot.
- Relayout clears stale hover cards. Label measurement explicitly uses the requested mobile/export font size and padding, independent of the current viewport.
- The contribution entry uses the repository's bilingual Issue template, covering providers, subscription plans, cached/uncached input, output, quota periods, usage percentages and sources.
