import { NextResponse } from "next/server";
import { resolveRequestScope } from "@/lib/request-scope";
import { assertFirmPermission, assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { extractDocumentIntelligence } from "@/lib/document-intelligence.server";

type Context = { params: Promise<{ itemId: string }> };

type ClaimType = "fact"|"issue"|"authority"|"recommendation";

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
    const analyzedAt = new Date().toISOString();
    const metadata = {
      ...(item.metadata ?? {}),
      document_intelligence:{
        provider:result.provider,model:result.model,language:extraction.language,parties:extraction.parties,identifiers:extraction.identifiers,
        keyFacts:extraction.keyFacts,obligations:extraction.obligations,datesAndDeadlines:extraction.datesAndDeadlines,monetaryTerms:extraction.monetaryTerms,
        legalReferences:extraction.legalReferences,contradictionsOrGaps:extraction.contradictionsOrGaps,suggestedMatterActions:extraction.suggestedMatterActions,
        summary:extraction.summary,warnings:extraction.warnings,confidence:extraction.confidence,analyzed_at:analyzedAt
      }
    };
    const updated = await supabase.from("digitisation_items").update({
      proposed_title:extraction.title || item.proposed_title,
      proposed_document_type:extraction.documentType || item.proposed_document_type,
      proposed_document_date:extraction.documentDate || item.proposed_document_date,
      classification_confidence:extraction.confidence,
      metadata,
    }).eq("id",itemId).select("*").single();
    if (updated.error) throw new Error(updated.error.message);

    let proposedClaims = 0;
    if (item.matter_id) {
      const sourceReference=`digitisation:${itemId}`;
      const previous=await supabase.from("matter_legal_claims").delete().eq("matter_id",item.matter_id).eq("source_kind","document_ai_proposal").eq("source_reference",sourceReference).eq("verification_status","unverified");
      if(previous.error)throw new Error(previous.error.message);
      const rows:Array<{claim_type:ClaimType;statement:string}>=[
        ...extraction.keyFacts.map(statement=>({claim_type:"fact" as const,statement})),
        ...extraction.obligations.map(statement=>({claim_type:"issue" as const,statement:`Obligation identified for review: ${statement}`})),
        ...extraction.datesAndDeadlines.map(statement=>({claim_type:"issue" as const,statement:`Date/deadline identified for review: ${statement}`})),
        ...extraction.monetaryTerms.map(statement=>({claim_type:"fact" as const,statement:`Monetary term identified for review: ${statement}`})),
        ...extraction.legalReferences.map(statement=>({claim_type:"authority" as const,statement})),
        ...extraction.contradictionsOrGaps.map(statement=>({claim_type:"issue" as const,statement:`Potential contradiction/gap: ${statement}`})),
        ...extraction.suggestedMatterActions.map(statement=>({claim_type:"recommendation" as const,statement})),
      ].filter(row=>row.statement.trim()).slice(0,100);
      if(rows.length){
        const claimInsert=await supabase.from("matter_legal_claims").insert(rows.map(row=>({firm_id:scope.firmId,matter_id:item.matter_id,claim_type:row.claim_type,statement:row.statement,source_kind:"document_ai_proposal",source_reference:sourceReference,confidence:extraction.confidence,verification_status:"unverified",metadata:{digitisationItemId:itemId,provider:result.provider,model:result.model}})));
        if(claimInsert.error)throw new Error(claimInsert.error.message);proposedClaims=rows.length;
      }
      await supabase.from("matter_events").insert({matter_id:item.matter_id,event_type:"DOCUMENT_INTELLIGENCE_PROPOSED",actor_name:scope.actorName,metadata:{digitisationItemId:itemId,provider:result.provider,model:result.model,proposedClaims,verifiedAutomatically:false}});
    }

    return NextResponse.json({success:true,item:updated.data,extraction,provider:result.provider,model:result.model,proposedClaims,requiresHumanVerification:proposedClaims>0});
  } catch (error) {
    return NextResponse.json({success:false,error:error instanceof Error?error.message:"Document analysis failed."},{status:400});
  }
}
