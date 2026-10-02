# Reproducing the charts

Use Python 3.10+ and Node.js 22.12+ (CI uses 22; the root deployment dependency requires Node.js 22). Install dependencies with `python -m pip install -r requirements.txt`, `npm ci` (repository root) and `npm --prefix web ci` (website).
For Chinese chart text, install Microsoft YaHei or Noto Sans CJK SC. Font substitution can change the layout on other systems. Interactive HTML loads Plotly from its CDN.

Run from the repository root, in order:

```sh
python scripts/build_adopted.py
python scripts/compute.py
python scripts/checks/verify_i18n.py
python scripts/readme_stats.py
python scripts/checks/verify_benchmark_configs.py
python scripts/checks/verify_aa_snapshot.py
python scripts/checks/verify_deepswe.py
python scripts/plot_svg.py
node scripts/render_svg.cjs
python scripts/build_html.py
node scripts/checks/verify_configuration_html.cjs
python scripts/plot_quotas.py
python scripts/checks/verify_fee_bands.py
python scripts/checks/verify_chart_labels.py
python scripts/publish_charts.py
python scripts/checks/verify_svg.py
python scripts/checks/verify_label_overlap.py
python scripts/checks/verify_four_boards.py
python scripts/checks/verify_publication.py
python scripts/checks/verify_palette.py
```

CI (`.github/workflows/ci.yml`) checks the committed outputs against a fresh run:

- It runs the pipeline above on Ubuntu for every PR and every push to `main`, then fails if the committed `data/`, `derived/` or text-comparable `charts/` outputs (tables, interactive HTML, hand-written Pareto SVGs) differ from a fresh run.
- `python scripts/readme_stats.py --check` fails on stale README statistics; it now also covers `data/README.md`.
- On pull requests the data job runs `python scripts/checks/verify_snapshot_date.py --base FETCH_HEAD`, which fails when `data/adopted.csv` changed without `conventions.json` `updatedAt` advancing past the base branch — or being equal to today's date when the base is already today.
- PNGs and matplotlib SVGs depend on the rendering machine's fonts, so CI rebuilds them only to feed the checks; render and commit them locally.
- `verify_label_overlap.py` measures real glyph boxes and therefore needs the chart fonts (Microsoft YaHei / Noto Sans CJK SC); it prints a SKIP line and passes under `CHART_FONT_FALLBACK=1`.
- A second job runs the website's `npm test` and `npm run build`.

On Windows, set `PYTHONIOENCODING=utf-8` if the console cannot print Chinese filenames. `plot_static.py` is a compatibility entry point for `plot_svg.py`.

## CLI only

The CLI can build independently from the committed adopted and derived data.
It needs Node.js 22.12+ and its own dependencies, without Python, root npm
dependencies, website dependencies or a running website. From the repository
root:

```sh
npm --prefix cli ci
npm --prefix cli run typecheck
npm --prefix cli test
node cli/dist/main.js price --company Anthropic --limit 3
node cli/dist/main.js allowance --company Anthropic --fee-band 0-30
```

`npm test` builds the executable and `cli/data/site.json` before testing data
validation, website query parity and CLI behavior. `npm --prefix cli run build`
is sufficient when only the executable and snapshot are needed. The website
and CLI share `scripts/lib/build-site-data.mjs`; both verify adopted values
against `data/adopted.csv` without changing their numeric precision.

To prepare a local installation package, run `npm pack` from `cli/`; this
typechecks and rebuilds before including the executable, snapshot, README
and LICENSE. Install the resulting tarball with
`npm install -g /absolute/path/to/fullstop000-real-api-pricing-cli-0.1.0.tgz`.
The package has not been published to npm. Usage and output contracts are in
[cli/README.md](cli/README.md) and [docs/cli-design.md](docs/cli-design.md).

## Layout

- `data/research/`: append-only evidence and dated leaderboard snapshots. Historical claims may disagree with current adoption decisions.
- `data/raw/`: aggregate usage evidence, retained for traceability.
- `data/conventions.json`: shared calculation conventions and exchange rate.
- `config/channel-colors.json`: the single channel palette for the website and every Python chart; its `channels` array is also the single id-prefix → channel map.
- `config/allowance-fee-bands.json`: monthly-fee band boundaries shared by the website and the Python overview charts.
- `scripts/build_adopted.py`: adopted values, confidence and rationale; generates `data/adopted.csv`.
- `derived/`: price/score summary pairs, lossless benchmark configurations and explicit plan/configuration reference mappings. Run `compute.py` to regenerate all derived JSON/CSV files.
- `data/i18n/`: English translations of the Chinese adoption `source`/`decision_note` text shown on the website. Whenever a `source` or `decision_note` changes, run `python scripts/checks/verify_i18n.py --sync` and fill in the English.
- `charts/`: public bilingual charts and tables; start with `charts/README.md`. English and Chinese filenames live in `en/` and `zh/`, grouped into `pareto/`, `overview/` and `frontier/`.
- `_build/`: ignored intermediate renders, interactive HTML and audit reports. `publish_charts.py` exports full-data Pareto charts and all overview/frontier figures to `charts/`. Selected-data renders are never published.
- `scripts/checks/`: coordinate, frontier and language checks.
- `web/`: the interactive site (Vite/React); see [web/README.md](web/README.md).
- `cli/`: the offline TypeScript query CLI; see [cli/README.md](cli/README.md).
- `scripts/lib/build-site-data.mjs`: snapshot adapter shared by the website and CLI.

Older `data/subscription-quotas*.json`, `data/subscriptions.json` and claim archives are historical evidence, not current build inputs. The build uses the adoption script and dated research scores. Local `_backup/` and caches are ignored by Git and are not publication assets.

## Publication status

License and attribution boundaries: [SOURCES.md](SOURCES.md). Redaction scope and local-backup policy: [PUBLICATION.md](PUBLICATION.md).
