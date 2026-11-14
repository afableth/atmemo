import type { MemoReader, MemoPage } from "../api/memos";

/** ページ送りを直列化し、失敗したページは同じカーソルで再試行する。 */
export function createMemoPager(reader: MemoReader) {
  let cursor: string | undefined;
  let finished = false;
  let pending: Promise<MemoPage> | undefined;
  const seenCursors = new Set<string>();
  return {
    get hasMore() {
      return !finished;
    },
    next(): Promise<MemoPage> {
      if (pending) return pending;
      if (finished) return Promise.resolve({ items: [] });
      pending = Promise.resolve()
        .then(() => reader.list(cursor))
        .then((page) => {
          if (
            page.nextCursor !== undefined &&
            seenCursors.has(page.nextCursor)
          ) {
            throw new Error("ページを取得できませんでした。");
          }
          if (page.nextCursor !== undefined) seenCursors.add(page.nextCursor);
          cursor = page.nextCursor;
          finished = cursor === undefined;
          return page;
        })
        .finally(() => {
          pending = undefined;
        });
      return pending;
    },
  };
}
