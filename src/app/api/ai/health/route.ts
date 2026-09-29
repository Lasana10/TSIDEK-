import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { runGovernedAi, type AiProviderName } from "@/lib/ai-runtime.server";

export async function GET(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    if(!scope.authenticated||!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase=createServerSupabaseClient(); if(!supabase) throw new Error("Supabase server configuration is required.");
    const [profile,policy,runs]=await Promise.all([
      supabase.from("firm_runtime_profiles").select("ai_privacy_mode,primary_cloud_provider,local_ai_base_url,updated_at").eq("firm_id",scope.firmId).maybeSingle(),
      supabase.from("firm_ai_policies").select("user_facing_mode,standard_route,high_accuracy_route,private_route,local_route,highly_confidential_mode,updated_at").eq("firm_id",scope.firmId).maybeSingle(),
      supabase.from("ai_provider_runs").select("id,provider,model,task_type,status,latency_ms,error_code,created_at,completed_at").eq("firm_id",scope.firmId).order("created_at",{ascending:false}).limit(50)
    ]);
    for(const result of [profile,policy,runs]) if(result.error) throw new Error(result.error.message);
    const recent=runs.data??[];
    const providers=["gemini","openrouter","local"].map(provider=>{
      const items=recent.filter(x=>x.provider===provider);
      const success=items.filter(x=>x.status==="succeeded").length;
      return {provider,configured:provider==="gemini"?Boolean(process.env.GEMINI_API_KEY):provider==="openrouter"?Boolean(process.env.OPENROUTER_API_KEY):Boolean(profile.data?.local_ai_base_url||process.env.TSIDEK_LOCAL_AI_BASE_URL),recentRuns:items.length,recentSucceeded:success,lastRun:items[0]??null};
    });
    return NextResponse.json({success:true,profile:profile.data,policy:policy.data,providers,recentRuns:recent});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to load AI health."},{status:403})}
}

export async function POST(request:Request){
  try{
    const scope=await resolveRequestScope(request);
    if(!scope.authenticated||!scope.firmId||!scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const body=await request.json();
    const provider=String(body.provider??"") as AiProviderName;
    if(!["gemini","openrouter","local"].includes(provider)) return NextResponse.json({success:false,error:"Choose Gemini, OpenRouter or Local AI."},{status:400});
    const started=Date.now();
    const result=await runGovernedAi({scope,taskType:"provider_health_test",prompt:"Return exactly: TSIDKENU_AI_OK",preferredProvider:provider,userMode:provider==="local"?"local":"standard",strictProvider:true});
    const usable=Boolean(result.output&&result.output.trim());
    return NextResponse.json({success:usable,provider:result.provider,model:result.model,latencyMs:Date.now()-started,outputPreview:result.output.slice(0,120),runId:result.runId});
  }catch(error){return NextResponse.json({success:false,error:error instanceof Error?error.message:"AI health test failed."},{status:502})}
}
