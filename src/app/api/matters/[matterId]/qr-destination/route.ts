import { NextResponse } from "next/server";
import { assertMatterScopeAccess } from "@/lib/request-scope";
import { assertMatterPermission } from "@/lib/authorization";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { statusForApiError } from "@/lib/api-errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ matterId: string }> }
) {
  try {
    const { matterId } = await params;
    const scope = await assertMatterScopeAccess(request, matterId);
    await assertMatterPermission({ scope, matterId, allowAnyMember: true });

    const supabase = createServerSupabaseClient();
    if (!supabase) throw new Error("Supabase persistence is required.");

    const result = await supabase
      .from("physical_files")
      .select("file_code,barcode_value,qr_payload,qr_destination,verification_status,location,custody_status")
      .eq("matter_id", matterId)
      .maybeSingle();

    if (result.error) throw new Error(result.error.message);
    if (!result.data) {
      return NextResponse.json({
        success: true,
        identity: {
          qrDestination: `/matters/${matterId}`,
          qrPayload: `/matters/${matterId}`,
          barcodeValue: null,
          fileCode: null,
          verificationStatus: "UNVERIFIED",
          location: null,
          custodyStatus: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      identity: {
        qrDestination: result.data.qr_destination ?? `/matters/${matterId}`,
        qrPayload: result.data.qr_payload ?? result.data.qr_destination ?? `/matters/${matterId}`,
        barcodeValue: result.data.barcode_value,
        fileCode: result.data.file_code,
        verificationStatus: result.data.verification_status,
        location: result.data.location,
        custodyStatus: result.data.custody_status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load case identity." },
      { status: statusForApiError(error) }
    );
  }
}
