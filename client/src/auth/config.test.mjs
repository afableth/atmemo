import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createClientMetadata,
  getOAuthClientId,
  OAUTH_SCOPE,
  PUBLIC_ORIGIN,
} from "./config.ts";

test("production metadata is fixed to atmemo.afabl.fyi", () => {
  const metadata = createClientMetadata();
  assert.equal(PUBLIC_ORIGIN, "https://atmemo.afabl.fyi");
  assert.equal(
    metadata.client_id,
    "https://atmemo.afabl.fyi/oauth-client-metadata.json",
  );
  assert.equal(metadata.client_id, getOAuthClientId(PUBLIC_ORIGIN));
  assert.deepEqual(metadata.redirect_uris, [
    "https://atmemo.afabl.fyi/oauth/callback",
  ]);
  assert.equal(metadata.scope, OAUTH_SCOPE);
  assert.ok(metadata.scope.includes("space:fyi.afabl.atmemo?"));
  const permission = new URL(metadata.scope.split(" ")[1]);
  assert.equal(permission.pathname, "fyi.afabl.atmemo");
  assert.equal(permission.searchParams.get("authority"), "self");
  assert.equal(permission.searchParams.get("skey"), "self");
  assert.equal(
    permission.searchParams.get("collection"),
    "fyi.afabl.atmemo.memo",
  );
  assert.deepEqual(permission.searchParams.getAll("action"), [
    "read_self",
    "create",
    "update",
    "delete",
  ]);
  assert.equal(metadata.token_endpoint_auth_method, "none");
  assert.equal(metadata.dpop_bound_access_tokens, true);
  assert.deepEqual(metadata.grant_types, [
    "authorization_code",
    "refresh_token",
  ]);
});

test("development client IDs keep exact loopback ports and scopes", () => {
  for (const origin of ["http://127.0.0.1:5173", "http://[::1]:5173"]) {
    const id = new URL(getOAuthClientId(origin));
    assert.equal(id.origin, "http://localhost");
    assert.equal(
      id.searchParams.get("redirect_uri"),
      origin + "/oauth/callback",
    );
    assert.equal(id.searchParams.get("scope"), OAUTH_SCOPE);
  }
});

test("unconfigured HTTPS and insecure public origins are rejected", () => {
  assert.throws(() => getOAuthClientId("https://app.example"));
  assert.throws(() => getOAuthClientId("http://atmemo.afabl.fyi"));
});
