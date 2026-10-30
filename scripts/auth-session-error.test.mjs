import test from "node:test";
import assert from "node:assert/strict";
import { isMissingAuthSession } from "../src/lib/auth-session-error.ts";

test("anonymous Supabase response is a signed-out state", () => {
  assert.equal(isMissingAuthSession({name:"AuthSessionMissingError"}), true);
  assert.equal(isMissingAuthSession({code:"session_not_found"}), true);
  assert.equal(isMissingAuthSession(null), false);
});
test("invalid and rejected credentials are not swallowed", () => {
  for (const error of [
    {name:"AuthApiError",code:"invalid_jwt"},
    {name:"AuthRetryableFetchError"},
    {name:"AuthApiError",code:"bad_jwt"},
    {name:"Error"},
  ]) assert.equal(isMissingAuthSession(error),false);
});
