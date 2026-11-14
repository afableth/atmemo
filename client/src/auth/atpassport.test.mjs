import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consumePassportCallback,
  createPassportRedirect,
  normalizePassportHandle,
} from "./atpassport.ts";

function flow(origin = "https://app.example", time = 1000) {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const target = new URL(createPassportRedirect(origin, storage, time));
  const callback = new URL(target.searchParams.get("callback"));
  callback.searchParams.set("atpstate", target.searchParams.get("atpstate"));
  callback.searchParams.set("username", "Alice.Bsky.Social");
  return { origin, storage, target, callback };
}

test("passport redirects use same-origin callbacks and a fresh state", () => {
  const first = flow();
  const second = flow();
  assert.equal(first.target.origin, "https://atpassport.net");
  assert.equal(
    first.target.searchParams.get("callback"),
    "https://app.example/atpassport/callback",
  );
  assert.notEqual(
    first.target.searchParams.get("atpstate"),
    second.target.searchParams.get("atpstate"),
  );
});

test("only the handle is consumed; DID, PDS URL and token are not authentication credentials", () => {
  const { callback, origin, storage } = flow();
  callback.searchParams.set("did", "did:plc:untrusted");
  callback.searchParams.set("pdsurl", "https://untrusted.example");
  callback.searchParams.set("token", "untrusted");
  assert.equal(
    consumePassportCallback(callback.href, origin, storage, 2000),
    "alice.bsky.social",
  );
  assert.throws(() =>
    consumePassportCallback(callback.href, origin, storage, 2000),
  );
});

test("expired, future, missing, mismatched, duplicated states and wrong callback URLs are rejected", () => {
  for (const variant of [
    "expired",
    "future",
    "missing",
    "mismatch",
    "duplicate",
    "path",
    "origin",
  ]) {
    const { callback, origin, storage } = flow();
    if (variant === "missing") callback.searchParams.delete("atpstate");
    if (variant === "mismatch") callback.searchParams.set("atpstate", "bad");
    if (variant === "duplicate")
      callback.searchParams.append("atpstate", "bad");
    if (variant === "path") callback.pathname = "/other";
    if (variant === "origin") callback.hostname = "evil.example";
    const time =
      variant === "expired" ? 602000 : variant === "future" ? 0 : 2000;
    assert.throws(
      () => consumePassportCallback(callback.href, origin, storage, time),
      variant,
    );
  }
});

test("missing, conflicting, duplicated and malformed handles are rejected", () => {
  for (const variant of ["missing", "conflict", "duplicate", "url"]) {
    const { callback, origin, storage } = flow();
    if (variant === "missing") callback.searchParams.delete("username");
    if (variant === "conflict")
      callback.searchParams.set("handle", "bob.example");
    if (variant === "duplicate")
      callback.searchParams.append("username", "bob.example");
    if (variant === "url")
      callback.searchParams.set("username", "https://evil.example");
    assert.throws(
      () => consumePassportCallback(callback.href, origin, storage, 2000),
      variant,
    );
  }
  for (const handle of [
    "",
    "did:plc:untrusted",
    "alice..example",
    "-alice.example",
    "alice.123",
    "a".repeat(64) + ".example",
  ]) {
    assert.throws(() => normalizePassportHandle(handle));
  }
});

test("handle aliases and loopback callbacks work without accepting unsolicited callbacks", () => {
  const { callback, origin, storage } = flow("http://127.0.0.1:5173");
  callback.searchParams.delete("username");
  callback.searchParams.set("handle", "alice.example");
  assert.equal(
    consumePassportCallback(callback.href, origin, storage, 2000),
    "alice.example",
  );
  const fresh = flow();
  const emptyStorage = { getItem: () => null, removeItem() {} };
  assert.throws(() =>
    consumePassportCallback(
      fresh.callback.href,
      fresh.origin,
      emptyStorage,
      2000,
    ),
  );
});

test("storage failure prevents a passport redirect", () => {
  assert.throws(
    () =>
      createPassportRedirect("https://app.example", {
        setItem() {
          throw new Error("blocked");
        },
      }),
    /blocked/,
  );
});
