import { lexParse, lexStringify } from "@atproto/lex";
import * as memo from "../lexicons/fyi/afabl/atmemo/memo.defs.ts";
import {
  MemoApiError,
  MemoNotFoundError,
  NetworkError,
  NotAuthenticatedError,
  PermissionDeniedError,
  SpaceRpcError,
} from "./errors.ts";

export type AuthenticatedFetch = (
  path: `/${string}`,
  init?: RequestInit,
) => Promise<Response>;
export interface SpaceRepo {
  space: string;
  repo: string;
}
export interface SpaceRecordKey extends SpaceRepo {
  rkey: string;
}
export interface SpaceRecord {
  uri: string;
  cid: string;
  value: memo.Main;
}
export interface SpaceRecordEntry {
  collection: string;
  rkey: string;
  cid: string;
  value?: memo.Main;
}
export interface SpaceWriteResult {
  uri: string;
  cid: string;
  validationStatus?: string;
}
export type SpaceWrite =
  | { type: "create"; rkey?: string; value: unknown }
  | { type: "update"; rkey: string; value: unknown }
  | { type: "delete"; rkey: string };

type Params = Record<string, string | number | boolean | undefined>;
const collection = memo.$nsid;

function object(value: unknown, status = 200): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new SpaceRpcError(status, "InvalidResponse");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string")
    throw new SpaceRpcError(200, "InvalidResponse");
  return value;
}
function writeResult(value: unknown): SpaceWriteResult {
  const result = object(value);
  return {
    uri: string(result.uri),
    cid: string(result.cid),
    ...(typeof result.validationStatus === "string"
      ? { validationStatus: result.validationStatus }
      : {}),
  };
}

/** RPCにはLexのClientを使わず、OAuthSessionのfetchHandlerを受け取る。 */
export function createSpaceApi(fetch: AuthenticatedFetch) {
  async function request(
    method: string,
    params?: Params,
    input?: unknown,
  ): Promise<unknown> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {}))
      if (value !== undefined) search.set(key, String(value));
    const query = search.size ? `?${search}` : "";
    let response: Response;
    try {
      response = await fetch(`/xrpc/com.atproto.space.${method}${query}`, {
        method: input === undefined ? "GET" : "POST",
        headers:
          input === undefined
            ? { Accept: "application/json" }
            : {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
        ...(input === undefined ? {} : { body: lexStringify(input) }),
      });
    } catch (cause) {
      if (cause instanceof MemoApiError) throw cause;
      if (cause instanceof TypeError) throw new NetworkError({ cause });
      throw cause;
    }
    let payload: unknown;
    try {
      const text = await response.text();
      payload = text ? lexParse(text) : {};
    } catch (cause) {
      if (response.status === 401) throw new NotAuthenticatedError({ cause });
      if (response.status === 403) throw new PermissionDeniedError({ cause });
      throw new SpaceRpcError(response.status, "InvalidResponse", { cause });
    }
    if (!response.ok) {
      const body =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {};
      const error = typeof body.error === "string" ? body.error : undefined;
      if (response.status === 401) throw new NotAuthenticatedError();
      if (response.status === 403) throw new PermissionDeniedError();
      if (error === "RecordNotFound" && params?.rkey)
        throw new MemoNotFoundError(String(params.rkey));
      throw new SpaceRpcError(response.status, error);
    }
    return payload;
  }

  return {
    async listRecords(
      params: SpaceRepo & {
        cursor?: string;
        limit?: number;
        excludeValues?: boolean;
      },
    ) {
      const result = object(
        await request("listRecords", { ...params, collection }),
      );
      if (
        !Array.isArray(result.records) ||
        (result.cursor !== undefined && typeof result.cursor !== "string")
      )
        throw new SpaceRpcError(200, "InvalidResponse");
      const records: SpaceRecordEntry[] = result.records.map((value) => {
        const record = object(value);
        if (record.collection !== collection)
          throw new SpaceRpcError(200, "InvalidResponse");
        return {
          collection,
          rkey: string(record.rkey),
          cid: string(record.cid),
          ...(record.value === undefined
            ? {}
            : { value: memo.$parse(record.value) }),
        };
      });
      return { records, cursor: result.cursor as string | undefined };
    },
    async getRecord(params: SpaceRecordKey): Promise<SpaceRecord> {
      const result = object(
        await request("getRecord", { ...params, collection }),
      );
      return { ...writeResult(result), value: memo.$parse(result.value) };
    },
    async createRecord(
      input: SpaceRepo & { rkey?: string; record: unknown },
    ): Promise<SpaceWriteResult> {
      const record = memo.$parse(input.record);
      return writeResult(
        await request("createRecord", undefined, {
          ...input,
          record,
          collection,
          validate: true,
        }),
      );
    },
    async putRecord(
      input: SpaceRecordKey & { record: unknown },
    ): Promise<SpaceWriteResult> {
      const record = memo.$parse(input.record);
      return writeResult(
        await request("putRecord", undefined, {
          ...input,
          record,
          collection,
          validate: true,
        }),
      );
    },
    async deleteRecord(input: SpaceRecordKey): Promise<void> {
      await request("deleteRecord", undefined, { ...input, collection });
    },
    async applyWrites(
      input: SpaceRepo & { writes: SpaceWrite[] },
    ): Promise<unknown> {
      const writes = input.writes.map((write) => {
        const { type, ...fields } = write;
        return {
          ...fields,
          collection,
          $type: `com.atproto.space.applyWrites#${type}`,
          ...(write.type === "delete"
            ? {}
            : { value: memo.$parse(write.value) }),
        };
      });
      return request("applyWrites", undefined, {
        space: input.space,
        repo: input.repo,
        writes,
        validate: true,
      });
    },
  };
}
