// Optional integration check: uses synthetic data and the existing server-side key.
// node --env-file=.env.groq.local tests/live-ai-smoke.mjs
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
if(!process.env.GROQ_API_KEY)throw new Error('A server-side GROQ_API_KEY is needed for this optional test.');
const source=readFileSync(new URL('../dist/server/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const date=new Date().toISOString().slice(0,10);
const context={profile:{goals:['Manage stress'],bedtime:'23:30'},entries:[],plan:[{date,items:[{id:'stress-'+date,kind:'suggestion',time:'18:00',end:'18:05',title:'Short relaxation break',evidence:'stress'}]}],demo:true};
for(const kind of ['analysis','coach']){
  const body=kind==='coach'?{...context,message:'Why does this short break fit my goal?',history:[]}:context;
  const response=await worker.fetch(new Request('https://pace.test/api/ai/'+kind,{method:'POST',headers:{origin:'https://pace.test','content-type':'application/json'},body:JSON.stringify(body)}),{GROQ_API_KEY:process.env.GROQ_API_KEY,GROQ_MODEL:process.env.GROQ_MODEL});
  const data=await response.json();assert.equal(response.status,200,`${kind}: ${data.error||'request failed'}`);assert.equal(data.mode,'model');assert.ok(kind==='coach'?data.reply:data.summary);console.log(`${kind}: live model response verified`);
}
