// 双色球跨期邻号独立回测：900/100 与长窗口(留出500) —— 与 dlt neighbor_backtest 口径对齐
// 玩法口径沿用页面：8红+2蓝复式，达标=命中≥4；基线=理论随机(超几何+蓝球2/16)
const SSQCore = require('./ssq-core.js');
const rows = JSON.parse(require('fs').readFileSync('data.json', 'utf8'));
const D = [...rows].reverse();              // 升序，N=1000
SSQCore.setCoreData(D);
const N = D.length;
const comb = (n,k)=>{ if(k<0||k>n)return 0; let r=1; for(let i=1;i<=k;i++)r=r*(n-i+1)/i; return r; };
const pRed = Array.from({length:7},(_,kk)=>comb(6,kk)*comb(27,8-kk)/comb(33,8));
const THEO = { ge4: pRed[4]+pRed[5]+pRed[6]+pRed[3]*(2/16), avg: 8*6/33 + 2/16 };
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function run(warm){
  const out = {};
  for(const m of ['AI_U_wide','v5_crossN','v2_hot','v1_cold']){
    let ge4=0,s=0,n=0;
    for(let k=warm;k<N;k++){
      const red = SSQCore.algoRed8(m,k);
      const blue = SSQCore.topM(SSQCore.algoScores(m,k).sb,2);
      const h = red.filter(x=>SSQCore.REDN[k].includes(x)).length + blue.filter(x=>SSQCore.BLUEN[k][0]===x).length;
      s+=h; ge4+=h>=4; n++;
    }
    out[m] = {ge4:ge4/n, avg:s/n};
  }
  let ra=0, rg=0;
  for(let t=0;t<10;t++){
    const rng=mulberry32(9001+warm+t); let s=0,g=0,n=0;
    for(let k=warm;k<N;k++){
      const pool=Array.from({length:33},(_,i)=>i+1);
      for(let i=32;i>0;i--){const j=(rng()*(i+1))|0;[pool[i],pool[j]]=[pool[j],pool[i]];}
      const red=pool.slice(0,8).sort((a,b)=>a-b);
      const b1=1+Math.floor(rng()*16); let b2=1+Math.floor(rng()*15); if(b2>=b1)b2++;
      const blue=[b1,b2];
      const h=red.filter(x=>SSQCore.REDN[k].includes(x)).length + (blue.includes(SSQCore.BLUEN[k][0])?1:0);
      s+=h; g+=h>=4; n++;
    }
    ra+=s/n; rg+=g/n;
  }
  out['random(10轮avg)']={ge4:rg/10, avg:ra/10};
  return out;
}
for(const [lbl,warm] of [['900/100(留出最近100)', N-100], ['长窗口(留出最近500)', N-500]]){
  console.log('=== 双色球 '+lbl+' ===');
  for(const [m,v] of Object.entries(run(warm))) console.log(`  ${m.padEnd(16)} ge4=${(v.ge4*100).toFixed(2)}% avg=${v.avg.toFixed(3)}`);
}
console.log(`随机基线(理论) ge4=${(THEO.ge4*100).toFixed(2)}% avg=${THEO.avg.toFixed(3)}`);
