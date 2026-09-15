import { createSign } from "node:crypto";
import { envHealth } from "./types";

export type FirebaseCredentials = { projectId?: string; clientEmail?: string; privateKey?: string };

export const firebaseHealth = () =>
  envHealth("firebase", "push", ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"], "cloud");

function normalizePrivateKey(raw: string) {
  let value = raw.trim();

  // Render and other secret stores may preserve surrounding quotes or JSON-string escaping.
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  // Accept a pasted service-account JSON object as well as the raw PEM value.
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as { private_key?: unknown };
      if (typeof parsed.private_key === "string") value = parsed.private_key;
    } catch {
      // Keep the original value so validation below produces a useful error.
    }
  }

  value = value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!value.includes("-----BEGIN PRIVATE KEY-----") || !value.includes("-----END PRIVATE KEY-----")) {
    throw new Error("Firebase private key is not a valid PKCS#8 PEM. Paste the service account private_key exactly, including BEGIN/END lines.");
  }

  return value.endsWith("\n") ? value : `${value}\n`;
}

function resolved(credentials?: FirebaseCredentials) {
  const rawPrivateKey = credentials?.privateKey || process.env.FIREBASE_PRIVATE_KEY || "";
  return {
    projectId: (credentials?.projectId || process.env.FIREBASE_PROJECT_ID || "").trim(),
    clientEmail: (credentials?.clientEmail || process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
    privateKey: rawPrivateKey ? normalizePrivateKey(rawPrivateKey) : "",
  };
}

function base64url(value: string | Buffer) { return Buffer.from(value).toString("base64url"); }

async function googleAccessToken(credentials?: FirebaseCredentials) {
  const value = resolved(credentials);
  const missing = [!value.projectId && "projectId", !value.clientEmail && "clientEmail", !value.privateKey && "privateKey"].filter(Boolean);
  if (missing.length) throw new Error(`Firebase not configured: ${missing.join(", ")}`);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({ iss: value.clientEmail, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
  const assertion = `${unsigned}.${signer.sign(value.privateKey).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), cache: "no-store",
  });
  if (!response.ok) throw new Error(`Firebase OAuth failed (${response.status})`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Firebase OAuth response did not contain access_token");
  return { accessToken: data.access_token, projectId: value.projectId };
}

export async function verifyFirebaseCredentials(credentials?: FirebaseCredentials) {
  const result = await googleAccessToken(credentials);
  return { ok: true, projectId: result.projectId };
}

export async function sendPush(input: { token: string; title: string; body: string; data?: Record<string, string> }, credentials?: FirebaseCredentials) {
  const auth = await googleAccessToken(credentials);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${auth.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token: input.token, notification: { title: input.title, body: input.body }, data: input.data } }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`FCM send failed (${response.status}): ${JSON.stringify(data)}`);
  return data;
}
