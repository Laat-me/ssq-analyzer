// 生日六爻起卦：1998-02-03 生日卦 + 前九期铜钱卦 → 双色球 6+1 与大乐透 5+2
const fs = require('fs');
const LiuYao = require('D:/dream/ssq/liuyao.js');
const B = { y: 1998, m: 2, d: 3, isBirthday: 1 };

// 双色球（data.json 新在前 → 转升序）
const ssq = JSON.parse(fs.readFileSync('D:/dream/ssq/data.json', 'utf8'));
const ssqD = [...ssq].reverse();
const ssqNext = String(Number(ssq[0].c) + 1);
const ssqG = LiuYao.divine(ssqD.slice(-9), d => [d.r.reduce((a,b)=>a+b,0) % 2 === 1, d.b % 2 === 1],
                           ssqNext, {frontMax:33, frontN:6, backMax:16, backN:1}, B);

// 大乐透（draws.json 升序）
const dlt = JSON.parse(fs.readFileSync('D:/dream/dlt-analyzer/.agents/skills/dlt-analyzer/data/draws.json', 'utf8')).draws;
const dltNext = String(Number(dlt[dlt.length-1].num) + 1);
const dltG = LiuYao.divine(dlt.slice(-9), d => [d.front.reduce((a,b)=>a+b,0) % 2 === 1, d.back.reduce((a,b)=>a+b,0) % 2 === 1],
                           dltNext, {frontMax:35, frontN:5, backMax:12, backN:2}, B);

function show(name, g, fN, bN){
  const t = g.timeGua;
  console.log(`\n=== ${name} 第 ${fN} 期 ===`);
  console.log(`生日卦（1998-02-03）：${t.upper.sym}${t.lower.sym} ${t.name} · 动爻${t.dongYao}`);
  console.log(`前九期铜钱卦：本卦 ${g.upper.sym}${g.lower.sym} ${g.benGua}${g.movingIdx.length ? ` 变 ${g.bianGua}（${g.movingIdx.join('、')}）` : ''}`);
  console.log(`seed=${g.seed}`);
  console.log(`号码：${g.front.map(n=>String(n).padStart(2,'0')).join(' ')} + ${g.back.map(n=>String(n).padStart(2,'0')).join(' ')}`);
}
show('双色球', ssqG, ssqNext);
show('大乐透', dltG, dltNext);
