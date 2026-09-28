import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.authenticated || !scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const [partyResult, matterResult, prospectResult] = await Promise.all([
      supabase.from("parties").select("id,party_type,display_name,organisation_name,phone,email,client_status,preferred_language,communication_preferences,created_at,updated_at").eq("firm_id", scope.firmId).order("updated_at", { ascending: false }).limit(500),
      supabase.from("matters").select("id,title,client_name,status,matter_type,risk_level,updated_at").eq("firm_id", scope.firmId).order("updated_at", { ascending: false }).limit(500),
      supabase.from("prospects").select("id,prospect_name,status,risk_level,conflict_status,engagement_status,created_at").eq("firm_id", scope.firmId).order("created_at", { ascending: false }).limit(200),
    ]);
    for (const result of [partyResult,matterResult,prospectResult]) if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success:true, clients:partyResult.data??[], cases:matterResult.data??[], prospects:prospectResult.data??[] });
  } catch (error) {
    return NextResponse.json({ success:false, error:error instanceof Error?error.message:"Unable to load clients." }, { status:403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.authenticated || !scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const body = await request.json();
    const displayName = String(body.displayName ?? "").trim();
    if (!displayName) return NextResponse.json({ success:false,error:"Client name is required." },{status:400});
    const created = await supabase.from("parties").insert({
      firm_id:scope.firmId,
      party_type:String(body.partyType??"individual"),
      display_name:displayName,
      organisation_name:body.partyType==="organisation"?displayName:null,
      phone:String(body.phone??"").trim()||null,
      email:String(body.email??"").trim()||null,
      client_status:String(body.clientStatus??"client"),
      preferred_language:String(body.preferredLanguage??"en"),
      communication_preferences:{ preferred_channel:String(body.preferredChannel??"whatsapp") },
      metadata:{ source:"client_hub" },
      created_by:scope.actorLawyerId,
      updated_by:scope.actorLawyerId
    }).select("*").single();
    if (created.error) throw new Error(created.error.message);
    return NextResponse.json({success:true,client:created.data},{status:201});
  } catch (error) {
    return NextResponse.json({success:false,error:error instanceof Error?error.message:"Unable to create client."},{status:400});
  }
}
