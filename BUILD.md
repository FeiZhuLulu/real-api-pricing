# Reproducing the charts

Use Python 3.10+ and Node.js 20+. Install dependencies with `python -m pip install -r requirements.txt` and `npm install`.
For Chinese chart text, install Microsoft YaHei or Noto Sans CJK SC. Font substitution can change the layout on other systems. Interactive HTML loads Plotly from its CDN.

Run from the repository root, in order:

```sh
python scripts/build_adopted.py
python scripts/compute.py
python scripts/checks/verify_benchmark_configs.py
python scripts/plot_svg.py
node scripts/render_svg.cjs
python scripts/build_html.py
node scripts/checks/verify_configuration_html.cjs
python scripts/plot_quotas.py
python scripts/publish_charts.py
python scripts/checks/verify_svg.py
python scripts/checks/verify_four_boards.py
python scripts/checks/verify_publication.py
```

On Windows, set `PYTHONIOENCODING=utf-8` if the console cannot print Chinese filenames. `plot_static.py` is a compatibility entry point for `plot_svg.py`.

## Layout

- `data/research/`: append-only evidence and dated leaderboard snapshots. Historical claims may disagree with current adoption decisions.
- `data/raw/`: aggregate usage evidence, retained for traceability.
- `data/conventions.json`: shared calculation conventions and exchange rate.
- `scripts/build_adopted.py`: adopted values, confidence and rationale; generates `data/adopted.csv`.
- `derived/`: price/score summary pairs, lossless benchmark configurations and explicit plan/configuration reference mappings. Run `compute.py` to regenerate all four benchmark JSON/CSV files.
- `charts/`: public bilingual charts and tables; start with `charts/README.md`. English and Chinese filenames live in `en/` and `zh/`, grouped into `pareto/`, `overview/` and `frontier/`.
- `_build/`: ignored intermediate renders, interactive HTML and audit reports. `publish_charts.py` exports full-data Pareto charts and all overview/frontier figures to `charts/`. Selected-data renders are never published.
- `scripts/checks/`: coordinate, frontier and language checks.

Older `data/subscription-quotas*.json`, `data/subscriptions.json` and claim archives are historical evidence, not current build inputs. The build uses the adoption script and dated research scores. Local `_backup/` and caches are ignored by Git and are not publication assets.

## Publication status

Original software is licensed under MIT; third-party attribution and license boundaries are documented in SOURCES.md. Data files are the documented public redacted edition; original evidence is preserved only in ignored local backups. Aggregate measurements remain for reproducibility. See PUBLICATION.md for the redaction scope. Public chart discovery starts at charts/README.md; all full-data charts, both languages and both SVG/PNG formats are retained.
