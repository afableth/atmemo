import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoPager } from "./memoPager.ts";

test("page requests are serialized, content remains lazy, and EOF stops requests", async () => {
  const cursors = [];
  let contentCalls = 0;
  const memo = {
    id: "1",
    createdAt: new Date("2026-11-14T00:00:00Z"),
    updatedAt: new Date("2026-11-14T00:00:00Z"),
    cid: "1",
    getContent: async () => {
      contentCalls++;
      return "**本文**";
    },
  };
  const pager = createMemoPager({
    async list(cursor) {
      cursors.push(cursor);
      return cursor === undefined
        ? { items: [memo], nextCursor: "next" }
        : { items: [] };
    },
  });
  const first = pager.next();
  assert.equal(pager.next(), first);
  const page = await first;
  assert.equal(contentCalls, 0);
  assert.equal(await page.items[0].getContent(), "**本文**");
  assert.equal(contentCalls, 1);
  await pager.next();
  assert.equal(pager.hasMore, false);
  await pager.next();
  assert.deepEqual(cursors, [undefined, "next"]);
});

test("a failed page retries its cursor without skipping ahead", async () => {
  const cursors = [];
  let failed = false;
  const pager = createMemoPager({
    async list(cursor) {
      cursors.push(cursor);
      if (cursor === undefined) return { items: [], nextCursor: "second" };
      if (!failed) {
        failed = true;
        throw new Error("network");
      }
      return { items: [] };
    },
  });
  await pager.next();
  await assert.rejects(pager.next(), /network/);
  assert.equal(pager.hasMore, true);
  await pager.next();
  assert.deepEqual(cursors, [undefined, "second", "second"]);
  assert.equal(pager.hasMore, false);
});

test("a repeated cursor stops an automatic pagination loop", async () => {
  const pager = createMemoPager({
    async list() {
      return { items: [], nextCursor: "same" };
    },
  });
  await pager.next();
  await assert.rejects(pager.next(), /ページを取得できませんでした/);
});
