# atmemo client

React + TypeScript + Vite のメモUIです。

```sh
pnpm install
pnpm dev               # http://127.0.0.1:5173
pnpm storybook         # http://localhost:6006
pnpm build             # 型チェック + 本番ビルド
pnpm build-storybook   # Storybookの静的ビルド
pnpm test              # 暗号化・ページ送り・MarkdownのXSS対策テスト（Node.js 22.18以上）
```

1カラムの一覧と、自動スクロールページネーションを使用します。検索・ソート・手動ページ切り替えはありません。

## ログイン

AT Protocol OAuthに対応しています。通常のハンドル入力と、@passportのハンドル選択（FedCM／リダイレクト）を使えます。@passportの選択結果だけではログインせず、必ずOAuthを完了させます。

ログイン・セッション復元後は、暗号化パスワード入力ダイアログを表示します。メモの暗号化・復号に使うパスワードであることを明示し、`crypto.setPassword(password, DID)` が成功してからメモ画面を読み込みます。保存済みのパスワードがあっても、この画面への入場時には再入力します。Escapeまたは「ログアウト」はOAuthログアウトへ進みます。

開発中は `http://127.0.0.1:5173` を使用します。`localhost` で開くと、セッションの保存先を統一するため `127.0.0.1` に移動します。

本番公開先は `https://atmemo.afabl.fyi` に固定しています。通常のビルドで `dist/oauth-client-metadata.json` を生成します。このファイルをJSONとして公開し、`/oauth/callback` と `/atpassport/callback` はSPAの `index.html` を返すようホスティングを設定します。公開URLの環境変数は不要です。

ハンドル解決先は既定で `https://bsky.social` です。自分のPDS等を使う場合は `VITE_HANDLE_RESOLVER_URL` を設定してください。

