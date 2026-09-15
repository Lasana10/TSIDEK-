import { createSign } from "node:crypto";
import { envHealth } from "./types";

export const firebaseHealth = () =>
  envHealth(
    "firebase",
    "push",
    ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"],
    "cloud",
  );

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function googleAccessToken() {
  const health = firebaseHealth();
  if (!health.configured) throw new Error(`Firebase not configured: ${health.missing.join(", ")}`);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: process.env.FIREBASE_CLIENT_EMAIL,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const signature = signer.sign(privateKey).toString("base64url");
  const assertion = `${unsigned}.${signature}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Firebase OAuth failed (${response.status})`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Firebase OAuth response did not contain access_token");
  return data.access_token;
}

export async function verifyFirebaseCredentials() {
  await googleAccessToken();
  return { ok: true, projectId: process.env.FIREBASE_PROJECT_ID || null };
}

export async function sendPush(input: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const accessToken = await googleAccessToken();
  const projectId = process.env.FIREBASE_PROJECT_ID || "";
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: input.token,
        notification: { title: input.title, body: input.body },
        data: input.data,
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`FCM send failed (${response.status}): ${JSON.stringify(data)}`);
  return data;
}
