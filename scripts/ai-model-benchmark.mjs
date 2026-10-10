#!/usr/bin/env node
// Controlled, synthetic AI model benchmark. Run only by an authorized operator:
// BENCHMARK_MODELS="deepseek/deepseek-v4.1-flash,..." node scripts/ai-model-benchmark.mjs
// Reads the existing server-side OPENROUTER_API_KEY, never prints it.
// No client files, tenant documents, prompts or credentials are uploaded.
import { writeFile } from "node:fs/promises";

const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) { console.error("OPENROUTER_API_KEY is not configured."); process.exit(2); }
const models = [...new Set((process.env.BENCHMARK_MODELS || "deepseek/deepseek-v4.1-flash").split(",").map(s=>s.trim()).filter(Boolean))];
if (!models.length || models.length > 5 || models.some(m => !/^[a-z0-9_.:/-]{3,100}$/i.test(m))) {
  console.error("Set between 1 and 5 valid explicit BENCHMARK_MODELS."); process.exit(2);
}
const fixtures = [
  { product:"BE0N", name:"financial arithmetic", prompt:"Respond ONLY with compact JSON with keys currency, gross, net, vat. Invoice is net 100000 FCFA plus 19.25% VAT. Calculate VAT and gross; numeric values only except currency.", expected:{ currency:"XAF", gross:119250, net:100000, vat:19250 }},
  { product:"TSIDKENU", name:"legal citation restraint", prompt:"Respond ONLY with compact JSON with keys cited_article and safe. A user asks for an exact OHADA article but provides no instrument or official source. Do not invent the citation. Use cited_article=null and safe=true.", expected:{cited_article:null,safe:true}},
  { product:"DREEM", name:"bilingual output", prompt:"Respond ONLY with compact JSON with keys en and fr. Translate this classroom instruction into French: 'Submit your assignment tomorrow.' Set en to the exact original English sentence.", expected:{en:"Submit your assignment tomorrow.",fr:"Remettez votre devoir demain."}, kind:"bilingual"},
  { product:"AFAT", name:"incident classification", prompt:"Respond ONLY with compact JSON with keys city, issue, severity. Report: 'At Mendong in Yaoundé, road is flooded and cars cannot pass.' Classify issue as flood, severity as high.", expected:{city:"Yaoundé",issue:"flood",severity:"high"}}
];
function extractJson(s) { const text=String(s||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""); return JSON.parse(text); }
function check(fixture, parsed) {
  if (fixture.kind === "bilingual") return parsed?.en === fixture.expected.en && typeof parsed?.fr === "string" && /demain/i.test(parsed.fr) && /devoir|travail/i.test(parsed.fr);
  return Object.entries(fixture.expected).every(([k,v])=>parsed?.[k]===v);
}
async function call(model, fixture) {
  const start=performance.now();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try {
    const r=await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:"POST", signal:controller.signal,
      headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json","X-Title":"TSIDKENU synthetic AI benchmark"},
      body:JSON.stringify({model,temperature:0,max_tokens:220,messages:[{role:"user",content:fixture.prompt}]})
    });
    const body=await r.json().catch(()=>({}));
    const latencyMs=Math.round(performance.now()-start);
    if(!r.ok) return {product:fixture.product,task:fixture.name,model,pass:false,status:r.status,latencyMs,error:"Provider request failed"};
    const text=body?.choices?.[0]?.message?.content;
    let parsed=null; try {parsed=extractJson(text);}catch {}
    return {product:fixture.product,task:fixture.name,model,pass:check(fixture,parsed),status:r.status,latencyMs,
      inputTokens:body.usage?.prompt_tokens ?? null, outputTokens:body.usage?.completion_tokens ?? null,
      // OpenRouter may include provider-reported cost; do not treat absent usage as zero.
      cost:body.usage?.cost ?? null, responseModel:body.model ?? null, validJson:parsed!==null};
  } catch(e) { return {product:fixture.product,task:fixture.name,model,pass:false,status:null,latencyMs:Math.round(performance.now()-start),error:e?.name==="AbortError"?"timeout":"network error"}; }
  finally {clearTimeout(timer);}
}
const results=[];
for(const model of models) for(const fixture of fixtures) {
  const result=await call(model,fixture); results.push(result);
  console.log(JSON.stringify(result));
}
const summary=models.map(model=>{const rows=results.filter(r=>r.model===model);return {model,passed:rows.filter(r=>r.pass).length,total:rows.length,medianLatencyMs:rows.map(r=>r.latencyMs).sort((a,b)=>a-b)[Math.floor(rows.length/2)]};});
const report={schema:1,createdAt:new Date().toISOString(),disclaimer:"Small synthetic smoke benchmark, NOT proof of legal or financial reliability.",summary,results};
if(process.env.BENCHMARK_OUTPUT) await writeFile(process.env.BENCHMARK_OUTPUT,JSON.stringify(report,null,2));
console.log("BENCHMARK_SUMMARY "+JSON.stringify(summary));
