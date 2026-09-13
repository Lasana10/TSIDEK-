import { envHealth } from "./types";

export const oneDriveHealth = () =>
  envHealth(
    "onedrive",
    "storage",
    ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    "cloud",
  );

async function appAccessToken() {
  const health = oneDriveHealth();
  if (!health.configured) throw new Error(`OneDrive not configured: ${health.missing.join(", ")}`);
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID || "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(process.env.MICROSOFT_TENANT_ID || "")}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Microsoft token request failed (${response.status})`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Microsoft token response did not contain access_token");
  return data.access_token;
}

export async function graphGet(path: string) {
  const token = await appAccessToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0${path.startsWith("/") ? path : `/${path}`}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Microsoft Graph request failed (${response.status})`);
  return response.json();
}
