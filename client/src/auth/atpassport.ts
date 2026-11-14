import { AtPassport } from "@atpassport/client/core";
import { PASSPORT_CALLBACK_PATH } from "./config.ts";

const stateKey = "atmemo.atpassport.state";
const maxAge = 10 * 60 * 1000;
type StateStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createPassport(origin: string) {
  return new AtPassport({
    callbackUrl: new URL(PASSPORT_CALLBACK_PATH, origin).href,
    lang: "ja",
    fedcm: { clientId: origin },
  });
}

export function normalizePassportHandle(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(
      value,
    )
  ) {
    throw new Error("@passportから有効なハンドルを取得できませんでした。");
  }
  return value.toLowerCase();
}

export function createPassportRedirect(
  origin: string,
  storage: StateStorage,
  now = Date.now(),
): string {
  const { url, atpstate } = createPassport(origin).generateAuthUrl();
  storage.setItem(
    stateKey,
    JSON.stringify({ state: atpstate, createdAt: now }),
  );
  return url;
}

/** 選択結果を一度だけ消費する。DID・PDS URL・tokenは認証には使用しない。 */
export function consumePassportCallback(
  currentUrl: string,
  origin: string,
  storage: StateStorage,
  now = Date.now(),
): string {
  const stored = storage.getItem(stateKey);
  storage.removeItem(stateKey);
  if (!stored) throw new Error("@passportの認証状態がありません。");
  const pending: unknown = JSON.parse(stored);
  if (
    typeof pending !== "object" ||
    pending === null ||
    !("state" in pending) ||
    typeof pending.state !== "string" ||
    !pending.state ||
    !("createdAt" in pending) ||
    typeof pending.createdAt !== "number" ||
    !Number.isFinite(pending.createdAt) ||
    now < pending.createdAt ||
    now - pending.createdAt > maxAge
  ) {
    throw new Error("@passportの認証状態が無効または期限切れです。");
  }
  const url = new URL(currentUrl);
  for (const name of ["atpstate", "username", "handle"]) {
    if (url.searchParams.getAll(name).length > 1)
      throw new Error("@passportのコールバックが無効です。");
  }
  const username = url.searchParams.get("username");
  const alias = url.searchParams.get("handle");
  if (username && alias && username.toLowerCase() !== alias.toLowerCase()) {
    throw new Error("@passportのハンドルが一致しません。");
  }
  const result = createPassport(origin).parseCallback(url.href, pending.state);
  return normalizePassportHandle(result.username);
}
