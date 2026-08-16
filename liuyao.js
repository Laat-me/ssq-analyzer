/* 六爻占卜号码生成器（玄学娱乐）— 双色球/大乐透两页与更新脚本共用
   起卦：最近9期每期掷两枚铜钱（coinsOf 返回 [背?, 背?]），18钱自初爻至上爻每三钱一爻
   出号：期号+上下卦数+动爻位构成种子，mulberry32 洗牌取号（完全确定性可复现） */
(function(global){
'use strict';
const TRI = [
  {b:'111', name:'乾', sym:'☰', num:1}, {b:'110', name:'兑', sym:'☱', num:2},
  {b:'101', name:'离', sym:'☲', num:3}, {b:'100', name:'震', sym:'☳', num:4},
  {b:'011', name:'巽', sym:'☴', num:5}, {b:'010', name:'坎', sym:'☵', num:6},
  {b:'001', name:'艮', sym:'☶', num:7}, {b:'000', name:'坤', sym:'☷', num:8}
];
const HEX64 = {
  '乾':{'乾':'乾为天','兑':'天泽履','离':'天火同人','震':'天雷无妄','巽':'天风姤','坎':'天水讼','艮':'天山遁','坤':'天地否'},
  '兑':{'乾':'泽天夬','兑':'兑为泽','离':'泽火革','震':'泽雷随','巽':'泽风大过','坎':'泽水困','艮':'泽山咸','坤':'泽地萃'},
  '离':{'乾':'火天大有','兑':'火泽睽','离':'离为火','震':'火雷噬嗑','巽':'火风鼎','坎':'火水未济','艮':'火山旅','坤':'火地晋'},
  '震':{'乾':'雷天大壮','兑':'雷泽归妹','离':'雷火丰','震':'震为雷','巽':'雷风恒','坎':'雷水解','艮':'雷山小过','坤':'雷地豫'},
  '巽':{'乾':'风天小畜','兑':'风泽中孚','离':'风火家人','震':'风雷益','巽':'巽为风','坎':'风水涣','艮':'风山渐','坤':'风地观'},
  '坎':{'乾':'水天需','兑':'水泽节','离':'水火既济','震':'水雷屯','巽':'水风井','坎':'坎为水','艮':'水山蹇','坤':'水地比'},
  '艮':{'乾':'山天大畜','兑':'山泽损','离':'山火贲','震':'山雷颐','巽':'山风蛊','坎':'山水蒙','艮':'艮为山','坤':'山地剥'},
  '坤':{'乾':'地天泰','兑':'地泽临','离':'地火明夷','震':'地雷复','巽':'地风升','坎':'地水师','艮':'地山谦','坤':'坤为地'}
};
const YAO_NAME = ['初爻','二爻','三爻','四爻','五爻','上爻'];
const CAST_NAME = ['老阴 ×（动）','少阳','少阴','老阳 ○（动）'];
const SHICHEN = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
function mulberry32(a){
  return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
}
function pickWith(rnd, maxn, m){
  const arr = Array.from({length:maxn}, (_,i)=>i+1);
  for(let i=maxn-1;i>0;i--){ const j=(rnd()*(i+1))|0; const t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
  return arr.slice(0,m).sort((a,b)=>a-b);
}
/* divine(last9, coinsOf, nextCode, range, timeInfo)
   - last9: 最近9期（时间升序）；coinsOf(d)->[币1背?,币2背?]
   - range: {frontMax, frontN, backMax, backN}
   - timeInfo 可选:
       {y,m,d,hour}         开奖时间 → 按年月日时（公历简化，梅花易数法）起"起始卦"
       {y,m,d,isBirthday:1} 生日 → 按生日起"生日卦"（上卦=年+月+日，下卦=年+月+日+月×日，动爻=和%6）
     起始/生日卦与前九期铜钱卦共同决定种子 */
function divine(last9, coinsOf, nextCode, range, timeInfo){
  const coins = [];
  last9.forEach(d => { const c = coinsOf(d); coins.push(c[0] ? 1 : 0, c[1] ? 1 : 0); });
  const backs6 = [];
  for(let i=0;i<6;i++) backs6.push(coins[3*i] + coins[3*i+1] + coins[3*i+2]);
  const yang = backs6.map(b => (b===1 || b===3) ? 1 : 0);
  const moving = backs6.map(b => b===0 || b===3);
  const triOf = a => TRI.find(t => t.b === a.join(''));
  const lower = triOf(yang.slice(0,3)), upper = triOf(yang.slice(3));
  const yang2 = yang.map((v,i) => moving[i] ? 1-v : v);
  const lower2 = triOf(yang2.slice(0,3)), upper2 = triOf(yang2.slice(3));
  const benGua = HEX64[upper.name][lower.name];
  const bianGua = (lower2 && upper2) ? HEX64[upper2.name][lower2.name] : '';
  const movingIdx = moving.map((m,i) => m ? YAO_NAME[i] : null).filter(Boolean);
  const moveMask = moving.reduce((a,m,i) => a + (m ? 1<<i : 0), 0);

  // 起始卦（开奖时间）或生日卦（梅花易数，公历简化）
  let timeGua = null, timeNum = 0;
  if(timeInfo && timeInfo.y){
    const byNum = n => TRI.find(t => t.num === ((n - 1) % 8) + 1);
    if(timeInfo.isBirthday){
      const s1 = timeInfo.y + timeInfo.m + timeInfo.d, s2 = s1 + timeInfo.m * timeInfo.d;
      const uT = byNum(s1), lT = byNum(s2);
      timeGua = { upper: uT, lower: lT, name: HEX64[uT.name][lT.name],
                  dongYao: ((s2 - 1) % 6) + 1, isBirthday: true };
    } else {
      const shichen = Math.floor(((timeInfo.hour + 1) % 24) / 2) + 1;   // 21点→亥时(12)
      const s1 = timeInfo.y + timeInfo.m + timeInfo.d, s2 = s1 + shichen;
      const uT = byNum(s1), lT = byNum(s2);
      timeGua = { upper: uT, lower: lT, name: HEX64[uT.name][lT.name],
                  dongYao: ((s2 - 1) % 6) + 1, shichen, shichenName: SHICHEN[shichen - 1] };
    }
    timeNum = timeInfo.y * 10000 + timeInfo.m * 100 + timeInfo.d;
  }
  const seed = (Number(nextCode) || 0) * 1000003 + timeNum * 7919
             + (upper.num-1)*512 + (lower.num-1)*64 + moveMask;
  const rnd = mulberry32(seed);
  return { coins, backs6, yang, moving, yaoName: YAO_NAME, castName: CAST_NAME,
           lower, upper, lower2, upper2, benGua, bianGua, movingIdx, timeGua, seed,
           front: pickWith(rnd, range.frontMax, range.frontN),
           back: pickWith(rnd, range.backMax, range.backN) };
}
const API = { divine, TRI, HEX64, YAO_NAME, CAST_NAME };
global.LiuYao = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
