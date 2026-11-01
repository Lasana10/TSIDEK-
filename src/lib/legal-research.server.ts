import { createServerAuthClient, getAuthenticatedUser } from "@/lib/supabase-auth";
import { assertMatterPermission } from "@/lib/authorization";
import type { RequestScope } from "@/lib/request-scope";

export type LegalResearchHit = {
  chunk_id: string;
  source_document_id: string;
  authority_id: string | null;
  title: string;
  jurisdiction: string;
  section_path: string | null;
  content: string;
  source_url: string | null;
  canonical_uri: string | null;
  rank: number;
  publisher: string;
  version_label: string | null;
  valid_from: string | null;
  valid_until: string | null;
  source_checksum: string;
  verified_at: string;
  source_class: string;
  publisher: string;
  version_label: string | null;
  valid_from: string | null;
  valid_until: string | null;
  source_checksum: string;
  verified_at: string;
  source_class: string;
};

export async function searchLegalSources(input: {
  scope: RequestScope;
  query: string;
  matterId?: string | null;
  limit?: number;
  asOfDate?: string | null;
  asOfDate?: string | null;
}) {
  const query = input.query.trim();
  if (query.length < 3) throw new Error("Research query must contain at least 3 characters.");
  if (!input.scope.firmId || !input.scope.actorLawyerId) throw new Error("Authentication and firm context are required.");

  if (input.matterId) {
    await assertMatterPermission({ scope: input.scope, matterId: input.matterId, allowAnyMember: true });
  }

  const authIdentity = await getAuthenticatedUser();
  if (!authIdentity?.user) throw new Error("Authentication required.");
  const supabase = await createServerAuthClient();
  if (!supabase) throw new Error("Supabase Auth client is unavailable.");

  const asOfDate=input.asOfDate || new Date().toISOString().slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfDate) || Number.isNaN(new Date(asOfDate).getTime())) throw new Error("Valid research as-of date required.");
  const { data, error } = await supabase.rpc("tsidek_search_verified_legal_chunks", {
    search_query: query,
    requested_firm_id: input.scope.firmId,
    match_count: Math.max(1, Math.min(input.limit ?? 12, 30)),
    p_as_of_date: input.asOfDate ?? new Date().toISOString().slice(0, 10),
    p_as_of_date: asOfDate,
  });
  if (error) throw new Error(error.message);

  const hits = (data ?? []) as LegalResearchHit[];
  return {
    query,
    matterId: input.matterId ?? null,
    asOfDate,
    hits,
    sourceCount: new Set(hits.map((hit) => hit.source_document_id)).size,
    warning:
      hits.length === 0
        ? "No professionally verified, rights-cleared legal passage matched for this date. Intake records and official links are not, by themselves, verified legal text."
        : null,
  };
}
