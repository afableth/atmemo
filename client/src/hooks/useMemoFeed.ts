import { useCallback, useEffect, useRef, useState } from "react";
import { createMemoPager } from "../data/memoPager";
import type { Memo, MemoReader } from "../api/memos";

export function useMemoFeed(repository: MemoReader) {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const source = useRef<{ pager: ReturnType<typeof createMemoPager> } | null>(
    null,
  );
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    const current = source.current;
    if (!current || busy.current || !current.pager.hasMore) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const page = await current.pager.next();
      if (source.current !== current) return;
      setMemos((previous) => {
        const items = new Map(previous.map((memo) => [memo.id, memo]));
        for (const memo of page.items) items.set(memo.id, memo);
        return [...items.values()];
      });
      setHasMore(current.pager.hasMore);
    } catch (error) {
      if (source.current === current) {
        setError(
          error instanceof Error
            ? error.message
            : "メモを取得できませんでした。",
        );
      }
    } finally {
      if (source.current === current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, []);

  const reload = useCallback(async () => {
    source.current = { pager: createMemoPager(repository) };
    busy.current = false;
    setMemos([]);
    setHasMore(true);
    await loadMore();
  }, [repository, loadMore]);

  useEffect(() => {
    void reload();
    return () => {
      source.current = null;
    };
  }, [reload]);

  return { memos, loading, hasMore, error, loadMore, reload };
}
