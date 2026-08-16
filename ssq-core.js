/* 双色球算法核心：特征工程 + 12 个移植算法（dlt-analyzer）+ 预测生成
   浏览器与 Node 共用：
   - 浏览器：内联本文件后调用 SSQCore.setCoreData(D)（D 为时间升序开奖数组）
   - Node：  const SSQCore = require('./ssq-core.js'); SSQCore.setCoreData(D) */
(function(global){
'use strict';
const NR = 33, NB = 16;
const E30R = 30*6/NR, E30B = 30/NB;
let REDN, BLUEN, N, FALLr, F30r, F10r, F5r, F300r,
    BALLb, B30b, B10b, B5b, RFr, RBb, NCFr, NCBb, GFr, GBb;

/* ---------- 特征工程 ---------- */
function cumFreq(arr, maxn, win){
  const out = [new Float64Array(maxn)];
  for(let k=1;k<=arr.length;k++){          // 多算一行 k=N 供预测下一期使用
    const cur = Float64Array.from(out[k-1]);
    if(win != null && k-win-1 >= 0) for(const x of arr[k-win-1]) cur[x-1]--;
    for(const x of arr[k-1]) cur[x-1]++;
    out.push(cur);
  }
  return out;
}
function repeatFlags(arr, maxn){
  const out = [new Float64Array(maxn)];
  for(let k=1;k<=arr.length;k++){ const cur = new Float64Array(maxn); for(const x of arr[k-1]) cur[x-1] = 1; out.push(cur); }
  return out;
}
function neighborCounts(arr, maxn, r){
  const out = [new Float64Array(maxn)];
  for(let k=1;k<=arr.length;k++){
    const cur = new Float64Array(maxn);
    for(const x of arr[k-1]){ const lo=Math.max(1,x-r), hi=Math.min(maxn,x+r); for(let n=lo;n<=hi;n++) cur[n-1]++; cur[x-1]--; }
    out.push(cur);
  }
  return out;
}
function gapMap(arr, maxn){
  const out = [], last = Array(maxn).fill(-1);
  for(let k=0;k<=arr.length;k++){
    const cur = new Float64Array(maxn);
    for(let n=1;n<=maxn;n++) cur[n-1] = last[n-1] < 0 ? k : k-1-last[n-1];
    out.push(cur);
    if(k<arr.length) for(const x of arr[k]) last[x-1] = k;
  }
  return out;
}

/* ---------- 工具 ---------- */
const V = {
  scale:(a,c)=>Float64Array.from(a,v=>v*c),
  subC:(c,a)=>Float64Array.from(a,v=>c-v),
  add:(...as)=>{ const out=new Float64Array(as[0].length); for(const a of as) for(let i=0;i<out.length;i++) out[i]+=a[i]; return out; },
  norm:(F,k)=>{ const row=F[k]; let mx=1; for(const v of row) if(v>mx) mx=v; return Float64Array.from(row,v=>v/mx); }
};
function topM(scores, m){
  return [...scores.keys()].sort((a,b)=>scores[b]-scores[a]||a-b).slice(0,m).map(i=>i+1).sort((a,b)=>a-b);
}
function mulberry32(a){
  return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}

/* ---------- 约束选号（8红复式 / 6红单式） ---------- */
function okRed8(f){
  let ev=0,z1=0,z2=0,s=0;
  for(const n of f){ if(n%2===0)ev++; if(n<=11)z1++; else if(n<=22)z2++; s+=n; }
  const z3 = 8-z1-z2;
  return ev>=3&&ev<=5&&z1>=1&&z1<=4&&z2>=1&&z2<=4&&z3>=1&&z3<=4&&s>=90&&s<=180&&f[7]-f[0]>=18;
}
function okRed6(f){
  let ev=0,z1=0,z2=0,s=0;
  for(const n of f){ if(n%2===0)ev++; if(n<=11)z1++; else if(n<=22)z2++; s+=n; }
  const z3 = 6-z1-z2;
  return ev>=2&&ev<=4&&z1>=1&&z1<=3&&z2>=1&&z2<=3&&z3>=1&&z3<=3&&s>=70&&s<=140&&f[5]-f[0]>=15;
}
function combosOf(m, topk){
  const res=[];
  (function rec(start, cur){
    if(cur.length===m){ res.push(cur.slice()); return; }
    for(let i=start;i<topk;i++){ cur.push(i); rec(i+1,cur); cur.pop(); }
  })(0,[]);
  return res;
}
const COMBOS8 = combosOf(8,12), COMBOS6 = combosOf(6,12);
function pickConstrained(sf, m, okFn, combos){
  const order=[...sf.keys()].sort((a,b)=>sf[b]-sf[a]||a-b);
  const pool=order.slice(0,12).map(i=>i+1).sort((a,b)=>a-b);
  let best=null, bestS=-Infinity;
  for(const c of combos){
    const f=c.map(i=>pool[i]);
    if(okFn(f)){ let s=0; for(const n of f) s+=sf[n-1]; if(s>bestS){ bestS=s; best=f; } }
  }
  return best || topM(sf,m);
}
const pickRed8 = sf => pickConstrained(sf,8,okRed8,COMBOS8);
const pickRed6 = sf => pickConstrained(sf,6,okRed6,COMBOS6);

/* ---------- 12 个移植算法（公式见 dlt-analyzer/algorithms.py） ---------- */
function diri(row){ const a=Float64Array.from(row,v=>v+1); let s=0; for(const v of a)s+=v; return Float64Array.from(a,v=>v/s); }
const ALGOS = [];
function reg(name, family, desc, fn, opts){ ALGOS.push(Object.assign({name, family, desc, fn}, opts||{})); }

reg('v1_cold','追冷','gap×0.5+冷30×2.5+全期偏冷×0.3', k=>({
  sf: V.add(V.scale(GFr[k],0.5), V.scale(V.subC(E30R,F30r[k]),2.5), V.scale(V.subC(k*6/NR,FALLr[k]),0.3)),
  sb: V.add(V.scale(GBb[k],0.6), V.scale(V.subC(E30B,B30b[k]),2))
}), {constrained:true});
reg('v2_hot','追热','近5×3+近10×1.5+邻域×4+连出×4', k=>({
  sf: V.add(V.scale(F5r[k],3), V.scale(F10r[k],1.5), V.scale(NCFr[0][k],4), Float64Array.from(F5r[k],v=>v>=2?4:0)),
  sb: V.add(V.scale(B5b[k],3), V.scale(B10b[k],1.5))
}), {constrained:true});
reg('AI_U_wide','频次重号邻域','全期频次+重号×0.5+r3邻域×0.2', k=>({
  sf: V.add(V.norm(FALLr,k), V.scale(RFr[k],0.5), V.scale(NCFr[2][k],0.2)),
  sb: V.add(V.norm(BALLb,k), V.scale(RBb[k],0.5), V.scale(NCBb[2][k],0.2))
}), {constrained:true});
reg('H_dirichlet','贝叶斯','Dirichlet(α=1)平滑频率', k=>({ sf: diri(FALLr[k]), sb: diri(BALLb[k]) }));
reg('I_recency_eb','指数加权','γ=0.995递减加权(近500期)', k=>{
  const sf=new Float64Array(NR), sb=new Float64Array(NB);
  for(let t=Math.max(0,k-500);t<k;t++){ const w=Math.pow(0.995,k-1-t); for(const x of REDN[t]) sf[x-1]+=w; sb[BLUEN[t][0]-1]+=w; }
  return {sf,sb};
});
reg('J_repeat_markov','马尔可夫','0.7×频次+0.3×上期重号', k=>({
  sf: V.add(V.scale(V.norm(FALLr,k),0.7), V.scale(RFr[k],0.3)),
  sb: V.add(V.scale(V.norm(BALLb,k),0.7), V.scale(RBb[k],0.3))
}));
reg('M_tail','尾号','频次+尾号分布×0.5(近100期)', k=>{
  const tf=new Float64Array(10), tb=new Float64Array(10);
  for(let t=Math.max(0,k-100);t<k;t++){ for(const x of REDN[t]) tf[x%10]++; tb[BLUEN[t][0]%10]++; }
  return {
    sf: V.add(V.norm(FALLr,k), V.scale(Float64Array.from({length:NR},(_,i)=>tf[(i+1)%10]),0.5)),
    sb: V.add(V.norm(BALLb,k), V.scale(Float64Array.from({length:NB},(_,i)=>tb[(i+1)%10]),0.5))
  };
});
reg('AZ_period7','周期','频次+7期前同号×0.3', k=>{
  const sf=V.norm(FALLr,k), sb=V.norm(BALLb,k);
  if(k>=7){ for(const x of REDN[k-7]) sf[x-1]+=0.3; sb[BLUEN[k-7][0]-1]+=0.3; }
  return {sf,sb};
});
reg('AV_rolling300','滚动窗口','近300期频次+重号×0.18', k=>({
  sf: V.add(V.norm(F300r,k), V.scale(RFr[k],0.18)),
  sb: V.add(V.norm(BALLb,k), V.scale(RBb[k],0.18))
}));
reg('K_prob_ensemble','集成投票','H+I+J 等权投票', null, {vote:['H_dirichlet','I_recency_eb','J_repeat_markov']});
reg('AO_stacked_vote','堆叠投票','AI_U_wide+H+J+M 四算法投票', null, {vote:['AI_U_wide','H_dirichlet','J_repeat_markov','M_tail']});
reg('v3','冷热组合','v1冷号池3个+v2热号池5个', null, {v3:true});

const ALGO_BY = Object.fromEntries(ALGOS.map(a=>[a.name,a]));
function algoScores(name, k){
  const a = ALGO_BY[name];
  if(a.vote){
    const sf=new Float64Array(NR), sb=new Float64Array(NB);
    for(const nm of a.vote){ const s=algoScores(nm,k); for(const n of topM(s.sf,8)) sf[n-1]++; for(const n of topM(s.sb,2)) sb[n-1]++; }
    return {sf,sb};
  }
  if(a.v3){
    const c=algoScores('v1_cold',k), h=algoScores('v2_hot',k);
    return {sf:V.add(c.sf,h.sf), sb:h.sb, v3cold:c.sf, v3hot:h.sf};
  }
  return a.fn(k);
}
function algoRed8(name, k){
  const a = ALGO_BY[name], s = algoScores(name,k);
  return a.constrained ? pickRed8(s.sf) : topM(s.sf,8);
}

/* ---------- 预测生成（页面展示与 predictions.json 同源） ---------- */
function weightedPick(weights, kNum, rng){
  const rand = rng || Math.random;
  const idx = weights.map((w,i)=>({i, w:Math.max(w,0)}));
  const out = [];
  for(let t=0;t<kNum;t++){
    let total = idx.reduce((a,x)=>a+x.w, 0), r = rand()*total;
    let sel = idx[0].i;
    for(const x of idx){ r -= x.w; if(r<=0){ sel = x.i; break; } }
    out.push(sel);
    idx.splice(idx.findIndex(x=>x.i===sel), 1);
  }
  return out;
}
function predictTickets(k, rng){
  const rand = rng || Math.random;
  const s1=algoScores('v1_cold',k), s2=algoScores('v2_hot',k), s3=algoScores('v3',k),
        s4=algoScores('AI_U_wide',k), s5=algoScores('K_prob_ensemble',k);
  const v3red = topM(s3.v3cold,3).concat(topM(s3.v3hot,3));
  const seen=[...new Set(v3red)];
  if(seen.length<6) for(const n of topM(V.add(s3.v3cold,s3.v3hot),8)) if(!seen.includes(n)&&seen.length<6) seen.push(n);
  return [
    { name:'🧊 v1_cold 追冷流', desc:'gap×0.5 + 冷30×2.5 + 全期偏冷×0.3', red: pickRed6(s1.sf), blue: topM(s1.sb,1)[0] },
    { name:'🔥 v2_hot 追热流', desc:'近5频×3 + 近10频×1.5 + 邻域×4 + 连出×4', red: pickRed6(s2.sf), blue: topM(s2.sb,1)[0] },
    { name:'⚖️ v3 冷热组合', desc:'v1 冷号池 3 个 + v2 热号池 3 个', red: seen.sort((a,b)=>a-b), blue: topM(s2.sb,1)[0] },
    { name:'🧠 AI_U_wide', desc:'频次+重号×0.5+邻域×0.2，约束枚举（DLT 短窗最优还原版）', red: pickRed6(s4.sf), blue: topM(s4.sb,1)[0] },
    { name:'🗳️ K_prob_ensemble', desc:'Dirichlet + 指数加权 + 马尔可夫 三算法投票', red: pickRed6(s5.sf), blue: topM(s5.sb,1)[0] },
    { name:'🎲 纯随机流（对照）', desc:'完全均匀随机，胜率与上面完全相同', red: weightedPick(Array.from({length:NR+1},(_,i)=>i===0?0:1), 6, rand).sort((a,b)=>a-b), blue: 1+Math.floor(rand()*NB) },
  ];
}

/* ---------- 初始化 ---------- */
function setCoreData(D){
  REDN = D.map(d=>d.r); BLUEN = D.map(d=>[d.b]); N = D.length;
  FALLr = cumFreq(REDN,NR,null); F30r = cumFreq(REDN,NR,30); F10r = cumFreq(REDN,NR,10);
  F5r = cumFreq(REDN,NR,5); F300r = cumFreq(REDN,NR,300);
  BALLb = cumFreq(BLUEN,NB,null); B30b = cumFreq(BLUEN,NB,30);
  B10b = cumFreq(BLUEN,NB,10); B5b = cumFreq(BLUEN,NB,5);
  RFr = repeatFlags(REDN,NR); RBb = repeatFlags(BLUEN,NB);
  NCFr = [1,2,3].map(r=>neighborCounts(REDN,NR,r)); NCBb = [1,2,3].map(r=>neighborCounts(BLUEN,NB,r));
  GFr = gapMap(REDN,NR); GBb = gapMap(BLUEN,NB);
}

const CORE = {
  setCoreData, predictTickets, algoScores, algoRed8, topM, pickRed6, pickRed8, mulberry32,
  get REDN(){ return REDN; }, get BLUEN(){ return BLUEN; },
  get N(){ return N; }, get F5r(){ return F5r; },
  get ALGOS(){ return ALGOS; }
};
global.SSQCore = CORE;                                            // 浏览器/Node 全局可用
if (typeof module !== 'undefined' && module.exports) module.exports = CORE;  // Node: require('./ssq-core.js')
})(typeof window !== 'undefined' ? window : globalThis);
