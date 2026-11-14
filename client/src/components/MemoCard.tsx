import { useEffect, useRef, useState } from "react";
import type { Memo, MemoRepository } from "../api/memos";
import { MemoBody } from "./MemoBody";
import { MemoComposer } from "./MemoComposer";
import { Icon } from "./Icon";
export function MemoCard({
  memo,
  repository,
  onChanged,
}: {
  memo: Memo;
  repository: MemoRepository;
  onChanged: () => Promise<void>;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState<string>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setContent(undefined);
    setError("");
    memo
      .getContent()
      .then((result) => {
        if (active) setContent(result);
      })
      .catch((error: unknown) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "本文を取得できませんでした。",
          );
      });
    return () => {
      active = false;
    };
  }, [memo, visible, attempt]);
  const date = memo.updatedAt;
  return (
    <article className="memo-card" ref={ref} aria-label={`メモ ${memo.id}`}>
      <div className="memo-meta">
        <div className="memo-author">
          <time
            dateTime={memo.updatedAt.toISOString()}
            title={`作成: ${memo.createdAt.toLocaleString("ja-JP")} / 更新: ${date.toLocaleString("ja-JP")}`}
          >
            {date.toLocaleDateString("ja-JP", {
              month: "long",
              day: "numeric",
            })}{" "}
            <span className="time-part">
              {date.toLocaleTimeString("ja-JP", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </time>
        </div>
      </div>
      {editing && content !== undefined ? (
        <MemoComposer
          initialBody={content}
          editing
          onCancel={() => setEditing(false)}
          onSave={async (body) => {
            await repository.save!({
              id: memo.id,
              body,
              cid: memo.cid,
              createdAt: memo.createdAt,
            });
            setEditing(false);
            await onChanged();
          }}
        />
      ) : (
        <>
          {content !== undefined ? (
            <MemoBody body={content} />
          ) : error ? (
            <div role="alert" className="error-message">
              {error}{" "}
              <button
                className="text-button"
                onClick={() => setAttempt(attempt + 1)}
              >
                再試行
              </button>
            </div>
          ) : (
            <div
              className="skeleton"
              role="status"
              aria-label="本文を読み込み中"
            >
              <span />
              <span />
              <span />
            </div>
          )}
        </>
      )}
      {(repository.save || repository.remove) && (
        <div className="memo-card-footer">
          <div className="card-actions">
            {repository.save && (
              <button
                className="icon-button"
                aria-label="編集"
                disabled={content === undefined || editing}
                onClick={() => setEditing(true)}
              >
                <Icon name="edit" size={16} />
              </button>
            )}
            {repository.remove && (
              <button
                className="icon-button"
                aria-label="削除"
                disabled={!content || editing}
                onClick={() => setConfirmDelete(!confirmDelete)}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="delete-confirm" role="group" aria-label="削除の確認">
          <span>このメモを削除しますか？</span>
          <button
            className="text-button"
            disabled={deleting}
            onClick={() => setConfirmDelete(false)}
          >
            戻る
          </button>
          <button
            className="danger-button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await repository.remove!(memo.id, memo.cid);
                await onChanged();
              } catch (error) {
                setError(
                  error instanceof Error
                    ? error.message
                    : "削除できませんでした。",
                );
                setConfirmDelete(false);
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? "削除中…" : "削除する"}
          </button>
        </div>
      )}
      {content !== undefined && error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </article>
  );
}
