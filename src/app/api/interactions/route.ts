import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const allowedTypes = new Set(["walk_in","office_meeting","phone_call","whatsapp","email","portal","referral","court_encounter","other"]);
const allowedConfidentiality = new Set(["firm","restricted","highly_confidential"]);

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() || "";
    const matterId = url.searchParams.get("matterId")?.trim() || "";

    if (matterId) await assertMatterPermission({ scope, matterId, allowAnyMember: true });

    let interactionsQuery = supabase
      .from("legal_interactions")
      .select("id,matter_id,prospect_id,primary_party_id,interaction_type,direction,occurred_at,subject,raw_note,confidentiality_level,transcript_status,ai_analysis_status,verification_status,assigned_to,created_at")
      .eq("firm_id", scope.firmId)
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (matterId) interactionsQuery = interactionsQuery.eq("matter_id", matterId);

    let partiesQuery = supabase
      .from("parties")
      .select("id,party_type,display_name,phone,email,client_status,preferred_language")
      .eq("firm_id", scope.firmId)
      .order("display_name")
      .limit(q ? 25 : 10);
    if (q) partiesQuery = partiesQuery.or(`display_name.ilike.%${q.replace(/[%_,]/g, "")}%,phone.ilike.%${q.replace(/[%_,]/g, "")}%,email.ilike.%${q.replace(/[%_,]/g, "")}%`);

    const [interactions, parties, policies] = await Promise.all([
      interactionsQuery,
      partiesQuery,
      supabase.from("firm_interaction_policies").select("*").eq("firm_id", scope.firmId).maybeSingle(),
    ]);
    if (interactions.error) throw new Error(interactions.error.message);
    if (parties.error) throw new Error(parties.error.message);
    if (policies.error) throw new Error(policies.error.message);

    return NextResponse.json({ success: true, interactions: interactions.data ?? [], parties: parties.data ?? [], policy: policies.data ?? null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load interactions." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const body = await request.json();
    const action = String(body.action ?? "create_interaction");

    if (action === "create_party") {
      const displayName = String(body.displayName ?? "").trim();
      if (!displayName) return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
      const created = await supabase.from("parties").insert({
        firm_id: scope.firmId,
        party_type: body.partyType === "organisation" ? "organisation" : "individual",
        display_name: displayName,
        phone: body.phone ? String(body.phone).trim() : null,
        email: body.email ? String(body.email).trim().toLowerCase() : null,
        client_status: "contact",
        preferred_language: ["en","fr","bilingual","other"].includes(String(body.preferredLanguage)) ? String(body.preferredLanguage) : "en",
        created_by: scope.actorLawyerId,
        updated_by: scope.actorLawyerId,
      }).select("*").single();
      if (created.error) throw new Error(created.error.message);
      return NextResponse.json({ success: true, party: created.data }, { status: 201 });
    }

    const interactionType = String(body.interactionType ?? "walk_in");
    if (!allowedTypes.has(interactionType)) return NextResponse.json({ success: false, error: "Invalid interaction type." }, { status: 400 });
    const matterId = body.matterId ? String(body.matterId) : null;
    if (matterId) await assertMatterPermission({ scope, matterId, allowAnyMember: true });
    const confidentiality = allowedConfidentiality.has(String(body.confidentialityLevel)) ? String(body.confidentialityLevel) : "firm";

    const created = await supabase.from("legal_interactions").insert({
      firm_id: scope.firmId,
      matter_id: matterId,
      prospect_id: body.prospectId ? String(body.prospectId) : null,
      primary_party_id: body.partyId ? String(body.partyId) : null,
      interaction_type: interactionType,
      direction: ["inbound","outbound","internal"].includes(String(body.direction)) ? String(body.direction) : "inbound",
      occurred_at: body.occurredAt ? String(body.occurredAt) : new Date().toISOString(),
      subject: body.subject ? String(body.subject).trim() : null,
      raw_note: body.note ? String(body.note).trim() : null,
      confidentiality_level: confidentiality,
      consent_recording: typeof body.consentRecording === "boolean" ? body.consentRecording : null,
      transcript_status: body.requestTranscription ? "queued" : "not_requested",
      ai_analysis_status: body.requestAnalysis ? "queued" : "not_requested",
      assigned_to: body.assignedTo ? String(body.assignedTo) : scope.actorLawyerId,
      created_by: scope.actorLawyerId,
    }).select("*").single();
    if (created.error) throw new Error(created.error.message);

    return NextResponse.json({ success: true, interaction: created.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create interaction." }, { status: 403 });
  }
}
