// 双色球页面数据更新脚本（dlt-analyzer 式闭环）：
//   拉取最新开奖 → 追加 data.json → 比对 predictions.json 历史命中 →
//   生成下一期预测写入 predictions.json → 重新生成 HTML（内嵌数据+预测记录）
// 用法: node update.js
const fs = require('fs');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const PAGE = 'https://www.cwl.gov.cn/ygkj/wqkjgg/ssq/';
const API = 'https://www.cwl.gov.cn/cwl_admin/front/cwlkj/search/kjxx/findDrawNotice?name=ssq&issueCount=1000';

async function main(){
  // 1) 访问页面拿 cookie
  const r1 = await fetch(PAGE, { headers: { 'user-agent': UA } });
  const setCookies = (r1.headers.getSetCookie && r1.headers.getSetCookie()) || [];
  const cookie = setCookies.map(c => c.split(';')[0]).join('; ');

  // 2) 拉最近1000期
  const r2 = await fetch(API, {
    headers: { 'user-agent': UA, 'cookie': cookie, 'referer': PAGE, 'accept': 'application/json' }
  });
  const txt = await r2.text();
  let j;
  try { j = JSON.parse(txt); } catch(e){
    console.error('接口返回非 JSON（前200字）：', txt.slice(0,200)); process.exit(1);
  }
  if (j.state !== 0 || !Array.isArray(j.result)){
    console.error('接口异常：', j.message || j.state); process.exit(1);
  }

  // 3) 合并到本地 data.json（新期在前，保留最近1000期）
  const fresh = j.result.map(r => ({
    c: r.code, d: r.date, r: r.red.split(',').map(Number).sort((a,b)=>a-b), b: +r.blue, s: +r.sales
  })).filter(x => x.r.length === 6 && !x.r.some(isNaN) && x.b >= 1 && x.b <= 16);
  const old = JSON.parse(fs.readFileSync('data.json', 'utf8'));
  const map = new Map(old.map(x => [x.c, x]));
  fresh.forEach(x => map.set(x.c, x));
  const merged = [...map.values()].sort((a,b) => b.c.localeCompare(a.c)).slice(0, 1000);
  const added = merged.filter(x => !old.some(o => o.c === x.c)).map(x => x.c);
  fs.writeFileSync('data.json', JSON.stringify(merged));
  console.log(`数据：本地 ${old.length} 期 + 接口 ${fresh.length} 期 → 合并 ${merged.length} 期`);
  console.log(`最新一期：${merged[0].c}（${merged[0].d}）  新增期号：${added.length ? added.join(', ') : '无'}`);

  // 4) 预测历史：比对已开奖期 + 生成下一期预测（写入 predictions.json，永久保留）
  const SSQCore = require('./ssq-core.js');
  const D = [...merged].reverse();          // 时间升序
  SSQCore.setCoreData(D);
  let preds = [];
  if (fs.existsSync('predictions.json')){
    try { preds = JSON.parse(fs.readFileSync('predictions.json', 'utf8')); } catch(e){ console.log('predictions.json 解析失败，重建'); }
  }
  let verifiedNew = 0;
  for(const p of preds){
    if(p.verified) continue;
    const idx = merged.findIndex(x => x.c === p.issue);
    if (idx >= 0){
      const R = merged[idx].r, B = merged[idx].b;
      p.verified = true;
      p.actual = { red: R, blue: B };
      p.tickets.forEach(t => { t.redHits = t.red.filter(n => R.includes(n)).length; t.blueHit = t.blue === B ? 1 : 0; });
      verifiedNew++;
      console.log(`比对 ${p.issue} 期：${p.tickets.map(t => `${t.name.slice(2,12)} 红${t.redHits}蓝${t.blueHit}`).join(' | ')}`);
    }
  }
  const nextCode = String(Number(merged[0].c) + 1);
  if (!preds.some(p => p.issue === nextCode)){
    const rng = SSQCore.mulberry32(Number(nextCode) || 20260816);   // 按期号定种子，记录可复现
    const tickets = SSQCore.predictTickets(D.length, rng);
    preds.push({ issue: nextCode, time: new Date().toLocaleString('zh-CN'), tickets });
    console.log(`已生成下一期（${nextCode}）预测并追加到 predictions.json`);
  } else {
    console.log(`下一期（${nextCode}）预测已存在，不重复生成`);
  }
  // 六爻占卜注（确定性玄学娱乐）：前九期起卦 + 下期开奖时间起始卦，补进/刷新当期未验证记录
  const LiuYao = require('./liuyao.js');
  const rec = preds.find(p => p.issue === nextCode);
  if(rec){
    const lastDate = new Date(merged[0].d.replace(/\(.+$/, ''));
    let add2 = 1;
    while (![0,2,4].includes(new Date(lastDate.getTime() + add2*864e5).getDay())) add2++;
    const nd = new Date(lastDate.getTime() + add2*864e5);
    const timeInfo = { y: nd.getFullYear(), m: nd.getMonth()+1, d: nd.getDate(), hour: 21 };   // 21:15 开奖
    const g = LiuYao.divine(D.slice(-9), d => [d.r.reduce((a,b)=>a+b,0) % 2 === 1, d.b % 2 === 1],
                            nextCode, {frontMax:33, frontN:6, backMax:16, backN:1}, timeInfo);
    rec.tickets = rec.tickets.filter(t => t.name !== '🀄 六爻占卜');   // 未开奖前刷新为最新卦象
    rec.tickets.push({ name:'🀄 六爻占卜',
      desc:`前九期起卦${g.timeGua ? ` + 开奖时间起始卦${g.timeGua.name}` : ''}（${g.benGua}${g.bianGua ? '变'+g.bianGua : ''}，玄学娱乐）`,
      red:g.front, blue:g.back[0] });
    console.log(`六爻占卜注已更新到 ${nextCode}（起始卦${g.timeGua ? g.timeGua.name : '—'}，本卦${g.benGua}${g.bianGua?'变'+g.bianGua:''}）`);
  }
  fs.writeFileSync('predictions.json', JSON.stringify(preds, null, 1));

  // 5) 重新组装 HTML（echarts + 算法核心 + 开奖数据 + 预测记录 全部内嵌）
  const tpl = fs.readFileSync('template.html', 'utf8');
  const ec = fs.readFileSync('echarts.min.js', 'utf8');
  const core = fs.readFileSync('ssq-core.js', 'utf8');
  if (ec.includes('</'+'script') || core.includes('</'+'script')){ console.error('内嵌脚本含 </script>，中止'); process.exit(1); }
  const html = tpl
    .replace('__ECHARTS_JS__', () => ec)
    .replace('__CORE_JS__', () => core)
    .replace('__LIUYAO_JS__', () => fs.readFileSync('liuyao.js', 'utf8'))
    .replace('__DATA_JSON__', () => fs.readFileSync('data.json', 'utf8'))
    .replace('__PRED_JSON__', () => fs.readFileSync('predictions.json', 'utf8'));
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  scripts.forEach((s, i) => { try { new Function(s); } catch(e){ console.error(`脚本块 ${i} 语法错误:`, e.message); process.exit(1); } });
  fs.writeFileSync('双色球分析.html', html);
  fs.writeFileSync('index.html', html);
  console.log('已重新生成 双色球分析.html / index.html（含预测记录）');
}
main().catch(e => { console.error('更新失败：', e.message); process.exit(1); });
