import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { MemoBody } from "./MemoBody";
export function MemoComposer({
  initialBody = "",
  editing = false,
  onSave,
  onCancel,
}: {
  initialBody?: string;
  editing?: boolean;
  onSave: (body: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  async function save() {
    if (!body.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(body.trim());
      setBody("");
      setPreview(false);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "保存できませんでした。",
      );
    } finally {
      setSaving(false);
    }
  }
  function insert(text: string) {
    const field = textarea.current;
    const start = field?.selectionStart ?? body.length;
    const end = field?.selectionEnd ?? start;
    setBody(body.slice(0, start) + text + body.slice(end));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + text.length, start + text.length);
    });
  }
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          void save();
        }
      }}
      aria-label={editing ? "メモを編集" : "新しいメモ"}
    >
      {preview ? (
        <div className="composer-preview">
          <MemoBody body={body} />
        </div>
      ) : (
        <textarea
          ref={textarea}
          aria-label="メモの本文"
          placeholder="本文"
          value={body}
          disabled={saving}
          onChange={(event) => setBody(event.target.value)}
        />
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
      <div className="composer-footer">
        <div className="format-tools">
          <button
            type="button"
            disabled={preview || saving}
            aria-label="タグを挿入"
            onClick={() => insert("#")}
          >
            <Icon name="hash" size={18} />
          </button>
          <button
            type="button"
            disabled={preview || saving}
            aria-label="チェックリストを挿入"
            onClick={() => insert(`${body ? "\n" : ""}- [ ] `)}
          >
            <Icon name="check" size={18} />
          </button>
        </div>
        <div className="composer-actions">
          {onCancel && (
            <button
              type="button"
              className="text-button"
              disabled={saving}
              onClick={onCancel}
            >
              キャンセル
            </button>
          )}
          <button
            type="button"
            className="text-button"
            aria-pressed={preview}
            onClick={() => setPreview(!preview)}
          >
            {preview ? "編集に戻る" : "プレビュー"}
          </button>
          <button
            className="primary-button"
            disabled={!body.trim() || saving}
            type="submit"
          >
            {saving ? "保存中…" : editing ? "変更を保存" : "メモを保存"}
            <Icon name="arrow" size={16} />
          </button>
        </div>
      </div>
    </form>
  );
}
