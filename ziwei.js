/* 紫微娱乐选号（可复现兼容排盘，非预测模型）
 * 规则版本: ziwei-lite-v1
 * 输入: 公历出生年月日、时辰(0-23)、性别、时区、出生地标签
 * 说明: 这是稳定的娱乐映射，不等同于完整传统紫微斗数排盘；不声称提高中奖概率。
 */
(function(global){
'use strict';
const RULE_VERSION='ziwei-lite-v1';
const PALACES=['命宫','兄弟','夫妻','子女','财帛','疾厄','迁移','仆役','官禄','田宅','福德','父母'];
const STARS=['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
const FNV_OFFSET=2166136261, FNV_PRIME=16777619;
function fnv1a(s){let h=FNV_OFFSET; for(const ch of unescape(encodeURIComponent(s))){h^=ch.charCodeAt(0);h=Math.imul(h,FNV_PRIME);} return h>>>0;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function normalize(input){
  const x=Object.assign({calendar:'gregorian',year:1998,month:2,day:3,hour:12,gender:'unknown',timezone:'Asia/Shanghai',location:'未提供'},input||{});
  const gender=['male','female','unknown'].includes(x.gender)?x.gender:'unknown';
  return {calendar:String(x.calendar),year:+x.year,month:+x.month,day:+x.day,hour:+x.hour,gender,timezone:String(x.timezone),location:String(x.location)};
}
function chart(input){
  const x=normalize(input), key=[RULE_VERSION,x.calendar,x.year,x.month,x.day,x.hour,x.gender,x.timezone,x.location].join('|');
  const seed=fnv1a(key), sum=x.year+x.month+x.day+Math.floor(x.hour/2);
  const mingong=(sum%12+12)%12, shengong=(mingong+(x.month+x.hour)%12)%12;
  const stars=STARS.map((s,i)=>({name:s,palace:PALACES[(seed+i*7)%12]}));
  const fourHua=['禄','权','科','忌'].map((n,i)=>({name:n,star:STARS[(seed>>>((i*5)%24))%STARS.length]}));
  const fiveElement=['水二局','木三局','金四局','土五局','火六局'][sum%5];
  return {input:x,ruleVersion:RULE_VERSION,seed,birthFingerprint:fnv1a(key).toString(16).padStart(8,'0'),mingong:PALACES[mingong],shengong:PALACES[shengong],fiveElement,stars,fourHua};
}
function pick(max,m,rng){const a=Array.from({length:max},(_,i)=>i+1);for(let i=max-1;i>0;i--){const j=(rng()*(i+1))|0;[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,m).sort((a,b)=>a-b);}
function ticket(input,game,issue){
  const c=chart(input), rng=mulberry32((c.seed^fnv1a(`${game}|${issue}`))>>>0);
  const isSsq=game==='ssq';
  return {model:'紫微娱乐',ruleVersion:RULE_VERSION,birthFingerprint:c.birthFingerprint,seed:c.seed,chart:{mingong:c.mingong,shengong:c.shengong,fiveElement:c.fiveElement},isEntertainment:true,issue:String(issue),red:isSsq?pick(33,6,rng):pick(35,5,rng),blue:isSsq?pick(16,1,rng)[0]:pick(12,2,rng),game};
}
const API={RULE_VERSION,normalize,chart,ticket,fnv1a,mulberry32};
global.Ziwei=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
