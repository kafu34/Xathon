import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/server/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const origin='https://pace.test';
const send=(path,payload,env={GROQ_API_KEY:'test-key'})=>worker.fetch(new Request(origin+path,{method:'POST',headers:{origin,'content-type':'application/json','cf-connecting-ip':'test-'+Math.random()},body:JSON.stringify(payload)}),env);
const entry=(date,sleep)=>({date,sleep,steps:4800,activity:12,stress:3,hr:72,energy:3});
const context={profile:{name:'Private Name',school:'Private School',goals:['Improve sleep'],bedtime:'23:30',lifestyle:'Late-night studying'},entries:[entry('2026-09-21',6),entry('2026-09-22',6.2),entry('2026-09-23',6.1),entry('2026-09-24',6.4),entry('2026-09-25',6.3)],plan:[{date:'2026-09-26',items:[{id:'class',kind:'fixed',time:'09:00',end:'11:00',title:'Lab'},{id:'movement-2026-09-26',kind:'suggestion',time:'11:30',end:'11:50',title:'Walk',evidence:'movement'}]}],temporary:null,actions:[{date:'2026-09-25',status:'completed',minutes:20}],demo:true};
test('requires a server-side API key',async()=>{const response=await send('/api/ai/analysis',context,{});assert.equal(response.status,503);assert.equal((await response.json()).error,'ai_not_configured');});
test('returns a grounded model analysis and short-horizon numeric trend',async()=>{
  const original=globalThis.fetch;let request;
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');request=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'Your sleep looks fairly steady. This is an exploratory estimate.',reason:'The walk follows your lab.',recommended_item_id:'movement-2026-09-26',evidence_key:'movement'})}}]}),{status:200});};
  try{const response=await send('/api/ai/analysis',context);assert.equal(response.status,200);const result=await response.json();assert.equal(result.mode,'model');assert.equal(result.recommendedItem.id,'movement-2026-09-26');assert.equal(result.forecast.find(f=>f.metric==='sleep').daysAhead,3);assert.equal(request.model,'openai/gpt-oss-120b');assert.equal(request.response_format.json_schema.strict,true);assert.ok(!JSON.stringify(request).includes('Private Name'));assert.ok(!JSON.stringify(request).includes('Private School'));assert.match(request.messages[1].content,/Late-night studying/);assert.match(request.messages[1].content,/"completed":1/);}
  finally{globalThis.fetch=original;}
});
test('rejects a model-selected plan item that overlaps a fixed class',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({summary:'A short walk may fit.',reason:'Try this.',recommended_item_id:'overlap',evidence_key:'movement'})}}]}),{status:200});
  try{const overlapping=structuredClone(context);overlapping.plan[0].items.push({id:'overlap',kind:'suggestion',time:'10:00',end:'10:20',title:'Walk'});const result=await(await send('/api/ai/analysis',overlapping)).json();assert.equal(result.recommendedItem,null);}
  finally{globalThis.fetch=original;}
});
test('all-nighter reply offers recovery without changing a fixed exam',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({reply:'Understood. Your exam stays fixed. I can help plan recovery the next day.',action:'none',evidence_key:'sleep'})}}]}),{status:200});
  try{const result=await(await send('/api/ai/coach',{...context,message:'I have an all-nighter for my exam'})).json();assert.equal(result.action,'recovery');assert.match(result.reply,/exam stays fixed/);}
  finally{globalThis.fetch=original;}
});
test('shows a free-tier rate limit without exposing provider details',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":{"message":"private provider detail"}}',{status:429,headers:{'content-type':'application/json'}});
  try{const response=await send('/api/ai/coach',{...context,message:'Why a short walk?'});assert.equal(response.status,429);assert.deepEqual(await response.json(),{error:'rate_limited'});}
  finally{globalThis.fetch=original;}
});
