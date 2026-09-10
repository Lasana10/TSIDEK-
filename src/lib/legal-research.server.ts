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
};

export async function searchLegalSources(input: {
  scope: RequestScope;
  query: string;
  matterId?: string | null;
  limit?: number;
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

  const { data, error } = await supabase.rpc("search_legal_source_chunks", {
    search_query: query,
    requested_firm_id: input.scope.firmId,
    match_count: Math.max(1, Math.min(input.limit ?? 12, 30)),
  });
  if (error) throw new Error(error.message);

  const hits = (data ?? []) as LegalResearchHit[];
  return {
    query,
    matterId: input.matterId ?? null,
    hits,
    sourceCount: new Set(hits.map((hit) => hit.source_document_id)).size,
    warning:
      hits.length === 0
        ? "No verified source chunk matched this query. TSIDKENU must not invent a legal authority."
        : null,
  };
}
