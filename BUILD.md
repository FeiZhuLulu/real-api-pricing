# Reproducing the charts

Use Python 3.10+ and Node.js 20+. Install dependencies with `python -m pip install -r requirements.txt` and `npm install`.
For Chinese chart text, install Microsoft YaHei or Noto Sans CJK SC. Font substitution can change the layout on other systems. Interactive HTML loads Plotly from its CDN.

Run from the repository root, in order:

```sh
python scripts/build_adopted.py
python scripts/compute.py
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
python scripts/checks/verify_four_boards.py
python scripts/checks/verify_publication.py
python scripts/checks/verify_palette.py
```

CI (`.github/workflows/ci.yml`) runs this pipeline on Ubuntu for every PR and every push to `main`, then fails if the committed `data/`, `derived/` or text-comparable `charts/` outputs (tables, interactive HTML, hand-written Pareto SVGs) differ from a fresh run, and fails when `python scripts/readme_stats.py --check` finds stale README statistics. On pull requests the data job also runs `python scripts/checks/verify_snapshot_date.py --base FETCH_HEAD`, which fails when `data/adopted.csv` changed without `conventions.json` `updatedAt` advancing past the base branch. PNGs and matplotlib SVGs depend on the rendering machine's fonts, so CI rebuilds them only to feed the checks; render and commit them locally. A second job runs the website's `npm test` and `npm run build`.

On Windows, set `PYTHONIOENCODING=utf-8` if the console cannot print Chinese filenames. `plot_static.py` is a compatibility entry point for `plot_svg.py`.

## Layout

- `data/research/`: append-only evidence and dated leaderboard snapshots. Historical claims may disagree with current adoption decisions.
- `data/raw/`: aggregate usage evidence, retained for traceability.
- `data/conventions.json`: shared calculation conventions and exchange rate.
- `config/channel-colors.json`: the single channel palette for the website and every Python chart; its `channels` array is also the single id-prefix → channel map.
- `scripts/build_adopted.py`: adopted values, confidence and rationale; generates `data/adopted.csv`.
- `derived/`: price/score summary pairs, lossless benchmark configurations and explicit plan/configuration reference mappings. Run `compute.py` to regenerate all five benchmark JSON/CSV files.
- `charts/`: public bilingual charts and tables; start with `charts/README.md`. English and Chinese filenames live in `en/` and `zh/`, grouped into `pareto/`, `overview/` and `frontier/`.
- `_build/`: ignored intermediate renders, interactive HTML and audit reports. `publish_charts.py` exports full-data Pareto charts and all overview/frontier figures to `charts/`. Selected-data renders are never published.
- `scripts/checks/`: coordinate, frontier and language checks.

Older `data/subscription-quotas*.json`, `data/subscriptions.json` and claim archives are historical evidence, not current build inputs. The build uses the adoption script and dated research scores. Local `_backup/` and caches are ignored by Git and are not publication assets.

## Publication status

Original software is licensed under MIT; third-party attribution and license boundaries are documented in SOURCES.md. Data files are the documented public redacted edition; original evidence is preserved only in ignored local backups. Aggregate measurements remain for reproducibility. See PUBLICATION.md for the redaction scope. Public chart discovery starts at charts/README.md; all full-data charts, both languages and both SVG/PNG formats are retained.
