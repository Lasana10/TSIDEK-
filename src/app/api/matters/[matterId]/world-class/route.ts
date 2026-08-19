import { NextResponse } from "next/server";
import { assertMatterScopeAccess } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { statusForApiError } from "@/lib/api-errors";
import { addAuthority, dispatchApproved, postLedger, registerAiProduct, saveClosure } from "@/lib/world-class-operations.server";

export async function POST(request: Request, { params }: { params: Promise<{ matterId: string }> }) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    const b = await request.json();
    const action = String(b.action ?? "");

    if (action === "postLedger") {
      await assertMatterPermission({ scope, matterId, permission: "viewBilling" });
      return NextResponse.json({ success: true, entry: await postLedger({
        matterId, scope,
        entryType: String(b.entryType), sourceTable: b.sourceTable, sourceId: b.sourceId,
        amountXaf: Number(b.amountXaf), direction: b.direction === "DEBIT" ? "DEBIT" : "CREDIT",
        accountBucket: b.accountBucket, description: b.description, providerReference: b.providerReference,
      })});
    }

    if (action === "addAuthority") {
      await assertMatterPermission({ scope, matterId, permission: "manageEvidence" });
      return NextResponse.json({ success: true, ...(await addAuthority({
        matterId, scope, jurisdiction: String(b.jurisdiction ?? ""),
        authorityType: String(b.authorityType ?? "Case"), title: String(b.title ?? ""),
        citation: b.citation, issuingBody: b.issuingBody, sourceUrl: b.sourceUrl,
        sourceStoragePath: b.sourceStoragePath, officialSource: Boolean(b.officialSource),
        language: b.language, sourceText: b.sourceText, proposition: b.proposition,
        pinpointReference: b.pinpointReference,
      }))});
    }

    if (action === "registerAiProduct") {
      await assertMatterPermission({ scope, matterId, permission: "manageEvidence" });
      return NextResponse.json({ success: true, workProduct: await registerAiProduct({
        matterId, scope, workProductType: String(b.workProductType ?? "Legal draft"),
        title: String(b.title ?? "AI-assisted work product"),
        modelProvider: b.modelProvider, modelName: b.modelName, promptText: b.promptText,
        sourceAuthorityIds: Array.isArray(b.sourceAuthorityIds) ? b.sourceAuthorityIds : [],
        sourceDocumentIds: Array.isArray(b.sourceDocumentIds) ? b.sourceDocumentIds : [],
        draftStoragePath: b.draftStoragePath, outputText: b.outputText,
      })}, { status: 201 });
    }

    if (action === "dispatchCommunication") {
      await assertMatterPermission({ scope, matterId, permission: "approveFilings" });
      return NextResponse.json({ success: true, delivery: await dispatchApproved({
        matterId, scope, communicationId: String(b.communicationId),
        channel: b.channel, title: String(b.title ?? ""), message: String(b.message ?? ""),
      })});
    }

    if (action === "saveClosure") {
      await assertMatterPermission({ scope, matterId, permission: b.approve ? "approveFilings" : "assignWork" });
      return NextResponse.json({ success: true, closure: await saveClosure({ matterId, scope, ...b })});
    }

    return NextResponse.json({ success: false, error: "Unsupported world-class operation." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to process operation." },
      { status: statusForApiError(error) }
    );
  }
}
