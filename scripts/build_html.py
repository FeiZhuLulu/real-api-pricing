# -*- coding: utf-8 -*-
"""derived/points.json → _build/帕累托交互图.html：单文件 Plotly 交互图，可切换 Y 轴榜单、悬停看公式明细。"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POINTS = ROOT / "derived" / "points.json"
OUT = ROOT / "_build" / "帕累托交互图.html"

TEMPLATE = r"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>真实 API 价格 × 评测配置参考 · 帕累托前沿</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" charset="utf-8"></script>
<style>
  *{box-sizing:border-box}
  body{font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif;margin:0;background:#faf9f6;color:#191919}
  header{padding:30px 4vw 0;max-width:1700px;margin:auto}
  h1{font-size:clamp(24px,3vw,40px);font-weight:500;letter-spacing:-1px;margin:0 0 14px}
  h1 mark{background:#45d6ca;color:inherit;padding:0 7px 3px}
  .sub{color:#686868;font-size:12px;line-height:1.8;margin-bottom:16px;max-width:1200px}
  .bar{display:flex;gap:18px;align-items:center;flex-wrap:wrap;font-size:12px;margin-bottom:12px}
  select{font:inherit;border:1px solid #deded8;border-radius:5px;padding:7px 26px 7px 9px;background:#fff;color:#222;margin-left:5px}
  input{accent-color:#191919;vertical-align:middle}
  .chart-scroll{overflow-x:auto;margin:0 2vw;border-radius:10px;background:white}
  #chart{height:calc(100vh - 270px);min-height:600px;min-width:960px;background:white}
  .mobile-hint{display:none}
  .foot{padding:16px 4vw 24px;color:#777;font-size:11px;line-height:1.9}
  details{margin:8px 4vw;font-size:12px;color:#555}
  summary{cursor:pointer;padding:8px 0}
  table{border-collapse:collapse;width:100%;background:white}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #eee}
  code{background:#eee;padding:1px 4px;border-radius:3px}
  @media(max-width:1000px){.mobile-hint{display:block;color:#777;font-size:11px;margin:8px 4vw}}
  @media(max-width:700px){header{padding-top:20px}.bar{gap:10px}.chart-scroll{margin:0}#chart{min-height:650px}.foot{font-size:10px}}
</style></head><body>
<header>
  <h1><mark>帕累托前沿</mark> 真实单价 × 评测配置参考</h1>
  <div class="sub">真实单价 = 订阅月费 ÷ 用户每月实际可用 token（饱和使用 · 全口径含缓存 · 月 = 4 周）。每个点 = (订阅套餐, 实际服务模型)；同一模型走不同渠道是不同的点。Claude Max (9/14+) 为2026-09-14起永久额度估算，非当前活动期上限；Pro保留Opus4.8历史实测。</div>
  <div class="bar">
    <label>Y 轴榜单 <select id="board"></select></label>
    <label>评测配置 <select id="configuration"><option value="all">全部配置（参考映射）</option><option value="summary">最高分汇总（参考）</option></select></label>
    <label>范围 <select id="tier"><option value="full" selected>全量</option><option value="main">精选（内部对照）</option></select></label>
    <label>标签 <select id="labels"><option value="front">只标前沿</option><option value="all">全部</option><option value="none">不标</option></select></label>
    <label><input type="checkbox" id="metered" checked> 按量 API（参与前沿）</label>
    <label><input type="checkbox" id="lowconf" checked> low 置信度点</label>
    <span id="stats" style="color:#666"></span>
  </div>
</header>
<p class="mobile-hint">左右滑动查看完整图表 · 悬停或点击数据点查看详情</p>
<div class="chart-scroll"><div id="chart"></div></div>
<details><summary>前沿点明细与未纳入模型</summary><div id="front-details"></div><p id="unscored"></p></details>
<div class="foot">数据：<code>data/adopted.csv</code>（取舍与出处见 <code>scripts/build_adopted.py</code>）· 四张榜单各自独立绘制，快照与来源见标题及项目记录 · AA Coding Agent 分数属于官网标明的 harness×模型配置 · 美元/credits额度与按量 API 三段价统一按项目标准负载（<span id="mix"></span>）折算；直接 total-token 实测不重复归一</div>
<script>
const DATA = __DATA__;
const VENDOR_COLOR = {OpenAI:"#19B37A",Anthropic:"#FF8A3D",xAI:"#8E6CF7",Kimi:"#2FA8FF",Zhipu:"#1E1E1E",MiniMax:"#FF5FA2",Alibaba:"#FF4D4F",DeepSeek:"#2F5BFF",Google:"#7CC12A",Xiaomi:"#FFA000",Tencent:"#26C6DA",Cursor:"#FFC233",OpenCode:"#00BCD4","Command Code":"#D81BCC",Ollama:"#00A86B",other:"#00BCD4"};
const FRONTIER_COLOR="#111111";
const channel=p=>p.id.startsWith("cursor_")?"Cursor":p.id.startsWith("opencode_")?"OpenCode":p.id.startsWith("command_code_")?"Command Code":p.id.startsWith("ollama_")?"Ollama":p.vendor;
const color=p=>VENDOR_COLOR[channel(p)]||VENDOR_COLOR.other;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const priceLabel=x=>"$"+Number(x.toPrecision(5)).toString();
const sel=document.getElementById("board");
for(const [id,b] of Object.entries(DATA.boards)){const o=document.createElement("option");o.value=id;o.textContent=b.name;sel.appendChild(o);}
document.getElementById("mix").textContent="缓存读取 "+(DATA.mix.cache*100).toFixed(1)+"% / 普通输入 "+(DATA.mix.input*100).toFixed(2)+"% / 输出 "+(DATA.mix.output*100).toFixed(2)+"%";

function pareto(pts,yk){let best=-Infinity,f=[];for(const p of [...pts].sort((a,b)=>a.real_usd_per_mtok-b.real_usd_per_mtok||b[yk]-a[yk])){if(p[yk]>best){best=p[yk];f.push(p);}}return f;}
function fmt(v){return v==null?"—":v;}
function hover(p,yk,vk){
  const board=yk.replace(/__score$/, ""),field=k=>p[board+"__"+k];
  const price=p.billing==="metered"?"按量 API（标价 × 项目标准负载）":`$${p.price_usd} ÷ ${p.monthly_yi} 亿 token`;
  return `<b>${p.label}</b><br>真实单价 <b>$${p.real_usd_per_mtok}/MTok</b><br>${price}`
   +(p.d!=null?`<br>标价混合 $${p.list_blended_usd_per_mtok}/MTok → d = ${(p.d*100).toFixed(1)}%`:"")
   +`<br>Y：${fmt(p[yk])}（${escapeHtml(fmt(p[vk]))}）`
   +`<br>Harness：${escapeHtml(fmt(field("agent_harness")))} · effort：${fmt(field("reasoning_effort"))}`
   +`<br>分数区间：${fmt(field("score_low"))} ～ ${fmt(field("score_high"))}`
   +`<br>来源任务成本（非订阅）：mean $${fmt(field("mean_cost_usd_per_task"))} / median $${fmt(field("median_cost_usd_per_task"))}`
   +`<br>映射：${field("mapping_kind")} [${field("mapping_confidence")}] · ${escapeHtml(fmt(field("mapping_note")))}`
   +`<br>分数来源：${escapeHtml(fmt(field("source")))}`
   +`<br>额度置信度 ${p.confidence} · ${p.source}`+(p.note?`<br><i>${p.note}</i>`:"")+"<extra></extra>";
}
// 同位置的点合并成一个，标签用 / 连接
function mergeSame(pts,yk,vk){
  const m=new Map();
  for(const p of pts){const k=p.real_usd_per_mtok+"|"+p[yk];
    if(m.has(k)){const g=m.get(k);g.label+=" / "+(p.model===g.model?p.plan:p.label);g.id+="+"+p.id;g.members.push(p);g.hoverExtra=(g.hoverExtra||"")+"<br>—<br>"+hover(p,yk,vk).replace("<extra></extra>","");}
    else m.set(k,{...p,members:[p]});}
  return [...m.values()];
}
// 标签只移动注释框，数据坐标保持不动。按屏幕空间避让点、线和已放置的标签。
function frontAnnotations(front,pts,yk,xrange,yrange,width,height){
  const px=p=>(xrange[0]-Math.log10(p.real_usd_per_mtok))/(xrange[0]-xrange[1])*width;
  const py=p=>height-(p[yk]-yrange[0])/(yrange[1]-yrange[0])*height;
  const placed=[],obstacles=pts.map(p=>[px(p),py(p)]),line=front.map(p=>[px(p),py(p)]);
  if(line.length){line.unshift([width,line[0][1]]);line.push([0,line[line.length-1][1]]);}
  for(let i=1;i<line.length;i++){const [x,y]=line[i-1],[xx,yy]=line[i];const n=Math.max(2,Math.ceil(Math.hypot(xx-x,yy-y)/10));for(let j=1;j<n;j++)obstacles.push([x+(xx-x)*j/n,y+(yy-y)*j/n]);}
  return [...front].reverse().map(p=>{
    const models=[...new Set(p.members.map(q=>q[yk.replace(/__score$/, "__variant")]||q.model_display))].join(" / ");
    const plans=[...new Set(p.members.map(q=>q.plan.replace("Claude ","").replace("ChatGPT ","")))];
    const rows=[models,...plans,priceLabel(p.real_usd_per_mtok)+" / MTok"];
    const w=Math.min(width-12,Math.max(...rows.map(s=>[...s].reduce((n,c)=>n+(c.charCodeAt(0)>255?12:6.6),0)))+18),h=rows.length*17+12;
    const x=px(p),y=py(p);let best=null;
    for(const dy of [-h/2-23,-h/2-70,h/2+24,-h/2-125,h/2+78,-h/2-180,h/2+130])for(const dx of [0,w/2+20,-w/2-20,w+25,-w-25]){
      const cx=Math.max(w/2+4,Math.min(width-w/2-4,x+dx)),cy=Math.max(h/2+4,Math.min(height-h/2-4,y+dy));
      const b={l:cx-w/2,r:cx+w/2,t:cy-h/2,b:cy+h/2};
      const overlaps=placed.filter(a=>b.l<a.r+9&&b.r>a.l-9&&b.t<a.b+9&&b.b>a.t-9).length;
      const covers=obstacles.filter(([ox,oy])=>ox>b.l-8&&ox<b.r+8&&oy>b.t-8&&oy<b.b+8).length;
      const score=overlaps*100000+covers*1000+Math.hypot(cx-x,cy-y)+(cy>y?25:0);
      if(!best||score<best.score)best={...b,cx,cy,score};
    }
    placed.push(best);
    return {x:Math.log10(p.real_usd_per_mtok),y:p[yk],xref:"x",yref:"y",text:rows.map((s,i)=>i===0?"<b>"+escapeHtml(s)+"</b>":escapeHtml(s)).join("<br>"),showarrow:true,arrowhead:0,arrowwidth:0.8,arrowcolor:"#bbb",standoff:12,ax:best.cx-x,ay:best.cy-y,xanchor:"center",yanchor:"middle",align:"center",bgcolor:"rgba(255,255,255,0.96)",borderpad:5,font:{size:11,color:"#222"}};
  });
}
function draw(){
  const board=sel.value,yk=board+"__score",vk=board+"__variant",meta=DATA.boards[board];
  const labelMode=document.getElementById("labels").value,showM=document.getElementById("metered").checked,showLow=document.getElementById("lowconf").checked;
  const tier=document.getElementById("tier").value;
  let pts=DATA.points.filter(p=>p[yk]!=null&&p.real_usd_per_mtok>0&&(showLow||p.confidence!=="low")&&(tier==="full"||p.tier==="main"));
  if(document.getElementById("configuration").value==="all"){
    const base=new Map(pts.map(p=>[p.id,p]));
    pts=DATA.configuration_points.filter(c=>c.board===board&&base.has(c.point_id)).map(c=>{
      const p={...base.get(c.point_id),id:c.point_id+"::"+c.configuration_id};
      for(const [k,v] of Object.entries(c))if(k!=="point_id"&&k!=="board")p[board+"__"+k]=v;
      return p;
    });
  }
  const subs=mergeSame(pts.filter(p=>p.billing==="subscription"),yk,vk),met=showM?mergeSame(pts.filter(p=>p.billing==="metered"),yk,vk):[];
  const front=pareto(subs.concat(met),yk),fid=new Set(front.map(p=>p.id));
  const hov=p=>hover(p,yk,vk).replace("<extra></extra>",(p.hoverExtra||"")+"<extra></extra>");
  const traces=[];
  // 非前沿点：按 x 排序后交替上下放标签，减少重叠
  const others=subs.filter(p=>!fid.has(p.id)).sort((a,b)=>a.real_usd_per_mtok-b.real_usd_per_mtok);
  const posOf=new Map(others.map((p,i)=>[p.id,["top center","bottom center","middle left","middle right"][i%4]]));
  for(const v of Object.keys(VENDOR_COLOR)){
    const g=subs.filter(p=>channel(p)===v&&!fid.has(p.id));if(!g.length)continue;
    traces.push({name:v,type:"scatter",mode:labelMode==="all"?"markers+text":"markers",x:g.map(p=>p.real_usd_per_mtok),y:g.map(p=>p[yk]),
      text:g.map(p=>p.label),textposition:g.map(p=>posOf.get(p.id)),textfont:{size:9,color:"#888"},
      marker:{size:8,symbol:"square",color:VENDOR_COLOR[v],opacity:0.45,line:{width:0}},hovertemplate:g.map(hov)});
  }
  if(met.length)traces.push({name:"按量 API",type:"scatter",mode:labelMode==="all"?"markers+text":"markers",x:met.map(p=>p.real_usd_per_mtok),y:met.map(p=>p[yk]),
    text:met.map(p=>p.label),textposition:"bottom center",textfont:{size:9,color:"#666"},
    marker:{size:9,symbol:"diamond-open",color:met.map(color),opacity:0.5,line:{width:1.3}},hovertemplate:met.map(hov)});
  const visible=subs.concat(met),xs=visible.map(p=>p.real_usd_per_mtok),ys=visible.map(p=>p[yk]);
  const xrange=xs.length?[Math.log10(Math.max(...xs))+0.13,Math.log10(Math.min(...xs))-0.16]:[0,-3];
  const span=ys.length?Math.max(1,Math.max(...ys)-Math.min(...ys)):1;
  const yrange=ys.length?[Math.min(...ys)-span*0.12,Math.max(...ys)+span*0.24]:[0,1];
  if(front.length)traces.push({name:"帕累托前沿",type:"scatter",mode:"lines",x:[10**xrange[1],...front.map(p=>p.real_usd_per_mtok),10**xrange[0]],y:[front[0][yk],...front.map(p=>p[yk]),front[front.length-1][yk]],line:{color:FRONTIER_COLOR,width:1.7},hoverinfo:"skip"});
  // 前沿点单独一层，标签放右上（前沿上方按定义是空的）
  traces.push({name:"前沿点",showlegend:false,type:"scatter",mode:"markers",x:front.map(p=>p.real_usd_per_mtok),y:front.map(p=>p[yk]),
    marker:{size:20,symbol:front.map(p=>p.billing==="metered"?"diamond":"square"),color:"white",line:{width:1.4,color:front.map(color)}},hovertemplate:front.map(hov)});
  traces.push({name:"前沿标记",showlegend:false,type:"scatter",mode:"markers",x:front.map(p=>p.real_usd_per_mtok),y:front.map(p=>p[yk]),marker:{size:9,symbol:front.map(p=>p.billing==="metered"?"diamond":"square"),color:front.map(color)},hovertemplate:front.map(hov)});
  for(const v of new Set(front.map(channel)))if(!others.some(p=>channel(p)===v))traces.push({name:v,type:"scatter",mode:"markers",x:[null],y:[null],marker:{color:VENDOR_COLOR[v],symbol:"square",size:8},hoverinfo:"skip"});
  const chart=document.getElementById("chart"),margin={l:75,r:35,t:95,b:75};
  const ticks=[10,5,2,1,.5,.2,.1,.05,.02,.01,.005,.002,.001,.0005].filter(x=>Math.log10(x)<=xrange[0]&&Math.log10(x)>=xrange[1]);
  const layout={
    title:{text:`${meta.name}  ·  快照 ${meta.snapshot} · 配置参考，非渠道实测`,x:0.04,y:0.98,font:{size:13}},
    xaxis:{type:"log",range:xrange,title:{text:"真实单价 $ / MTok    → 越右越便宜",standoff:18},tickvals:ticks,ticktext:ticks.map(x=>"$"+x),gridcolor:"#ececec",griddash:"dash",zeroline:false},
    yaxis:{range:yrange,title:{text:meta.metric,standoff:12},gridcolor:"#ececec",griddash:"dash",zeroline:false,ticksuffix:meta.metric.includes("%")?"%":""},
    annotations:labelMode==="none"?[]:frontAnnotations(front,visible,yk,xrange,yrange,Math.max(200,chart.clientWidth-margin.l-margin.r),Math.max(200,chart.clientHeight-margin.t-margin.b)),
    legend:{orientation:"h",y:1.07,x:0,font:{size:11},traceorder:"normal"},margin,paper_bgcolor:"#fff",plot_bgcolor:"#fff",font:{family:'Segoe UI, Microsoft YaHei, sans-serif',size:11,color:"#666"},hovermode:"closest",hoverlabel:{align:"left",bgcolor:"#fff",font:{size:12}}};
  Plotly.react("chart",traces,layout,{responsive:true,displaylogo:false,toImageButtonOptions:{format:"svg",filename:"帕累托_"+board}});
  document.getElementById("stats").textContent=`${subs.length} 个订阅位置 · ${met.length} 个 API 位置 · ${front.length} 个前沿位置`;
  document.getElementById("front-details").innerHTML="<table><thead><tr><th>模型 · 套餐</th><th>评测配置</th><th>$/MTok</th><th>分数</th><th>额度置信度</th><th>映射</th></tr></thead><tbody>"+front.flatMap(p=>p.members).map(p=>`<tr><td>${escapeHtml(p.label)}</td><td>${escapeHtml(fmt(p[vk]))}</td><td>${priceLabel(p.real_usd_per_mtok)}</td><td>${p[yk]}</td><td>${p.confidence}</td><td>${p[board+"__mapping_kind"]}</td></tr>`).join("")+"</tbody></table>";
  const missing=[...new Set(DATA.points.filter(p=>p[yk]==null&&(tier==="full"||p.tier==="main")).map(p=>p.model_display))];
  document.getElementById("unscored").textContent="订阅与按量API共同参与当前范围的帕累托前沿。无榜单分数未纳入："+(missing.join(" / ")||"无")+"。分数取对应模型或服务变体的已存档结果；连线仅为视觉引导，中间位置不代表可购方案。";
}
for(const id of ["board","tier","labels","metered","lowconf","configuration"])document.getElementById(id).addEventListener("change",draw);
let resizeTimer;window.addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(draw,150);});
draw();
</script></body></html>
"""


def main() -> None:
    data = json.loads(POINTS.read_text(encoding="utf-8"))
    data["configuration_points"] = json.loads((ROOT / "derived/benchmark-points.json").read_text(encoding="utf-8"))
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False)), encoding="utf-8")
    print(f"-> {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
