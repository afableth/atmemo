import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ensureMemoSpace } from "../api/memos";

export function SpaceGate({
  children,
  onCancel,
}: {
  children: ReactNode;
  onCancel: () => void | Promise<void>;
}) {
  const pending = useRef<Promise<void> | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    pending.current ??= ensureMemoSpace();
    void pending.current.then(
      () => {
        if (active) setReady(true);
      },
      (cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Spaceを準備できませんでした。",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  if (ready) return children;
  return (
    <div className="app-shell">
      <main className="feed">
        <header className="page-heading">
          <h1>atmemo</h1>
        </header>
        {error ? (
          <div className="empty-state" role="alert">
            <p>{error}</p>
            <button
              className="primary-button"
              onClick={() => {
                pending.current = undefined;
                setError(undefined);
                setAttempt((value) => value + 1);
              }}
            >
              再試行
            </button>
            <button className="text-button" onClick={() => void onCancel()}>
              ログアウト
            </button>
          </div>
        ) : (
          <div className="loading-state" role="status">読み込み中…</div>
        )}
      </main>
    </div>
  );
}
