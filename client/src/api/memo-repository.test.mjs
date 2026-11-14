import { test } from "node:test";
import assert from "node:assert/strict";
import { TID } from "@atproto/common-web";
import { lexParse, lexStringify } from "@atproto/lex";
import { createMemoRepository } from "./memo-repository.ts";
import { createSpaceApi } from "./space.ts";
import {
  encrypt,
  decrypt,
  setPassword,
  clearKeyCache,
  PASSWORD_STORAGE_KEY,
  SALT_STORAGE_KEY_PREFIX,
} from "../crypto.ts";
import { DecryptionError, NotAuthenticatedError } from "./errors.ts";

const password = "メモAPIの暗号化テスト";
const repo = "did:plc:alice";
const space = "at://" + repo + "/space/fyi.afabl.atmemo/self";
const createdAt = new Date("2026-11-14T00:00:00Z");
const id = TID.nextStr();
function json(value) {
  return new Response(lexStringify(value));
}
function storage(t) {
  clearKeyCache();
  const entries = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    },
  });
  t.after(() => {
    clearKeyCache();
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  });
  return entries;
}
function repository(fetch) {
  return createMemoRepository(() => ({
    repo,
    space,
    api: createSpaceApi(fetch),
  }));
}

test("new saves put encrypted records under fresh TIDs; plaintext never reaches the request", async (t) => {
  const entries = storage(t);
  setPassword(password);
  const writes = [];
  const memos = repository(async (path, init) => {
    writes.push({ path, body: init.body });
    return json({ uri: "at://record", cid: "cid" });
  });
  await memos.save({ body: "# 秘密のメモ\n本文" });
  await memos.save({ body: "別のメモ" });
  assert.ok(entries.has(SALT_STORAGE_KEY_PREFIX + repo));
  const first = lexParse(writes[0].body);
  const second = lexParse(writes[1].body);
  assert.ok(
    writes.every((write) => write.path === "/xrpc/com.atproto.space.putRecord"),
  );
  assert.ok(TID.is(first.rkey));
  assert.ok(TID.is(second.rkey));
  assert.notEqual(first.rkey, second.rkey);
  assert.equal(first.space, space);
  assert.equal(first.repo, repo);
  assert.equal(first.record.createdAt, first.record.updatedAt);
  assert.ok(first.record.encryptedContent instanceof Uint8Array);
  assert.equal(
    await decrypt(first.record.encryptedContent, password),
    "# 秘密のメモ\n本文",
  );
  assert.doesNotMatch(writes[0].body, /秘密|本文/);
  assert.equal(first.swapCommit, undefined);
  assert.equal(first.swapRecord, undefined);
});

test("updates preserve IDs and creation dates; remove uses deleteRecord with the existing signature", async (t) => {
  storage(t);
  setPassword(password);
  const requests = [];
  const memos = repository(async (path, init) => {
    requests.push({ path, input: lexParse(init.body) });
    return json(
      path.endsWith("putRecord") ? { uri: "at://record", cid: "new-cid" } : {},
    );
  });
  await memos.save({ id, cid: "old-cid", createdAt, body: "変更したメモ" });
  await memos.remove(id, "new-cid");
  assert.equal(requests[0].input.rkey, id);
  assert.equal(requests[0].input.record.createdAt, createdAt.toISOString());
  assert.equal(
    await decrypt(requests[0].input.record.encryptedContent, password),
    "変更したメモ",
  );
  assert.equal(requests[1].path, "/xrpc/com.atproto.space.deleteRecord");
  assert.equal(requests[1].input.rkey, id);
  assert.equal(requests[1].input.swapCommit, undefined);
});

test("list returns Date metadata and lazy decryptors; no plaintext is cached after password changes", async (t) => {
  const entries = storage(t);
  const encryptedContent = await encrypt("保存済みのメモ", password);
  const record = {
    $type: "fyi.afabl.atmemo.memo",
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    encryptedContent,
  };
  const memos = repository(async (path) => {
    const url = new URL(path, "https://pds.example");
    assert.equal(url.pathname, "/xrpc/com.atproto.space.listRecords");
    assert.equal(url.searchParams.get("cursor"), "page+2");
    assert.equal(url.searchParams.get("excludeValues"), "false");
    return json({
      records: [
        { collection: record.$type, rkey: id, cid: "cid", value: record },
      ],
      cursor: "page3",
    });
  });
  // 一覧の段階ではパスワード不要。復号はgetContentだけが行う。
  const page = await memos.list("page+2");
  assert.equal(page.nextCursor, "page3");
  assert.equal(page.items[0].id, id);
  assert.equal(page.items[0].cid, "cid");
  assert.deepEqual(page.items[0].createdAt, createdAt);
  assert.deepEqual(page.items[0].updatedAt, createdAt);
  await assert.rejects(page.items[0].getContent(), DecryptionError);
  entries.set(PASSWORD_STORAGE_KEY, password);
  assert.equal(await page.items[0].getContent(), "保存済みのメモ");
  entries.set(PASSWORD_STORAGE_KEY, "wrong password");
  await assert.rejects(page.items[0].getContent(), DecryptionError);
});

test("metadata-only listing retrieves the record before exposing metadata and a decryptor", async (t) => {
  storage(t);
  setPassword(password);
  const record = {
    $type: "fyi.afabl.atmemo.memo",
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    encryptedContent: await encrypt("個別取得", password),
  };
  const calls = [];
  const memos = repository(async (path) => {
    calls.push(path);
    return json(
      path.includes("listRecords")
        ? { records: [{ collection: record.$type, rkey: id, cid: "old-cid" }] }
        : { uri: "at://record", cid: "current-cid", value: record },
    );
  });
  const page = await memos.list();
  assert.equal(calls.length, 2);
  assert.equal(page.items[0].cid, "current-cid");
  assert.equal(await page.items[0].getContent(), "個別取得");
  assert.equal(calls.length, 2);
});

test("missing passwords and changed accounts cannot send writes or reveal decrypted content", async (t) => {
  const entries = storage(t);
  let calls = 0;
  const api = createSpaceApi(async () => {
    calls++;
    return json({});
  });
  const memos = createMemoRepository(() => ({ repo, space, api }));
  await assert.rejects(memos.save({ body: "秘密" }), /パスワード/);
  assert.equal(calls, 0);
  const encryptedContent = await encrypt("秘密", password);
  let active = true;
  const readApi = createSpaceApi(async () =>
    json({
      records: [
        {
          collection: "fyi.afabl.atmemo.memo",
          rkey: id,
          cid: "cid",
          value: {
            $type: "fyi.afabl.atmemo.memo",
            createdAt: createdAt.toISOString(),
            updatedAt: createdAt.toISOString(),
            encryptedContent,
          },
        },
      ],
    }),
  );
  const reader = createMemoRepository(() => {
    if (!active) throw new NotAuthenticatedError();
    return { repo, space, api: readApi };
  });
  const page = await reader.list();
  entries.set(PASSWORD_STORAGE_KEY, password);
  active = false;
  await assert.rejects(page.items[0].getContent(), NotAuthenticatedError);
});
