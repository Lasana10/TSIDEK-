/** A missing cookie session is a normal signed-out state, not a server failure.
 * Never collapse expired, invalid, or rejected tokens into anonymous access. */
export function isMissingAuthSession(error: { name?: string; code?: string } | null | undefined): boolean {
  return Boolean(error && (error.name === "AuthSessionMissingError" || error.code === "session_not_found"));
}
