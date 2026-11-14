export interface MemoSummary {
  id: string;
  updatedAt: string;
  createdAt: string;
  hash: string;
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

export interface MemoRepository extends MemoReader {
  save?(input: {
    id?: string;
    body: string;
    hash?: string;
  }): Promise<MemoSummary>;
  remove?(id: string, hash: string): Promise<void>;
}

// API接続処理を実装する。
export async function list(_cursor?: string): Promise<MemoPage> {
  return { items: [] };
}
