"""Validate exported files, bilingual links, data coverage and source JSON."""
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from publish_charts import exports

data = json.loads((ROOT/'derived/points.json').read_text(encoding='utf-8'))
with (ROOT/'data/adopted.csv').open(encoding='utf-8-sig', newline='') as f:
    adopted = list(csv.DictReader(f))
assert len(adopted) == len(data['points'])
assert {r['plan_id']+'::'+r['served_model'] for r in adopted} == {p['id'] for p in data['points']}
assert len({p['id'] for p in data['points']}) == len(data['points'])
for p in ROOT.joinpath('data').rglob('*.json'):
    json.loads(p.read_text(encoding='utf-8-sig'))

exported = list(exports())
assert len(exported) == 81
assert len({d for _,d in exported}) == len(exported)
for source,destination in exported:
    assert destination.is_file(), destination
    assert hashlib.sha256(source.read_bytes()).digest() == hashlib.sha256(destination.read_bytes()).digest(), destination
assert set(ROOT.joinpath('charts').rglob('*.svg')) == {d for _,d in exported if d.suffix == '.svg'}
for doc in [ROOT/'README.md',ROOT/'README.zh.md',ROOT/'BUILD.md',ROOT/'SOURCES.md',ROOT/'charts/README.md']:
    for target in re.findall(r'\]\(([^)]+)\)', doc.read_text(encoding='utf-8')):
        if not target.startswith(('http:', 'https:', '#')):
            assert (doc.parent/target).exists(), (doc,target)
for doc,lang in [('README.md','en'),('README.zh.md','zh')]:
    s=(ROOT/doc).read_text(encoding='utf-8')
    pictures=re.findall(r'!\[[^\]]*\]\(([^)]+)\)',s)
    assert len(pictures)==6 and all(p.startswith(f'charts/{lang}/') for p in pictures)
    assert s.count('[English SVG]')==6 and s.count('[中文 SVG]')==6
    assert s.count('[English PNG]')==6 and s.count('[中文 PNG]')==6
print(f'PASS: {len(adopted)} adopted rows, {len(exported)} exported files match build hashes, all JSON and bilingual links valid')
for board in data['boards']:
    missing=sorted({p['model'] for p in data['points'] if p[board+'__score'] is None})
    print(board, sum(p[board+'__score'] is not None for p in data['points']), 'scored; missing:', ', '.join(missing))
