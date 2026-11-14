import type { MemoRepository } from "../../src/api/memos";

const sampleMemos = [
  {
    body: "頭の中にあることを、少しずつ書き出してみる。\nきれいにまとめなくても大丈夫。小さな気づきも、いつかの自分へのヒントになる。\n\n#日々のこと #アイデア",
  },
  {
    body: "- [ ] 気になっていた喫茶店に行く\n- [ ] 積んでいた本を一冊読む\n- [x] 部屋に新しい花を飾る\n\n予定を詰めすぎず、余白も大切に。\n\n#暮らし",
  },
  {
    body: "道具はシンプルなほど、長く使える気がする。\n\n**大切にしたいこと**\n- 開いたら、すぐに書ける\n- 自分の言葉を、あとから見つけられる\n- 書くことに集中できる\n\n#アイデア #ものづくり",
  },
  {
    body: "「何をするか」と同じくらい、「何をしないか」を決めること。\n\n立ち止まって考える時間も、前に進むための時間なのかもしれない。\n\n#読書 #日々のこと",
  },
  {
    body: "いつもの道を少し遠回り。\nイチョウがすっかり黄色になっていて、季節が進んでいることに気づいた。\n\n帰り道のコーヒーがおいしかった。\n\n#暮らし #日々のこと",
  },
];

/** Storybookの各ストーリー内だけで使う、永続化しないデモデータ。 */
export function createStoryRepository({
  pageSize = 3,
  repeat = 1,
} = {}): MemoRepository {
  const samples = Array.from({ length: repeat }, () =>
    sampleMemos.map((memo) => ({
      ...memo,
    })),
  ).flat();
  let nextId = samples.length;
  let revision = samples.length;
  let memos = samples.map((memo, index) => ({
    ...memo,
    id: String(index + 1),
    hash: String(index + 1),
    createdAt: new Date(Date.UTC(2026, 10, 14 - index, 9)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 10, 14 - index, 9)).toISOString(),
  }));
  return {
    async list(cursor) {
      const start = cursor ? Number(cursor) : 0;
      const items = memos
        .slice(start, start + pageSize)
        .map(({ body, ...summary }) => ({
          ...summary,
          getContent: async () => body,
        }));
      return {
        items,
        nextCursor:
          start + pageSize < memos.length
            ? String(start + pageSize)
            : undefined,
      };
    },
    async save(input) {
      const previous = memos.find((memo) => memo.id === input.id);
      const now = new Date().toISOString();
      const memo = {
        id: input.id ?? String(++nextId),
        body: input.body,
        hash: String(++revision),
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
      memos = [memo, ...memos.filter((item) => item.id !== memo.id)];
      const { body: _body, ...summary } = memo;
      return summary;
    },
    async remove(id) {
      memos = memos.filter((memo) => memo.id !== id);
    },
  };
}
