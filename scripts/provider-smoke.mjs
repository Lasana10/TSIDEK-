const results = [];

function push(provider, state, detail = {}) {
  results.push({ provider, state, ...detail });
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]").slice(0, 320);
}

async function withTimeout(promise, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function nextcloud(signal) {
  const baseUrl = (process.env.NEXTCLOUD_BASE_URL || "").replace(/\/$/, "");
  const username = process.env.NEXTCLOUD_USERNAME || "";
  const password = process.env.NEXTCLOUD_APP_PASSWORD || "";
  if (!baseUrl || !username || !password) return push("nextcloud", "IMPLEMENTED_UNVERIFIED", { reason: "missing_runtime_credentials" });
  const auth = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  const root = `${baseUrl}/remote.php/dav/files/${encodeURIComponent(username)}/`;
  const list = await fetch(root, { method: "PROPFIND", headers: { Authorization: auth, Depth: "1", "Content-Type": "application/xml" }, body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:displayname/></d:prop></d:propfind>`, signal });
  if (!list.ok) throw new Error(`PROPFIND ${list.status}`);
  const marker = `.tsidkenu-smoke-${Date.now()}.txt`;
  const upload = await fetch(`${root}${marker}`, { method: "PUT", headers: { Authorization: auth, "Content-Type": "text/plain" }, body: "TSIDKENU provider smoke", signal });
  if (!upload.ok) throw new Error(`PUT ${upload.status}`);
  const cleanup = await fetch(`${root}${marker}`, { method: "DELETE", headers: { Authorization: auth }, signal });
  if (!cleanup.ok && cleanup.status !== 404) throw new Error(`DELETE ${cleanup.status}`);
  push("nextcloud", "VERIFIED", { listStatus: list.status, uploadStatus: upload.status, cleanupStatus: cleanup.status });
}

async function firebase(signal) {
  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return push("firebase", "IMPLEMENTED_UNVERIFIED", { reason: "missing_runtime_credentials" });
  const { createSign } = await import("node:crypto");
  const now = Math.floor(Date.now() / 1000);
  const b64 = (value) => Buffer.from(value).toString("base64url");
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64(JSON.stringify({ iss: clientEmail, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned); signer.end();
  const assertion = `${unsigned}.${signer.sign(privateKey).toString("base64url")}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal });
  const tokenJson = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenJson.access_token) throw new Error(`OAuth ${tokenResponse.status}`);
  const deviceToken = process.env.FIREBASE_SMOKE_DEVICE_TOKEN || "";
  if (!deviceToken) return push("firebase", "IMPLEMENTED_UNVERIFIED", { oauth: "VERIFIED", push: "missing_FIREBASE_SMOKE_DEVICE_TOKEN" });
  const pushResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, { method: "POST", headers: { Authorization: `Bearer ${tokenJson.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { token: deviceToken, data: { tsidkenu_smoke: "true", timestamp: new Date().toISOString() } } }), signal });
  if (!pushResponse.ok) throw new Error(`FCM ${pushResponse.status}`);
  push("firebase", "VERIFIED", { oauthStatus: tokenResponse.status, pushStatus: pushResponse.status });
}

async function whatsapp(signal) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const version = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  if (!token || !phoneId) return push("meta_whatsapp", "IMPLEMENTED_UNVERIFIED", { reason: "missing_runtime_credentials" });
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}?fields=id,display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` }, signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Graph ${response.status}`);
  push("meta_whatsapp", "VERIFIED", { status: response.status, phoneNumberResolved: Boolean(data.display_phone_number), verifiedNameResolved: Boolean(data.verified_name) });
}

async function openrouter(signal) {
  const key = process.env.OPENROUTER_API_KEY || "";
  if (!key) return push("openrouter", "IMPLEMENTED_UNVERIFIED", { reason: "missing_runtime_credentials" });
  const model = process.env.OPENROUTER_SMOKE_MODEL || "openrouter/auto";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://tsidek-os.onrender.com", "X-Title": "TSIDKENU provider verification" }, body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply only with OK." }], max_tokens: 3, temperature: 0 }), signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`chat/completions ${response.status}`);
  push("openrouter", "VERIFIED", { status: response.status, model: typeof data.model === "string" ? data.model : model, completionResolved: Boolean(data.choices?.[0]?.message?.content) });
}

async function pawapay(signal) {
  const token = process.env.PAWAPAY_API_TOKEN || process.env.PAWAPAY_API_KEY || "";
  const environment = (process.env.PAWAPAY_ENV || "sandbox").toLowerCase();
  const baseUrl = (process.env.PAWAPAY_API_URL || (environment === "production" ? "https://api.pawapay.io" : "https://api.sandbox.pawapay.io")).replace(/\/$/, "");
  if (!token) return push("pawapay", "IMPLEMENTED_UNVERIFIED", { reason: "missing_runtime_credentials", environment });
  const response = await fetch(`${baseUrl}/v2/availability`, { headers: { Authorization: `Bearer ${token}` }, signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`availability ${response.status}`);
  const cameroon = Array.isArray(data) ? data.some((entry) => entry?.country === "CMR") : false;
  push("pawapay", "VERIFIED", { status: response.status, environment, cameroonAvailable: cameroon });
}

const checks = [
  ["nextcloud", nextcloud],
  ["firebase", firebase],
  ["meta_whatsapp", whatsapp],
  ["openrouter", openrouter],
  ["pawapay", pawapay],
];

for (const [provider, check] of checks) {
  try {
    await withTimeout((signal) => check(signal));
  } catch (error) {
    push(provider, "IMPLEMENTED_UNVERIFIED", { error: safeError(error) });
  }
}

const summary = {
  event: "TSIDKENU_PROVIDER_SMOKE",
  timestamp: new Date().toISOString(),
  verified: results.filter((item) => item.state === "VERIFIED").map((item) => item.provider),
  unverified: results.filter((item) => item.state !== "VERIFIED").map((item) => item.provider),
  results,
};
console.log(JSON.stringify(summary));
