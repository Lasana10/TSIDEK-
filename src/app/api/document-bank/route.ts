import { NextResponse } from "next/server";
import { assertFirmPermission } from "@/lib/authorization";
import { runGovernedAi } from "@/lib/ai-runtime.server";
import { resolveRequestScope } from "@/lib/request-scope";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    if (!scope.firmId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const [templates, matters, generations] = await Promise.all([
      supabase.from("document_templates").select("id,title,practice_area,jurisdiction,language,template_body,preserved_form_note,updated_at").eq("firm_id", scope.firmId).order("practice_area").order("title"),
      supabase.from("matters").select("id,title,client_name,status,jurisdiction,matter_type,confidentiality_level").eq("firm_id", scope.firmId).order("updated_at", { ascending: false }).limit(200),
      supabase.from("template_generations").select("id,matter_id,template_id,title,context_note,output_text,generated_at").eq("firm_id", scope.firmId).order("generated_at", { ascending: false }).limit(30),
    ]);
    for (const result of [templates, matters, generations]) if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true, templates: templates.data ?? [], matters: matters.data ?? [], generations: generations.data ?? [] });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to load document bank." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const scope = await resolveRequestScope(request);
    await assertFirmPermission({ scope, permission: "openMatters" });
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");
    const body = await request.json();
    const templateId = String(body.templateId ?? "").trim();
    if (!templateId) return NextResponse.json({ success: false, error: "Select a document template." }, { status: 400 });
    const template = await supabase.from("document_templates").select("*").eq("id", templateId).eq("firm_id", scope.firmId).single();
    if (template.error) throw new Error(template.error.message);
    const matterId = body.matterId ? String(body.matterId) : null;
    let matter: Record<string, unknown> | null = null;
    if (matterId) {
      const result = await supabase.from("matters").select("id,title,client_name,matter_type,jurisdiction,status,risk_level,synopsis,confidentiality_level").eq("id", matterId).eq("firm_id", scope.firmId).maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error("Selected matter is not accessible in this firm.");
      matter = result.data;
    }
    const contextNote = String(body.contextNote ?? "").trim();
    if (!contextNote && !matter) return NextResponse.json({ success: false, error: "Provide matter context or select a matter before adaptation." }, { status: 400 });
    const prompt = [
      "You are assisting a lawyer inside TSIDKENU. Adapt the approved precedent below to the supplied matter context.",
      "Rules: preserve the document structure unless context requires a justified change; never invent facts, authorities, citations, dates, amounts, names, court references or procedural steps; mark missing information clearly in [BRACKETS]; retain bilingual headings where present; do not convert allegations into established facts; do not state that AI output is final legal advice.",
      template.data.preserved_form_note ? `Preservation note: ${template.data.preserved_form_note}` : "",
      matter ? `Matter context: ${JSON.stringify(matter)}` : "",
      contextNote ? `Additional lawyer instructions: ${contextNote}` : "",
      `APPROVED PRECEDENT:\n${template.data.template_body}`,
      "Return only the adapted working draft, ready for lawyer review.",
    ].filter(Boolean).join("\n\n");
    const ai = await runGovernedAi({ scope, matterId, taskType: "document_template_adaptation", prompt, userMode: body.userMode || null });
    const title = `${template.data.title}${matter && matter.title ? ` – ${String(matter.title)}` : " – Adapted draft"}`;
    const saved = await supabase.from("template_generations").insert({ firm_id: scope.firmId, matter_id: matterId, template_id: templateId, title, context_note: contextNote || null, output_text: ai.output }).select("*").single();
    if (saved.error) throw new Error(saved.error.message);
    return NextResponse.json({ success: true, generation: saved.data, ai: { provider: ai.provider, model: ai.model, generatedAt: ai.generatedAt } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to adapt document." }, { status: 400 });
  }
}
