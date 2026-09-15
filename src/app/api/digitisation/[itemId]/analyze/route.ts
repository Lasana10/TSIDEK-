import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission, assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { extractDocumentIntelligence } from "@/lib/document-intelligence.server";

type Context = { params: Promise<{ itemId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { itemId } = await context.params;
    const scope = await resolveRequestScope(request);
    if (!scope.firmId || !scope.actorLawyerId) throw new Error("Authenticated firm context is required.");
    await assertFirmPermission({ scope, permission:"manageEvidence" });
    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase server configuration is required.");

    const itemResult = await supabase.from("digitisation_items").select("*").eq("id",itemId).eq("firm_id",scope.firmId).single();
    if (itemResult.error) throw new Error(itemResult.error.message);
    const item = itemResult.data;
    if (item.matter_id) await assertMatterPermission({ scope, matterId:item.matter_id, permission:"manageEvidence" });
    if (item.review_status === "duplicate") return NextResponse.json({success:false,error:"Duplicate items are not reprocessed automatically."},{status:409});

    const result = await extractDocumentIntelligence({storageRef:item.storage_ref,mimeType:item.mime_type,originalName:item.original_name});
    const extraction = result.extraction;
    const metadata = {
      ...(item.metadata ?? {}),
      document_intelligence:{ provider:result.provider,model:result.model,language:extraction.language,parties:extraction.parties,identifiers:extraction.identifiers,summary:extraction.summary,warnings:extraction.warnings,analyzed_at:new Date().toISOString() }
    };
    const updated = await supabase.from("digitisation_items").update({
      proposed_title:extraction.title || item.proposed_title,
      proposed_document_type:extraction.documentType || item.proposed_document_type,
      proposed_document_date:extraction.documentDate || item.proposed_document_date,
      classification_confidence:extraction.confidence,
      metadata,
    }).eq("id",itemId).select("*").single();
    if (updated.error) throw new Error(updated.error.message);
    return NextResponse.json({success:true,item:updated.data,extraction,provider:result.provider,model:result.model});
  } catch (error) {
    return NextResponse.json({success:false,error:error instanceof Error?error.message:"Document analysis failed."},{status:400});
  }
}
