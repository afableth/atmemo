import { test } from "node:test";
import assert from "node:assert/strict";
import { lexStringify, lexParse } from "@atproto/lex";
import { createSpaceApi } from "./space.ts";
import {
  NotAuthenticatedError,
  PermissionDeniedError,
  MemoNotFoundError,
  NetworkError,
  SpaceRpcError,
} from "./errors.ts";

const repo = {
  space: "at://did:plc:owner/com.atproto.personalspace.self/self",
  repo: "did:plc:alice",
};
const record = {
  $type: "fyi.afabl.atmemo.memo",
  createdAt: "2026-11-14T00:00:00Z",
  updatedAt: "2026-11-14T00:00:00Z",
  encryptedContent: new Uint8Array([1, 2, 3]),
};
const json = (value) =>
  new Response(lexStringify(value), {
    headers: { "Content-Type": "application/json" },
  });

test("Space queries preserve cursor/space parameters and validate and decode records", async () => {
  const calls = [];
  const api = createSpaceApi(async (path, init) => {
    calls.push({ path, init });
    if (path.includes("listRecords"))
      return json({
        records: [
          { collection: record.$type, rkey: "key", cid: "cid", value: record },
        ],
        cursor: "next+page&token",
      });
    return json({ uri: "at://record", cid: "cid", value: record });
  });
  const listed = await api.listRecords({
    ...repo,
    cursor: "cursor+with&symbols",
    excludeValues: false,
  });
  assert.deepEqual(listed.records[0].value, record);
  assert.equal(listed.cursor, "next+page&token");
  const url = new URL(calls[0].path, "https://pds.example");
  assert.equal(url.pathname, "/xrpc/com.atproto.space.listRecords");
  assert.equal(url.searchParams.get("space"), repo.space);
  assert.equal(url.searchParams.get("cursor"), "cursor+with&symbols");
  assert.equal(url.searchParams.get("collection"), record.$type);
  assert.equal(url.searchParams.get("excludeValues"), "false");
  assert.equal(calls[0].init.method, "GET");
  assert.deepEqual(
    (await api.getRecord({ ...repo, rkey: "key" })).value,
    record,
  );
});

test("writes use Space endpoints and AT Protocol bytes encoding", async () => {
  const calls = [];
  const api = createSpaceApi(async (path, init) => {
    calls.push({ path, init });
    return json(
      path.endsWith("deleteRecord") ? {} : { uri: "at://record", cid: "cid" },
    );
  });
  await api.createRecord({ ...repo, record });
  await api.putRecord({ ...repo, rkey: "key", record });
  await api.deleteRecord({ ...repo, rkey: "key" });
  assert.deepEqual(
    calls.map((call) => call.path),
    ["createRecord", "putRecord", "deleteRecord"].map(
      (method) => "/xrpc/com.atproto.space." + method,
    ),
  );
  assert.ok(calls.every((call) => call.init.method === "POST"));
  assert.deepEqual(lexParse(calls[0].init.body).record, record);
  assert.deepEqual(JSON.parse(calls[0].init.body).record.encryptedContent, {
    $bytes: "AQID",
  });
  assert.equal(JSON.parse(calls[1].init.body).collection, record.$type);
  assert.equal(JSON.parse(calls[1].init.body).validate, true);
});

test("invalid records and oversized ciphertext are rejected before making requests", async () => {
  let calls = 0;
  const api = createSpaceApi(async () => {
    calls++;
    return json({});
  });
  for (const invalid of [
    { ...record, $type: "other.app.record" },
    { ...record, createdAt: "not-a-date" },
    { ...record, encryptedContent: "plaintext" },
    { ...record, encryptedContent: new Uint8Array(65537) },
  ])
    await assert.rejects(api.createRecord({ ...repo, record: invalid }));
  await assert.rejects(
    api.applyWrites({
      ...repo,
      writes: [
        { type: "delete", rkey: "one" },
        { type: "update", rkey: "two", value: { ...record, updatedAt: "bad" } },
      ],
    }),
  );
  assert.equal(calls, 0);
});

test("batch writes validate records and encode discriminated operations", async () => {
  let body;
  const api = createSpaceApi(async (_path, init) => {
    body = lexParse(init.body);
    return json({ results: [] });
  });
  await api.applyWrites({
    ...repo,
    writes: [
      { type: "create", value: record },
      { type: "update", rkey: "two", value: record },
      { type: "delete", rkey: "three" },
    ],
  });
  assert.deepEqual(
    body.writes.map((write) => write.$type),
    ["create", "update", "delete"].map(
      (type) => "com.atproto.space.applyWrites#" + type,
    ),
  );
  assert.ok(body.writes.every((write) => write.collection === record.$type));
  assert.deepEqual(body.writes[0].value, record);
});

test("invalid response records are rejected and metadata-only enumeration is supported", async () => {
  const invalid = createSpaceApi(async () =>
    json({
      uri: "at://record",
      cid: "cid",
      value: { ...record, encryptedContent: "bad" },
    }),
  );
  await assert.rejects(invalid.getRecord({ ...repo, rkey: "key" }));
  const metadata = createSpaceApi(async () =>
    json({ records: [{ collection: record.$type, rkey: "key", cid: "cid" }] }),
  );
  assert.equal((await metadata.listRecords(repo)).records[0].value, undefined);
  const wrongCollection = createSpaceApi(async () =>
    json({
      records: [{ collection: "other.app.record", rkey: "key", cid: "cid" }],
    }),
  );
  await assert.rejects(wrongCollection.listRecords(repo), SpaceRpcError);
});

test("authentication, authorization, not-found and network errors remain distinguishable", async () => {
  for (const [status, error, Type] of [
    [401, "AuthRequired", NotAuthenticatedError],
    [403, "Forbidden", PermissionDeniedError],
    [404, "RecordNotFound", MemoNotFoundError],
    [404, "SpaceNotFound", SpaceRpcError],
  ]) {
    const api = createSpaceApi(
      async () => new Response(JSON.stringify({ error }), { status }),
    );
    await assert.rejects(api.getRecord({ ...repo, rkey: "key" }), Type);
  }
  const cause = new TypeError("offline");
  const offline = createSpaceApi(async () => {
    throw cause;
  });
  await assert.rejects(
    offline.listRecords(repo),
    (error) => error instanceof NetworkError && error.cause === cause,
  );
  const auth = new NotAuthenticatedError();
  await assert.rejects(
    createSpaceApi(async () => {
      throw auth;
    }).listRecords(repo),
    (error) => error === auth,
  );
});
