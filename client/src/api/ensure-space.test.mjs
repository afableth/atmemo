import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureSpace, memoSpaceUri } from "./ensure-space.ts";
import { PermissionDeniedError, SpaceRpcError } from "./errors.ts";

const did = "did:plc:alice";

test("existing Space is left unchanged", async () => {
  await ensureSpace({
    async getSpace(uri) { assert.equal(uri, memoSpaceUri(did)); },
    async createSpace() { assert.fail("must not create an existing Space"); },
  }, did);
});

for (const concurrent of [false, true]) {
  test(`missing Space is created and checked (concurrent=${concurrent})`, async () => {
    let reads = 0;
    let creates = 0;
    await ensureSpace({
      async getSpace(uri) {
        assert.equal(uri, "at://did:plc:alice/space/fyi.afabl.atmemo/self");
        if (++reads === 1) throw new SpaceRpcError(400, "SpaceNotFound");
      },
      async createSpace(input) {
        creates++;
        assert.deepEqual(input, {
          spaceType: "fyi.afabl.atmemo",
          skey: "self",
          policy: { $type: "com.atproto.personalspace.policy" },
        });
        if (concurrent) throw new SpaceRpcError(400, "SpaceAlreadyExists");
      },
    }, did);
    assert.equal(reads, 2);
    assert.equal(creates, 1);
  });
}

test("permission errors do not trigger creation", async () => {
  const error = new PermissionDeniedError();
  await assert.rejects(ensureSpace({
    async getSpace() { throw error; },
    async createSpace() { assert.fail("must not create after a permission error"); },
  }, did), (cause) => cause === error);
});

test("creation failures are surfaced", async () => {
  const error = new PermissionDeniedError();
  await assert.rejects(ensureSpace({
    async getSpace() { throw new SpaceRpcError(400, "SpaceNotFound"); },
    async createSpace() { throw error; },
  }, did), (cause) => cause === error);
});
