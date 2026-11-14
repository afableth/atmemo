import { useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import {
  getAuthState,
  initializeAuth,
  signIn,
  signInWithPassport,
  signOut,
  subscribeAuth,
} from "../auth/session";
import { LoginForm } from "./LoginForm";
import { EncryptionPasswordGate } from "./EncryptionPasswordGate";

export function AuthGate({ children }: { children: ReactNode }) {
  const auth = useSyncExternalStore(subscribeAuth, getAuthState);
  useEffect(() => {
    void initializeAuth();
  }, []);
  if (auth.status === "loading") {
    return (
      <div className="app-shell">
        <main className="feed">
          <header className="page-heading">
            <h1>atmemo</h1>
          </header>
          <div className="loading-state" role="status">
            読み込み中…
          </div>
        </main>
      </div>
    );
  }
  if (auth.status === "signed-out")
    return (
      <LoginForm
        onSignIn={signIn}
        onPassport={signInWithPassport}
        error={auth.error}
      />
    );
  return (
    <EncryptionPasswordGate
      key={auth.did}
      userId={auth.did!}
      onCancel={signOut}
    >
      {children}
    </EncryptionPasswordGate>
  );
}
