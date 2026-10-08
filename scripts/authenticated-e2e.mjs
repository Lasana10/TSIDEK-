const baseUrl = (process.env.TSIDEK_E2E_BASE_URL || "").replace(/\/$/, "");
const accessToken = process.env.TSIDEK_E2E_ACCESS_TOKEN || "";

if (!baseUrl || !accessToken) {
  console.error("Authenticated E2E requires TSIDEK_E2E_BASE_URL and TSIDEK_E2E_ACCESS_TOKEN.");
  process.exit(2);
}

async function request(path, authenticated = true) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: authenticated ? { Authorization: `Bearer ${accessToken}` } : {},
    redirect: "manual",
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

function assert(condition, message, context) {
  if (condition) return;
  console.error(JSON.stringify({ event: "TSIDKENU_AUTH_E2E_FAILURE", message, context }));
  process.exit(1);
}

const anonymous = await request("/api/workroom", false);
assert([401, 403].includes(anonymous.response.status), "Anonymous workroom access was not rejected.", {
  status: anonymous.response.status,
});

const session = await request("/api/session");
assert(session.response.ok && session.body?.authenticated === true, "Authenticated session was not resolved.", {
  status: session.response.status,
  body: session.body,
});
assert(session.body?.contextStatus === "ready", "Test identity has no ready firm context.", {
  contextStatus: session.body?.contextStatus,
});

const expectedFirmId = session.body.firmId;
for (const path of ["/api/workspace", "/api/workroom", "/api/workroom/governed"]) {
  const result = await request(path);
  assert(result.response.ok && result.body?.success === true, `${path} did not complete successfully.`, {
    status: result.response.status,
    body: result.body,
  });
}

console.log(JSON.stringify({
  event: "TSIDKENU_AUTH_E2E_PASS",
  baseUrl,
  firmId: expectedFirmId,
  routes: ["/api/session", "/api/workspace", "/api/workroom", "/api/workroom/governed"],
}));
