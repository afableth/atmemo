import { TID } from "@atproto/common-web";
import { encrypt, decrypt } from "../crypto.ts";
import * as schema from "../lexicons/fyi/afabl/atmemo/memo.defs.ts";
import { DecryptionError, NotAuthenticatedError } from "./errors.ts";
import type { Memo, MemoRepository, SaveMemoInput } from "./memos.ts";
import type { createSpaceApi } from "./space.ts";

export interface MemoContext {
  repo: string;
  space: string;
  api: Pick<
    ReturnType<typeof createSpaceApi>,
    "listRecords" | "getRecord" | "putRecord" | "deleteRecord"
  >;
}

/** 引数は公開APIと同じ。認証情報とSpaceは内部コンテキストから取得する。 */
export function createMemoRepository(getContext: () => MemoContext) {
  function assertContext(expected: MemoContext) {
    const active = getContext();
    if (active.repo !== expected.repo || active.space !== expected.space)
      throw new NotAuthenticatedError();
  }

  return {
    async list(cursor?: string) {
      const context = getContext();
      const page = await context.api.listRecords({
        repo: context.repo,
        space: context.space,
        cursor,
        excludeValues: false,
      });
      assertContext(context);
      const items: Memo[] = await Promise.all(
        page.records.map(async (entry) => {
          // 通常はlistRecordsのvalueを使う。値を返さないPDSでは個別取得する。
          const record =
            entry.value === undefined
              ? await context.api.getRecord({
                  repo: context.repo,
                  space: context.space,
                  rkey: entry.rkey,
                })
              : { cid: entry.cid, value: entry.value };
          const value = schema.$parse(record.value);
          const encryptedContent = new Uint8Array(value.encryptedContent);
          return {
            id: entry.rkey,
            cid: record.cid,
            createdAt: new Date(value.createdAt),
            updatedAt: new Date(value.updatedAt),
            async getContent() {
              assertContext(context);
              let body: string;
              try {
                body = await decrypt(encryptedContent);
              } catch (cause) {
                throw new DecryptionError({ cause });
              }
              assertContext(context);
              return body;
            },
          };
        }),
      );
      assertContext(context);
      return { items, nextCursor: page.cursor };
    },
    async save(input: SaveMemoInput): Promise<void> {
      const context = getContext();
      const now = new Date();
      const updating = "id" in input;
      const rkey = updating ? input.id : TID.nextStr();
      const createdAt = updating ? input.createdAt : now;
      const encryptedContent = await encrypt(
        input.body,
        undefined,
        context.repo,
      );
      const record = schema.$parse({
        $type: schema.$type,
        createdAt: createdAt.toISOString(),
        updatedAt: now.toISOString(),
        encryptedContent,
      });
      assertContext(context);
      // Spaces putRecordにswapCommit/swapRecordはない。cid引数は互換性のため維持する。
      await context.api.putRecord({
        space: context.space,
        repo: context.repo,
        rkey,
        record,
      });
    },
    async remove(id: string, _cid: string): Promise<void> {
      const context = getContext();
      await context.api.deleteRecord({
        space: context.space,
        repo: context.repo,
        rkey: id,
      });
    },
  } satisfies MemoRepository;
}
