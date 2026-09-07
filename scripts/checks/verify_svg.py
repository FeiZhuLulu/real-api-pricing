import json,math,re,xml.etree.ElementTree as ET
from pathlib import Path
root=Path(__file__).resolve().parents[2];data=json.loads((root/'derived/points.json').read_text(encoding='utf-8'))
charts=json.loads((root/'_build/SVG坐标核对.json').read_text(encoding='utf-8'))
ns={'s':'http://www.w3.org/2000/svg'}
for chart in charts:
 k=chart['board']+'__score';tier=chart['tier']
 pts=[p for p in data['points'] if p[k] is not None and p['real_usd_per_mtok']>0 and (tier=='full' or p['tier']=='main')]
 f=[p for p in pts if not any(q['real_usd_per_mtok']<=p['real_usd_per_mtok'] and q[k]>=p[k] and (q['real_usd_per_mtok']<p['real_usd_per_mtok'] or q[k]>p[k]) for q in pts)]
 svg=ET.parse(root/'_build'/f"{chart['stem']}.svg");els=svg.findall('.//s:g[@class="point"]',ns)
 actual={(float(e.attrib['data-price']),float(e.attrib['data-score']),e.attrib['data-billing']) for e in els}
 assert actual=={(p['real_usd_per_mtok'],p[k],p['billing']) for p in pts}
 front={(float(e.attrib['data-price']),float(e.attrib['data-score'])) for e in els if e.attrib['data-frontier']=='true'}
 assert front=={(p['real_usd_per_mtok'],p[k]) for p in f}
 xmin,xmax,ymin,ymax=chart['bounds']
 for el in els:
  p=float(el.attrib['data-price']);s=float(el.attrib['data-score']);x=float(el.attrib['data-x']);y=float(el.attrib['data-y'])
  assert abs(x-(120+math.log(xmax/p)/math.log(xmax/xmin)*1218))<.00051
  assert abs(y-(705-(s-ymin)/(ymax-ymin)*472))<.00051
  assert 120<=x<=1338 and 233<=y<=705
 line=svg.find('.//s:path[@id="frontier"]',ns).attrib['d']; pairs=re.findall(r'([\d.]+),([\d.]+)',line)
 assert float(pairs[0][0])==120 and float(pairs[-1][0])==1338
 assert abs(float(pairs[0][1])-(705-(max(p[k] for p in f)-ymin)/(ymax-ymin)*472))<.00051
 assert abs(float(pairs[-1][1])-(705-(min(p[k] for p in f)-ymin)/(ymax-ymin)*472))<.00051
 assert not svg.findall('.//s:image',ns)
 print(chart['stem'],len(els),'positions;',len(front),'frontier; editable SVG text:',len(svg.findall('.//s:text',ns)))
print(f'PASS: all {len(charts)} SVGs preserve data coordinates, non-dominated sets, log scale and endpoint directions; no embedded raster images.')
