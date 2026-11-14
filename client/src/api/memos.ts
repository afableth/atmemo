import { client } from "../auth/session";
import { NotAuthenticatedError } from "./errors";
import { createSpaceApi } from "./space";
import { createMemoRepository } from "./memo-repository";
import { ensureSpace, memoSpaceUri } from "./ensure-space";

export async function ensureMemoSpace(): Promise<void> {
  const activeClient = client;
  if (!activeClient) throw new NotAuthenticatedError();
  const api = createSpaceApi((path, init) => {
    if (client !== activeClient) throw new NotAuthenticatedError();
    return activeClient.agent.fetchHandler(path, init ?? {});
  });
  await ensureSpace(api, activeClient.assertDid);
  if (client !== activeClient) throw new NotAuthenticatedError();
}

export const space = createSpaceApi((path, init) => {
  if (!client) throw new NotAuthenticatedError();
  return client.agent.fetchHandler(path, init ?? {});
});

export interface MemoSummary {
  id: string;
  updatedAt: Date;
  createdAt: Date;
  cid: string;
}

export interface Memo extends MemoSummary {
  getContent(): Promise<string>;
}

export interface MemoPage {
  items: Memo[];
  nextCursor?: string;
}

export interface MemoReader {
  list(cursor?: string): Promise<MemoPage>;
}

export type SaveMemoInput =
  | {
      id: string;
      body: string;
      createdAt: Date;
      cid: string;
    }
  | {
      body: string;
    };

export interface MemoRepository extends MemoReader {
  save?(input: SaveMemoInput): Promise<void>;
  remove?(id: string, cid: string): Promise<void>;
}

const repository = createMemoRepository(() => {
  if (!client) throw new NotAuthenticatedError();
  const repo = client.assertDid;
  return {
    repo,
    space: memoSpaceUri(repo),
    api: space,
  };
});

export async function list(cursor?: string): Promise<MemoPage> {
  return repository.list(cursor);
}

export async function save(input: SaveMemoInput): Promise<void> {
  await repository.save(input);
}

export async function remove(id: string, cid: string): Promise<void> {
  await repository.remove(id, cid);
}
