// 综合集成推荐一注 8+2：12 算法各投 top8 红球/top2 蓝球 → 汇总票数 → 约束枚举选 8 红 + 票数前 2 蓝
const fs = require('fs');
const SSQCore = require('D:/dream/ssq/ssq-core.js');
const rows = JSON.parse(fs.readFileSync('D:/dream/ssq/data.json', 'utf8'));
const D = [...rows].reverse();            // 时间升序，最新 2026093
SSQCore.setCoreData(D);
const k = D.length;                        // 预测 2026094

const votes = Array(34).fill(0), blueVotes = Array(17).fill(0);
const contrib = {};                        // 每个号码的投票算法清单
for(const a of SSQCore.ALGOS){
  const red8 = SSQCore.algoRed8(a.name, k);
  red8.forEach(n => { votes[n]++; (contrib[n] = contrib[n] || []).push(a.name); });
  SSQCore.topM(SSQCore.algoScores(a.name, k).sb, 2).forEach(n => blueVotes[n]++);
}

// 综合分 = 票数为主；同票数用各算法得分排名均值做次序（避免平局随机）
// 注意：ssq-core 选号函数为 0-based 约定（score[i] ↔ 号码 i+1），此处显式转换
const rankSum = Array(34).fill(0);
for(const a of SSQCore.ALGOS){
  const s = SSQCore.algoScores(a.name, k);
  const order = [...s.sf.keys()].sort((x,y) => s.sf[y]-s.sf[x] || x-y);
  order.forEach((idx, r) => rankSum[idx+1] += r);   // rankSum[n] = 号码 n 的排名和
}
const score = Float64Array.from({length:34}, (_, i) => {   // score[i] = 号码 i+1 的综合分
  const n = i + 1;
  return votes[n]*100 - rankSum[n]/100;
});
const red8 = SSQCore.pickRed8(score);       // top12 池 + 奇偶/区间/和值/跨度约束枚举

const blueOrder = [...blueVotes.keys()].slice(1).sort((a,b) => blueVotes[b]-blueVotes[a] || a-b);
const blue2 = blueOrder.slice(0, 2);

console.log('=== 12 算法红球得票（>0） ===');
[...votes.keys()].filter(n => n > 0 && votes[n] > 0).sort((a,b) => votes[b]-votes[a] || a-b)
  .forEach(n => console.log(`  ${String(n).padStart(2,'0')} 号: ${votes[n]} 票  ← ${contrib[n].join(', ')}`));
console.log('\n=== 蓝球得票（前6） ===');
blueOrder.slice(0,6).forEach(n => console.log(`  ${String(n).padStart(2,'0')} 号: ${blueVotes[n]} 票`));

const sum = red8.reduce((a,b)=>a+b,0), ev = red8.filter(n=>n%2===0).length;
const z1 = red8.filter(n=>n<=11).length, z2 = red8.filter(n=>n>=12&&n<=22).length, z3 = red8.filter(n=>n>=23).length;
console.log('\n=== 推荐一注 8+2（第 2026094 期） ===');
console.log(`红球: ${red8.map(n=>String(n).padStart(2,'0')).join(' ')}`);
console.log(`蓝球: ${blue2.map(n=>String(n).padStart(2,'0')).join(' ')}`);
console.log(`形态: 和值${sum} 偶${ev}奇${8-ev} 区间${z1}-${z2}-${z3} 跨度${red8[7]-red8[0]}`);
console.log(`红球票数: ${red8.map(n=>votes[n]).join('/')}`);
