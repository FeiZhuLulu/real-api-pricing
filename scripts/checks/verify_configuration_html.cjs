// Execute the actual generated application with a minimal DOM/Plotly adapter.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, '_build/帕累托交互图.html'), 'utf8');
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: ({tier:'full', configuration:'all', labels:'front'})[id] || '',
    checked: true, clientWidth: 1400, clientHeight: 800,
    addEventListener() {}, appendChild(child) { if (!this.value) this.value = child.value; },
  });
  return elements.get(id);
}
let render;
const context = vm.createContext({
  document: {getElementById:element, createElement:()=>({})},
  window: {addEventListener() {}}, setTimeout, clearTimeout,
  Plotly: {react: (id,traces,layout) => { render = {traces,layout}; }},
});
vm.runInContext(script, context);
const summary = JSON.parse(fs.readFileSync(path.join(root,'derived/points.json')));
const links = JSON.parse(fs.readFileSync(path.join(root,'derived/benchmark-points.json')));
for (const board of Object.keys(summary.boards)) {
  element('board').value = board;
  for (const view of ['all','summary']) {
    element('configuration').value = view;
    vm.runInContext('draw()', context);
    assert(render.layout.title.text.includes('参考'));
    const hover = render.traces.flatMap(t=>t.hovertemplate||[]).join('\n');
    const expected = view==='all' ? links.filter(c=>c.board===board).map(c=>c.variant)
      : summary.points.map(p=>p[board+'__variant']).filter(Boolean);
    for(const label of new Set(expected)) assert(hover.includes(label), `${board} ${view} missing ${label}`);
    assert(hover.includes('quota-measurement effort'));
    assert(hover.includes('来源任务成本（非订阅）'));
    for (const t of render.traces) for(const n of (t.x||[])) assert(n===null || Number.isFinite(n));
  }
  element('metered').checked = false;
  vm.runInContext('draw()', context);
  assert(!render.traces.some(t=>t.name==='按量 API'));
  element('metered').checked = true;
}
assert(html.includes('<option value="all">全部配置'));
console.log('PASS: all four boards render every configuration and summary; mapping/cost details and API toggle verified');
