export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function isDemoModeEnabled() {
  if (isProductionRuntime()) {
    return false;
  }

  return process.env.TSIDEK_DEMO_MODE !== "false";
}

export function isTrustedHeaderScopeEnabled() {
  return !isProductionRuntime() && process.env.TSIDEK_TRUST_HEADER_SCOPE === "true";
}