@passportのFedCMを本番で使うには、[開発者ポータル](https://atpassport.net/developers/verify)で公開オリジンの検証が必要です。未対応のブラウザーやFedCMエラー時はリダイレクトに切り替わります。選択のキャンセル時はログインを開始しません。

OAuthのPKCE・DPoP・トークン更新・セッション保存は公式の `@atproto/oauth-client-browser` に任せています。@passportのコールバックでは同一オリジン・パス、使い捨てのstate、有効期限、ハンドルを検証します。

## API

`src/api/memos.ts` にAPIの型と `list`・`save`・`remove` 関数をまとめています。このファイルにはReact・UI・Storybookへの依存はありません。API接続処理はこのファイルに実装します。

`src/auth/session.ts` の認証済みLexicon `Client` を `client` としてインポートしており、メモAPI内で `space.*(...)` を使えます。認証付きfetchには `client.agent.fetchHandler(...)` を使います。ログイン前とログアウト・セッション失効後は `undefined` になり、API呼び出しを拒否します。認証状態はUIと共有されます。

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

`MemoSummary` は `id`, `updatedAt`, `createdAt`, `cid` を持ちます。日時は `Date` 型です。

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

通常起動は `src/api/memos.ts` の `list`・`save`・`remove` を呼びます。保存先は `at://{ログインユーザーのDID}/space/fyi.afabl.atmemo/self`、レコードのコレクションは `fyi.afabl.atmemo.memo` です。本文はPDSへ暗号化して保存し、サンプルデータや本文のlocalStorage保存は行いません。

`MemoRepository` のオプション `save` / `remove` を渡した場合だけ作成・編集・削除UIを表示します。新規保存は `{ body }`、更新は `{ id, body, createdAt, cid }` を渡します。`createdAt` は元の作成日時を維持し、削除には一覧の `id`・`cid` を渡します。保存ショートカットは Ctrl / ⌘ + Enter です。

## 暗号化

`src/crypto.ts` の `encrypt` / `decrypt` を使用します。APIの保存・読み込み処理から呼び出しており、パスワード入力UIはまだありません。

```ts
import { setPassword, encrypt, decrypt, clearPassword } from "./src/crypto";

setPassword("your password"); // localStorage の atmemo.encryptionPassword に保存
const encryptedContent = await encrypt("秘密のメモ"); // Uint8Array
const body = await decrypt(encryptedContent); // 秘密のメモ
clearPassword();

// 第2引数でパスワードを直接渡すことも可能（パスワードは保存しない）。
const bytes = await encrypt("秘密のメモ", "your password");
await decrypt(bytes, "your password");

// ユーザーごとにsaltを分ける場合はDIDを渡す。APIの保存処理はこの形式を使用する。
setPassword("your password", "did:plc:example");
await encrypt("秘密のメモ", undefined, "did:plc:example");
```

[hash-wasm](https://github.com/Daninet/hash-wasm) のArgon2id（メモリ64 MiB、反復3、並列度1）で256 bitの鍵を導出し、Web CryptoのAES-256-GCMで暗号化します。暗号化用の16 byteのsaltはランダム生成し、同じパスワードを使う間は再利用します。12 byteのIVは暗号化するたびにランダム生成します。返却値はバージョン1 byte・salt・IV・暗号文（16 byteの認証タグを含む）を連結した形式です。ヘッダーも認証対象に含めます。バージョン1の導出パラメーターは固定です。暗号文は本文のUTF-8表現より45 byte大きくなります。

暗号化用saltは `atmemo.encryptionSalt.<ユーザーID>` に16進数でlocalStorage保存し、再読み込み後も再利用します。ユーザーID省略時は `default` を使用します。`setPassword(password, userId)` で保存済みパスワードを変更した際は、そのユーザーのsaltを破棄して次の暗号化時に新しく生成します。同じパスワードの再設定ではsaltを維持します。パスワードを直接引数で渡す場合は保存済みsaltをそのまま使います。saltが未保存・破損している場合も新しく生成します。端末間でsaltの同期は行いませんが、saltは暗号文にも含まれるため、別端末やlocalStorage消去後も元のパスワードで復号できます。

導出済みの鍵はメモリ内でsaltごとに最大64件キャッシュし、上限を超えると最後の使用から最も時間が経った鍵を破棄します。同時に同じ鍵を要求した場合も導出処理を共有し、失敗した導出は再試行できます。`setPassword`・`clearPassword`、または引数で異なるパスワードを渡した際に鍵キャッシュを破棄します。`clearKeyCache()` で明示的に破棄することもできます。`clearPassword()` と `clearKeyCache()` は保存済みsaltを削除しません。鍵は永続保存せず、再読み込み時に再導出します。従来のメモごとにsaltが異なるデータも復号できます。

パスワード未設定・空パスワード・未対応の形式はエラーになり、誤ったパスワードや改ざんされたデータは復号に失敗します。保存したパスワードを変更しても既存データの再暗号化は行いません。既存データの復号には元のパスワードが必要です。localStorageのパスワードは平文保存です。Web Cryptoを使うため、HTTPSまたはlocalhostで実行してください。

## Spaces RPC

`src/api/space.ts` は `com.atproto.space.*` をOAuth認証付きfetchで呼び出します。通常の `fetch` にトークンを手動で付けるのではなく、OAuthセッションの `fetchHandler` に任せるため、DPoP・トークン更新・PDSの選択を維持します。`memos.ts` 内では `space.listRecords(...)`、`space.getRecord(...)`、`space.createRecord(...)`、`space.putRecord(...)`、`space.deleteRecord(...)`、`space.applyWrites(...)` を使用できます。各呼び出しに `space` と `repo` を渡します。

RPCスキーマを安定版Lexに読み込ませず、`lexicons.json` は `fyi.afabl.atmemo.memo` のレコード定義だけを管理します。レコードは送信前・受信後にLexで検証し、暗号文のバイト列はAT Protocolの `$bytes` 形式で変換します。SDKは安定版の `@atproto/lex@0.4.8` を使用します。

```sh
pnpm exec lex install --ci
pnpm exec lex build --include fyi.afabl.atmemo.memo --override
```

RPCの型は[公式permissioned-dataブランチのスキーマ](https://github.com/bluesky-social/atproto/tree/16bfeba760aede46f0b87bf94febef9e6ea84b95/lexicons/com/atproto/space)に基づきます。

OAuthは `fyi.afabl.atmemo` の `self` Spaceに対して、自分のレコードの読み取りとメモの作成・更新・削除を要求します。保存先SpaceはPDS側で用意されている必要があります。

`save` は `crypto.ts` の `encrypt()` で暗号化してから `putRecord` を呼びます。新規IDは公式の `TID.nextStr()` で生成し、更新では既存のIDと作成日時を維持します。`remove` は `deleteRecord`、`list` は `listRecords` を使用します。

`list` はDate型の日時とCIDを返し、各アイテムの `getContent()` が `crypto.ts` の `decrypt()` を呼びます。通常は一覧に含まれる暗号文を利用し、PDSが値を省略した場合だけ `getRecord` で補完します。暗号化パスワードは既存の `crypto.setPassword()` で設定する仕組みを利用します。

このSpacesスキーマのput/deleteには `swapCommit`・`swapRecord` がないため送信しません。保存・削除の `cid` 引数は互換性のため維持していますが、現在は原子的な上書き防止には使っていません。

## APIエラー

`src/api/errors.ts` にエラー型を定義しています。`instanceof` または共通の `code` で判別できます。すべて `MemoApiError` を継承し、`ErrorOptions.cause` で元のエラーを保持できます。

| 型                    | code              | 用途                           |
| --------------------- | ----------------- | ------------------------------ |
| NotAuthenticatedError | NOT_AUTHENTICATED | 未ログイン・認証セッションなし |
| CidMismatchError      | CID_MISMATCH      | 更新・削除時のCID不一致        |
| MemoNotFoundError     | NOT_FOUND         | 対象メモなし                   |
| PermissionDeniedError | PERMISSION_DENIED | 操作権限なし                   |
| NetworkError          | NETWORK_ERROR     | 通信失敗                       |
| DecryptionError       | DECRYPTION_FAILED | 復号失敗                       |

`CidMismatchError` は `{ id, expectedCid, actualCid? }`、`MemoNotFoundError` は対象の `id` を保持します。

未ログイン時の `list`・`save`・`remove` では `NotAuthenticatedError` を使用しています。Spaces RPCラッパーでは401・403・RecordNotFound・通信失敗も該当するエラー型に変換します。その他は実API・暗号化処理の実装時に使用する定義です。

## Markdown

`react-markdown` と `remark-gfm` でMarkdown・表・タスクリスト・取り消し線などを表示します。本文と編集時のプレビューは同じコンポーネントを使用します。

HTMLは `rehype-raw` で解析し、最後に `rehype-sanitize` のデフォルト許可リストでサニタイズします。スクリプト、イベント属性、危険なURL、iframe、SVG、インラインスタイルなどは許可しません。`react-markdown` の標準URL変換も維持しています。ID/nameの衝突対策もデフォルト設定を維持します。サニタイズ後にHTMLを加工するプラグインや、`dangerouslySetInnerHTML` は使用しません。

## Storybook

デモデータと操作用のインメモリ実装は `.storybook/fixtures/memos.ts` に限定しています。通常アプリからはインポートしません。

`Pages/MemoApp` には空・読み込み・一覧エラー・本文エラー・閲覧専用・モバイル・空本文・複数ページの各状態を用意しています。`CreateEditDelete`、`Pagination`、`PageError` に操作シナリオがあります。

`Components/EncryptionPasswordDialog` には初期表示・入力送信・保存失敗・処理中・ログアウト・Escapeの各ストーリーがあります。Storybookでは実際のパスワード保存は行いません。

`Components/LoginForm` には通常・エラー・ハンドル送信・@passport操作のストーリーがあります。実際の認証通信はStorybookでは開始しません。

`Components/MemoBody` ではMarkdown、GFM、HTMLとXSSを想定した入力を確認できます。`Components/MemoComposer` には編集・プレビュー・保存中・保存失敗の状態があります。
