export function statusForApiError(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  const message = error.message.toLowerCase();

  if (message.includes("authentication required") || message.includes("supabase auth is not configured")) {
    return 401;
  }

  if (
    message.includes("complete onboarding") ||
    message.includes("permission denied") ||
    message.includes("access denied") ||
    message.includes("not assigned")
  ) {
    return 403;
  }

  if (message.includes("not found")) {
    return 404;
  }

  return 500;
}
