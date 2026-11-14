import { useState } from "react";

export function LoginForm({
  onSignIn,
  onPassport,
  error: initialError,
}: {
  onSignIn: (identifier: string) => Promise<void>;
  onPassport: () => Promise<void>;
  error?: string;
}) {
  const [identifier, setIdentifier] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "ログインできませんでした。",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="app-shell">
      <main className="feed login-page">
        <header className="page-heading">
          <h1>atmemo</h1>
        </header>
        <form
          className="login-form"
          aria-label="ログイン"
          onSubmit={(event) => {
            event.preventDefault();
            if (identifier.trim()) void run(() => onSignIn(identifier.trim()));
          }}
        >
          <input
            aria-label="ハンドル"
            placeholder="ハンドル"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={identifier}
            disabled={pending}
            onChange={(event) => setIdentifier(event.target.value)}
            required
          />
          <button
            className="primary-button"
            type="submit"
            disabled={pending || !identifier.trim()}
          >
            {pending ? "接続中…" : "ログイン"}
          </button>
          <button
            className="passport-button"
            type="button"
            disabled={pending}
            onClick={() => void run(onPassport)}
          >
            @passportでログイン
          </button>
        </form>
        {(error || initialError) && (
          <p className="error-message" role="alert">
            {error || initialError}
          </p>
        )}
      </main>
    </div>
  );
}
