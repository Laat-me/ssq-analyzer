const fs = require('fs');
let tpl = fs.readFileSync('template.html', 'utf8');
const ec = fs.readFileSync('echarts.min.js', 'utf8');
const core = fs.readFileSync('ssq-core.js', 'utf8');
const pred = fs.existsSync('predictions.json') ? fs.readFileSync('predictions.json', 'utf8') : '[]';
const data = fs.existsSync('data.json') ? fs.readFileSync('data.json', 'utf8') : '[]';
tpl = tpl
  .replace('__ECHARTS_JS__', () => ec)
  .replace('__CORE_JS__', () => core)
  .replace('__LIUYAO_JS__', () => fs.existsSync('liuyao.js') ? fs.readFileSync('liuyao.js', 'utf8') : '')
  .replace('__ZIWEI_JS__', () => fs.existsSync('ziwei.js') ? fs.readFileSync('ziwei.js', 'utf8') : '')
  .replace('__DATA_JSON__', () => data)
  .replace('__PRED_JSON__', () => pred);
fs.writeFileSync('双色球分析.html', tpl);
fs.writeFileSync('index.html', tpl);

const src = [...tpl.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();  // 最后一块 = 主脚本
// 先按浏览器真实顺序执行前置脚本块（core 设置全局 SSQCore；echarts 块允许失败，已有 stub 兜底）
const allBlocks = [...tpl.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
for(let i = 0; i < allBlocks.length - 1; i++){
  try { new Function(allBlocks[i])(); } catch(e){ console.log(`前置块 ${i} 在 Node 下跳过: ${e.message.slice(0,60)}`); }
}
const elems = {};
function el(id){
  if(!elems[id]) elems[id] = { innerHTML:'', textContent:'', style:{}, addEventListener(){}, appendChild(){} };
  return elems[id];
}
global.document = { getElementById: el, createElement: () => el('div') };
global.echarts = { init: () => ({ setOption(){}, resize(){}, on(){} }) };
global.window = { addEventListener(){} };
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

const t0 = Date.now();
try{
  new Function(src)();
  console.log('RUN OK in', Date.now()-t0, 'ms');
  console.log('--- 回测结论 ---');
  console.log(elems['algoConclusion'].textContent);
  console.log('--- 表格预览 ---');
  console.log(elems['algoTable'].innerHTML.replace(/<td[^>]*>/g,' | ').replace(/<\/tr>/g,'\n').slice(0, 1600));
  console.log('--- 选号票 ---');
  const names = [...elems['predGrid'].innerHTML.matchAll(/t-name">([^<]+)</g)].map(m=>m[1]);
  console.log(names.join(' | '));
}catch(e){
  console.log('RUNTIME ERROR:', e.message);
  console.log(e.stack.split('\n').slice(0,6).join('\n'));
  process.exit(1);
}
