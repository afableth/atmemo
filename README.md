# AtMemo
メモ・ Todo など機微な情報を e2ee で atprotocol 上で保管する。

## 操作フロー
1. Atprotocol account に OAuth でログインする。
2. ユーザーのみが知る e2ee password を入力する。
3. メモ一覧が表示される。

## 暗号方式
### argon2id
E2EE password を、 AES-GCM の共通鍵に変更する。

### AES
メモを共通鍵で暗号化・復号する。

## このプロジェクトについて
この AtMemo は、 2026-11-14 に開催された Bluesky Hackathon in Tokyo vol.2 で作成されたものです。

