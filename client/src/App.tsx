import { useEffect, useRef, useState } from "react";
import * as memoApi from "./api/memos";
import type { MemoRepository } from "./api/memos";
import { useMemoFeed } from "./hooks/useMemoFeed";
import { Icon } from "./components/Icon";
import { MemoCard } from "./components/MemoCard";
import { MemoComposer } from "./components/MemoComposer";
import { AuthGate } from "./components/AuthGate";
import { signOut } from "./auth/session";
import "./App.css";

export function MemoApp({
  repository,
  onSignOut,
}: {
  repository: MemoRepository;
  onSignOut?: () => Promise<void>;
}) {
  const { memos, loading, hasMore, error, loadMore, reload } =
    useMemoFeed(repository);
  const [notice, setNotice] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading || error) return;
    if (!("IntersectionObserver" in window)) {
      void loadMore();
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: "400px" },
    );
    if (sentinel.current) observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, loadMore]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <div className="app-shell">
      <main className="feed">
        <header className="page-heading">
          <h1>atmemo</h1>
          <div className="header-actions">
            {onSignOut && (
              <button className="text-button" onClick={() => void onSignOut()}>
                ログアウト
              </button>
            )}
            <button
              className="icon-button"
              onClick={() => void reload()}
              disabled={loading}
              aria-label="メモを再読み込み"
            >
              <Icon name="refresh" />
            </button>
          </div>
        </header>
        {repository.save && (
          <MemoComposer
            onSave={async (body) => {
              await repository.save!({ body });
              await reload();
              setNotice("保存しました");
            }}
          />
        )}
        <div className="memo-list">
          {memos.map((memo) => (
            <MemoCard
              key={memo.id}
              memo={memo}
              repository={repository}
              onChanged={reload}
            />
          ))}
        </div>
        {loading && (
          <div className="loading-state" role="status">
            読み込み中…
          </div>
        )}
        {error && (
          <div className="empty-state" role="alert">
            <p>{error}</p>
            <button className="primary-button" onClick={() => void loadMore()}>
              再試行
            </button>
          </div>
        )}
        {!loading && !error && !hasMore && memos.length === 0 && (
          <div className="empty-state">
            <p>メモはありません</p>
          </div>
        )}
        <div
          ref={sentinel}
          className="pagination-sentinel"
          aria-hidden="true"
        />
      </main>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {notice}
        </div>
      )}
    </div>
  );
}
export default function App() {
  return (
    <AuthGate>
      <MemoApp repository={memoApi} onSignOut={signOut} />
    </AuthGate>
  );
}
