# atmemo client

React + TypeScript + Vite のメモUIです。

```sh
pnpm install
pnpm dev               # http://localhost:5173
pnpm storybook         # http://localhost:6006
pnpm build             # 型チェック + 本番ビルド
pnpm build-storybook   # Storybookの静的ビルド
pnpm test              # ページ送り・MarkdownのXSS対策テスト（Node.js 22.18以上）
```

1カラムの一覧と、自動スクロールページネーションを使用します。検索・ソート・手動ページ切り替えはありません。

## API

`src/api/memos.ts` にAPIの型と `list` 関数をまとめています。このファイルにはReact・UI・Storybookへの依存はありません。API接続処理はこのファイルに実装します。

ページ送りの制御は `src/data/memoPager.ts`、画面の状態管理は `src/hooks/useMemoFeed.ts` に分離しています。

```ts
interface Memo extends MemoSummary {
  getContent(): Promise<string>;
}
interface MemoPage {
  items: Memo[];
  nextCursor?: string;
}
interface MemoReader {
  list(cursor?: string): Promise<MemoPage>;
}
```

`MemoSummary` は `id`, `updatedAt`, `createdAt`, `hash` を持ちます。日時はISO 8601です。

最初は引数なしで `list()` を呼び、次ページがある場合は返された `nextCursor` を次の `list(cursor)` に渡します。最終ページでは `nextCursor` を省略します。画面末尾に近づくと次ページを取得し、APIの返却順のまま表示します。追加取得に失敗した場合も表示済みのメモを残し、同じカーソルで再試行します。

各メモが画面に近づいたときに、そのメモの `getContent()` を呼び、返された文字列をMarkdownとして表示します。本文取得用の独立した `get` APIはありません。API実装側で `getContent` のクロージャに取得処理を渡してください。

```tsx
const repository: MemoReader = {
  async list(cursor) {
    // 実APIからメタデータと次ページのカーソルを取得し、
    // 各アイテムに getContent: async () => string を設定する。
    return { items: [] };
  },
};
<MemoApp repository={repository} />;
```

通常起動は `src/api/memos.ts` の `list` 関数を呼びます。現在はAPI接続処理が空のため、一覧も空です。データの生成やlocalStorageへの保存はしません。

`MemoRepository` のオプション `save` / `remove` を渡した場合だけ作成・編集・削除UIを表示します。更新・削除には一覧の `hash` を渡します。保存ショートカットは Ctrl / ⌘ + Enter です。

## Markdown

`react-markdown` と `remark-gfm` でMarkdown・表・タスクリスト・取り消し線などを表示します。本文と編集時のプレビューは同じコンポーネントを使用します。

HTMLは `rehype-raw` で解析し、最後に `rehype-sanitize` のデフォルト許可リストでサニタイズします。スクリプト、イベント属性、危険なURL、iframe、SVG、インラインスタイルなどは許可しません。`react-markdown` の標準URL変換も維持しています。ID/nameの衝突対策もデフォルト設定を維持します。サニタイズ後にHTMLを加工するプラグインや、`dangerouslySetInnerHTML` は使用しません。

## Storybook

デモデータと操作用のインメモリ実装は `.storybook/fixtures/memos.ts` に限定しています。通常アプリからはインポートしません。

`Pages/MemoApp` には空・読み込み・一覧エラー・本文エラー・閲覧専用・モバイル・空本文・複数ページの各状態を用意しています。`CreateEditDelete`、`Pagination`、`PageError` に操作シナリオがあります。

`Components/MemoBody` ではMarkdown、GFM、HTMLとXSSを想定した入力を確認できます。`Components/MemoComposer` には編集・プレビュー・保存中・保存失敗の状態があります。
