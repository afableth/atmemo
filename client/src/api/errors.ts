export type MemoApiErrorCode =
  | "NOT_AUTHENTICATED"
  | "CID_MISMATCH"
  | "NOT_FOUND"
  | "PERMISSION_DENIED"
  | "NETWORK_ERROR"
  | "DECRYPTION_FAILED"
  | "SPACE_RPC_FAILED";

export class MemoApiError extends Error {
  readonly code: MemoApiErrorCode;

  constructor(code: MemoApiErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NotAuthenticatedError extends MemoApiError {
  constructor(options?: ErrorOptions) {
    super("NOT_AUTHENTICATED", "ログインしてください。", options);
  }
}

export class CidMismatchError extends MemoApiError {
  readonly id: string;
  readonly expectedCid: string;
  readonly actualCid?: string;

  constructor(
    details: { id: string; expectedCid: string; actualCid?: string },
    options?: ErrorOptions,
  ) {
    super("CID_MISMATCH", "メモが更新されています。", options);
    this.id = details.id;
    this.expectedCid = details.expectedCid;
    this.actualCid = details.actualCid;
  }
}

export class MemoNotFoundError extends MemoApiError {
  readonly id: string;

  constructor(id: string, options?: ErrorOptions) {
    super("NOT_FOUND", "メモが見つかりません。", options);
    this.id = id;
  }
}

export class PermissionDeniedError extends MemoApiError {
  constructor(options?: ErrorOptions) {
    super("PERMISSION_DENIED", "操作する権限がありません。", options);
  }
}

export class NetworkError extends MemoApiError {
  constructor(options?: ErrorOptions) {
    super("NETWORK_ERROR", "通信できませんでした。", options);
  }
}

export class DecryptionError extends MemoApiError {
  constructor(options?: ErrorOptions) {
    super("DECRYPTION_FAILED", "メモを復号できませんでした。", options);
  }
}

export class SpaceRpcError extends MemoApiError {
  readonly status: number;
  readonly error?: string;
  constructor(status: number, error?: string, options?: ErrorOptions) {
    super("SPACE_RPC_FAILED", "Spaces APIの呼び出しに失敗しました。", options);
    this.status = status;
    this.error = error;
  }
}
