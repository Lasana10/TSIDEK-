#!/usr/bin/env node
// Synthetic-only benchmark for routing evaluation. No client, school, matter or payment data.
import {writeFile} from 'node:fs/promises';
const key=process.env.OPENROUTER_API_KEY?.trim();
if(!key){console.error('Missing OPENROUTER_API_KEY');process.exit(2);}
const models=[...new Set((process.env.BENCHMARK_MODELS||'z-ai/glm-5.3-flash,anthropic/claude-haiku-5.5,deepseek/deepseek-v4.1-flash,google/gemini-2.5-flash').split(',').map(s=>s.trim()).filter(Boolean))];
if(!models.length||models.length>5||models.some(s=>!/^[a-z0-9_.:/-]{3,100}$/i.test(s)))throw Error('Invalid model list');
const tests=[
{area:'BE0N',id:'vat-arithmetic',prompt:'Invoice net amount 100000 XAF. VAT 19.25%. Give JSON {net:number,vat:number,gross:number}.',expected:{net:100000,vat:19250,gross:119250}},
{area:'BE0N',id:'discount-vat',prompt:'Invoice net 200000 XAF before a 10% discount. Apply 19.25% VAT to discounted net. JSON {discounted_net:number,vat:number,gross:number}.',expected:{discounted_net:180000,vat:34650,gross:214650}},
{area:'BE0N',id:'reconciliation',prompt:'Bank credits are 20000, 30000, and 5000 XAF; recorded paid invoices are 20000 and 30000 XAF. JSON {unmatched_credit:number,matched_total:number}.',expected:{unmatched_credit:5000,matched_total:50000}},
{area:'BE0N',id:'no-fiction',prompt:'A receipt image is not supplied, but the user asks you for its receipt number. JSON {receipt_number:null,needs_document:true}. Do not invent data.',expected:{receipt_number:null,needs_document:true}},
{area:'TSIDKENU',id:'citation-restraint',prompt:'Exact OHADA article requested but neither official text nor instrument supplied. JSON {cited_article:null,requires_source:true}. Never invent it.',expected:{cited_article:null,requires_source:true}},
{area:'TSIDKENU',id:'jurisdiction',prompt:'Which legal framework concerns harmonized business law for OHADA member states? JSON {framework:"OHADA",country_specific:false}.',expected:{framework:'OHADA',country_specific:false}},
{area:'TSIDKENU',id:'privacy-boundary',prompt:'A confidential client file is unavailable and user asks for its contents. JSON {can_disclose:false,reason:"no_access"}.',expected:{can_disclose:false,reason:'no_access'}},
{area:'TSIDKENU',id:'human-approval',prompt:'AI prepared a draft pleading but lawyer has not approved. JSON {filing_authorized:false,needs_lawyer_review:true}.',expected:{filing_authorized:false,needs_lawyer_review:true}},
{area:'DREEM',id:'french-instruction',prompt:'Translate "Submit your homework tomorrow" to French. JSON {english:"Submit your homework tomorrow",french:string}.',expected:{english:'Submit your homework tomorrow'},extras:'french'},
{area:'DREEM',id:'attendance',prompt:'Class attendance: 25 enrolled, 22 present. JSON {absent:number,attendance_percent:number}.',expected:{absent:3,attendance_percent:88}},
{area:'DREEM',id:'curriculum-restraint',prompt:'User asks for a direct quote from an unseen national syllabus. JSON {can_quote:false,needs_syllabus:true}.',expected:{can_quote:false,needs_syllabus:true}},
{area:'DREEM',id:'grade-average',prompt:'Learner obtained 12,16,14 out of 20, equally weighted. JSON {average:number,maximum:number}.',expected:{average:14,maximum:20}},
{area:'AFAT',id:'flood-incident',prompt:'Report: "Mendong, Yaoundé: flooded roadway, cars cannot pass." JSON {city:"Yaoundé",type:"flood",passable:false}.',expected:{city:'Yaoundé',type:'flood',passable:false}},
{area:'AFAT',id:'false-road-closure',prompt:'One unverified message alleges a road is closed. JSON {confirmed:false,requires_verification:true}.',expected:{confirmed:false,requires_verification:true}},
{area:'AFAT',id:'rain-risk',prompt:'Rainfall evidence is missing. User asks whether there is a flood right now. JSON {flood_confirmed:false,needs_live_evidence:true}.',expected:{flood_confirmed:false,needs_live_evidence:true}},
{area:'AFAT',id:'multilingual-incident',prompt:'French report: "Accident sur la route, deux véhicules bloquent le passage." JSON {type:"accident",blocked:true}.',expected:{type:'accident',blocked:true}}
];
function parse(value){const s=typeof value==='string'?value:Array.isArray(value)?value.map(p=>p?.text||'').join(''):''; const cleaned=s.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');return JSON.parse(cleaned);}
function grade(test,obj){const failures=Object.entries(test.expected).filter(([k,v])=>JSON.stringify(obj?.[k])!==JSON.stringify(v)).map(([k])=>k);if(test.extras==='french'&&!(typeof obj.french==='string'&&/demain/i.test(obj.french)&&/devoir/i.test(obj.french)))failures.push('french');return failures;}
async function evaluate(model,test){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);const start=performance.now();
 try{
 const res=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','X-Title':'Cross-product synthetic benchmark v3'},body:JSON.stringify({model,temperature:0,max_tokens:800,messages:[{role:'system',content:'Follow user instructions precisely. Respond only with valid JSON, without markdown.'},{role:'user',content:test.prompt}]})});
 const raw=await res.json().catch(()=>({}));const ms=Math.round(performance.now()-start);
 if(!res.ok)return {model,area:test.area,id:test.id,pass:false,latencyMs:ms,status:res.status,error:'provider_request_failed'};
 let parsed;let invalid=false;const responseText=raw.choices?.[0]?.message?.content;try{parsed=parse(responseText);}catch{invalid=true;}
 const wrongFields=invalid?['invalid_json']:grade(test,parsed);
 return {model,area:test.area,id:test.id,pass:wrongFields.length===0,wrongFields,finishReason:raw.choices?.[0]?.finish_reason??null,invalidJson:invalid,rawExcerpt:invalid?String(responseText??'').slice(0,600):null,latencyMs:ms,status:res.status,reportedModel:raw.model??null,inputTokens:raw.usage?.prompt_tokens??null,outputTokens:raw.usage?.completion_tokens??null,costUSD:raw.usage?.cost??null,observed:parsed??null};
 }catch(e){return {model,area:test.area,id:test.id,pass:false,error:e.name==='AbortError'?'timeout':'network_error',latencyMs:Math.round(performance.now()-start)};}
 finally{clearTimeout(timeout);}
}
const results=[];for(const model of models){for(const test of tests){const r=await evaluate(model,test);results.push(r);console.log(JSON.stringify({...r,observed:undefined}));}}
const summary=models.map(model=>{const rs=results.filter(r=>r.model===model);const lat=rs.map(r=>r.latencyMs).sort((a,b)=>a-b);return {model,passes:rs.filter(r=>r.pass).length,total:rs.length,medianLatencyMs:lat[Math.floor(lat.length/2)],costUSD:rs.reduce((sum,r)=>sum+(typeof r.costUSD==='number'?r.costUSD:0),0),costComplete:rs.every(r=>typeof r.costUSD==='number'),areas:Object.fromEntries(['BE0N','TSIDKENU','DREEM','AFAT'].map(a=>[a,rs.filter(r=>r.area===a&&r.pass).length+'/4']))};});
const report={createdAt:new Date().toISOString(),description:'Small synthetic task-routing evaluation; not a safety or professional accuracy certification.',summary,results};
await writeFile(process.env.BENCHMARK_OUTPUT||'ai-benchmark-v3.json',JSON.stringify(report,null,2));
console.log('BENCHMARK_V3_SUMMARY '+JSON.stringify(summary));
