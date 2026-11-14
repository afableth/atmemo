import { useState } from "react";
import type { ReactNode } from "react";
import { setPassword } from "../crypto";
import { EncryptionPasswordDialog } from "./EncryptionPasswordDialog";

export function EncryptionPasswordGate({
  userId,
  onCancel,
  children,
}: {
  userId: string;
  onCancel: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  if (ready) return children;
  return (
    <div className="app-shell">
      <main className="feed">
        <header className="page-heading">
          <h1>atmemo</h1>
        </header>
        <EncryptionPasswordDialog
          onSubmit={(password) => {
            setPassword(password, userId);
            setReady(true);
          }}
          onCancel={onCancel}
        />
      </main>
    </div>
  );
}
