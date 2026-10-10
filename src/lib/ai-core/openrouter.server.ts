import type { AiCoreTransport } from "./execute";
const ALLOWED_HOST = "https://openrouter.ai/api/v1/chat/completions";
export function createOpenRouterTransport(config: {apiKey:string; timeoutMs?:number}):AiCoreTransport {
  if (!config.apiKey.trim()) throw new Error("OPENROUTER_KEY_MISSING");
  const timeoutMs=Math.max(1000,Math.min(config.timeoutMs??25000,60000));
  return async ({provider,model,prompt,maxTokens}) => {
    if (provider !== "openrouter") throw new Error("UNSUPPORTED_AI_PROVIDER");
    const response=await fetch(ALLOWED_HOST,{
      method:"POST",signal:AbortSignal.timeout(timeoutMs),
      headers:{"Authorization":`Bearer ${config.apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model,temperature:0,max_tokens:maxTokens,messages:[
        {role:"system",content:"Return only the requested structured JSON. Do not invent evidence or citations."},
        {role:"user",content:prompt}
      ]})
    });
    if (!response.ok) throw new Error(`AI_UPSTREAM_HTTP_${response.status}`);
    const data:unknown=await response.json();
    if (!data || typeof data!=="object" || !("choices" in data)) throw new Error("AI_UPSTREAM_INVALID_RESPONSE");
    const choices=(data as {choices?:Array<{message?:{content?:unknown};finish_reason?:string}>}).choices;
    const first=choices?.[0];
    if(first?.finish_reason==="length") throw new Error("AI_OUTPUT_TRUNCATED");
    if(typeof first?.message?.content!=="string" || !first.message.content.trim()) throw new Error("AI_UPSTREAM_EMPTY_OUTPUT");
    return first.message.content;
  };
}
