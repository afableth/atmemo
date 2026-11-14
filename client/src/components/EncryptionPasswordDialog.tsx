import { useEffect, useId, useRef, useState } from "react";

export function EncryptionPasswordDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (password: string) => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
    };
  }, []);

  async function submit() {
    if (!password || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      // パスワードの空白も保持する。保存成功までは入力を消さない。
      await onSubmit(password);
      setPassword("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "暗号化パスワードを設定できませんでした。",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  async function cancel() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError("");
    setPassword("");
    try {
      await onCancel();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "ログアウトできませんでした。",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="encryption-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        void cancel();
      }}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <h2 id={titleId}>暗号化パスワード</h2>
        <p id={descriptionId}>
          メモの暗号化・復号に使うパスワードを入力してください。
        </p>
        <input
          type="password"
          name="encryption-password"
          aria-label="暗号化パスワード"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          disabled={pending}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <div className="encryption-dialog-actions">
          <button
            type="button"
            className="text-button"
            disabled={pending}
            onClick={() => void cancel()}
          >
            ログアウト
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={!password || pending}
          >
            {pending ? "設定中…" : "続ける"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
