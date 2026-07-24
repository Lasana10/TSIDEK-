import { createServerSupabaseClient } from "@/lib/supabase-server";

export type MatterSecurityClassification = "Standard" | "Confidential" | "Partner-only";
export type MatterAccessStatus = "allowed" | "screened";

export type MatterAccessOverride = {
  lawyerId: string;
  lawyerName: string;
  lawyerRole: string;
  accessStatus: MatterAccessStatus;
  reason: string | null;
};

export type MatterSecurityProfile = {
  matterId: string;
  securityClassification: MatterSecurityClassification;
  ethicalWallEnabled: boolean;
  accessOverrides: MatterAccessOverride[];
};

export async function getMatterSecurityProfile(matterId: string): Promise<MatterSecurityProfile> {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    return {
      matterId,
      securityClassification: "Standard",
      ethicalWallEnabled: false,
      accessOverrides: [],
    };
  }

  const [matterResult, overridesResult] = await Promise.all([
    supabase
      .from("matters")
      .select("id,security_classification,ethical_wall_enabled")
      .eq("id", matterId)
      .single(),
    supabase
      .from("matter_access_overrides")
      .select("lawyer_id,access_status,reason,lawyers(id,full_name,role)")
      .eq("matter_id", matterId)
      .order("created_at", { ascending: false }),
  ]);

  if (matterResult.error || !matterResult.data) {
    throw new Error(matterResult.error?.message ?? "Matter security profile not found.");
  }

  if (overridesResult.error) {
    throw new Error(overridesResult.error.message);
  }

  return {
    matterId,
    securityClassification: (matterResult.data.security_classification ?? "Standard") as MatterSecurityClassification,
    ethicalWallEnabled: Boolean(matterResult.data.ethical_wall_enabled),
    accessOverrides: ((overridesResult.data ?? []) as unknown as Array<{
      lawyer_id: string;
      access_status: MatterAccessStatus;
      reason: string | null;
      lawyers?: Array<{ id: string; full_name: string | null; role: string | null }> | null;
    }>).map((item) => ({
      lawyerId: item.lawyer_id,
      lawyerName: item.lawyers?.[0]?.full_name ?? "Unknown lawyer",
      lawyerRole: item.lawyers?.[0]?.role ?? "Unspecified",
      accessStatus: item.access_status,
      reason: item.reason,
    })),
  };
}

export async function updateMatterSecurityProfile(input: {
  matterId: string;
  securityClassification: MatterSecurityClassification;
  ethicalWallEnabled: boolean;
}) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is required to manage matter security.");
  }

  const result = await supabase
    .from("matters")
    .update({
      security_classification: input.securityClassification,
      ethical_wall_enabled: input.ethicalWallEnabled,
    })
    .eq("id", input.matterId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return getMatterSecurityProfile(input.matterId);
}

export async function upsertMatterAccessOverride(input: {
  matterId: string;
  lawyerId: string;
  accessStatus: MatterAccessStatus;
  reason?: string | null;
}) {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is required to manage matter access overrides.");
  }

  const result = await supabase.from("matter_access_overrides").upsert(
    {
      matter_id: input.matterId,
      lawyer_id: input.lawyerId,
      access_status: input.accessStatus,
      reason: input.reason ?? null,
    },
    { onConflict: "matter_id,lawyer_id" }
  );

  if (result.error) {
    throw new Error(result.error.message);
  }

  return getMatterSecurityProfile(input.matterId);
}
