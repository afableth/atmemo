import { Client } from "@atproto/lex";
import type {
  BrowserOAuthClient,
  OAuthSession,
} from "@atproto/oauth-client-browser";
import {
  getOAuthClientId,
  OAUTH_CALLBACK_PATH,
  OAUTH_SCOPE,
  PASSPORT_CALLBACK_PATH,
} from "./config";
import {
  consumePassportCallback,
  createPassport,
  createPassportRedirect,
  normalizePassportHandle,
} from "./atpassport";

export interface AuthState {
  status: "loading" | "signed-out" | "signed-in";
  did?: string;
  error?: string;
}

// OAuthSessionから作る認証済みクライアント。ログアウト時は破棄する。
export let client: Client | undefined;
let session: OAuthSession | undefined;
let state: AuthState = { status: "loading" };
let oauthPromise: Promise<BrowserOAuthClient> | undefined;
let initialization: Promise<void> | undefined;
const listeners = new Set<() => void>();

function update(next: AuthState) {
  state = next;
  for (const listener of listeners) listener();
}
export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function getAuthState() {
  return state;
}

function setSession(value?: OAuthSession) {
  session = value;
  client = value ? new Client(value) : undefined;
  update(
    value ? { status: "signed-in", did: value.did } : { status: "signed-out" },
  );
}
function getOAuthClient() {
  oauthPromise ??= (async () => {
    const { BrowserOAuthClient } =
      await import("@atproto/oauth-client-browser");
    return BrowserOAuthClient.load({
      clientId: getOAuthClientId(window.location.origin),
      handleResolver:
        import.meta.env.VITE_HANDLE_RESOLVER_URL || "https://bsky.social",
      responseMode: "fragment",
      onSessionDeleted(sub) {
        if (session?.sub === sub) setSession();
      },
    });
  })().catch((error) => {
    oauthPromise = undefined;
    throw error;
  });
  return oauthPromise;
}

/** StrictMode下でもOAuthコールバックの処理は一度だけ行う。 */
export function initializeAuth(): Promise<void> {
  initialization ??= (async () => {
    if (window.location.hostname === "localhost") {
      const url = new URL(window.location.href);
      url.hostname = "127.0.0.1";
      window.location.replace(url.href);
      return;
    }
    let passportHandle: string | undefined;
    if (window.location.pathname === PASSPORT_CALLBACK_PATH) {
      try {
        passportHandle = consumePassportCallback(
          window.location.href,
          window.location.origin,
          sessionStorage,
        );
      } finally {
        window.history.replaceState(null, "", "/");
      }
    }
    const isCallback = window.location.pathname === OAUTH_CALLBACK_PATH;
    try {
      const oauth = await getOAuthClient();
      const result = await oauth.init();
      if (passportHandle) {
        await oauth.signInRedirect(passportHandle, { scope: OAUTH_SCOPE });
      } else {
        setSession(result?.session);
      }
    } finally {
      if (isCallback) window.history.replaceState(null, "", "/");
    }
  })().catch((error: unknown) => {
    session = undefined;
    client = undefined;
    update({
      status: "signed-out",
      error:
        error instanceof Error ? error.message : "ログインできませんでした。",
    });
  });
  return initialization;
}

export async function signIn(identifier: string): Promise<void> {
  const oauth = await getOAuthClient();
  await oauth.signInRedirect(identifier.trim(), { scope: OAUTH_SCOPE });
}

export async function signInWithPassport(): Promise<void> {
  // FedCMはユーザー操作直後に開始する。対応しない環境ではリダイレクトする。
  const result = await createPassport(
    window.location.origin,
  ).requestHandleAssist({
    fallback() {
      window.location.assign(
        createPassportRedirect(window.location.origin, sessionStorage),
      );
      return null;
    },
  });
  if (result) await signIn(normalizePassportHandle(result.username));
}

export async function signOut(): Promise<void> {
  const previous = session;
  if (!previous) return;
  // 先に画面とAPIの認証状態を破棄し、失効通知でも表示を戻す。
  setSession();
  try {
    const oauth = await getOAuthClient();
    await oauth.revoke(previous.sub);
  } catch (error) {
    update({
      status: "signed-out",
      error:
        error instanceof Error
          ? error.message
          : "セッションを失効できませんでした。",
    });
  }
}
