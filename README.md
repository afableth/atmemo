---
theme: default
class: invert
---

# AtMemo
@afabl.fyi
@tomo-x.win

---

# アプリ概要
メモ・ Todo など機微な情報を e2ee で atprotocol 上で保管する。

---

# 操作フロー
1. Atprotocol account に OAuth でログインする。
2. ユーザーのみが知る e2ee password を入力する。
3. メモ一覧が表示される。

---

# 暗号
## argon2id
E2EE password を、 AES-GCM の共通鍵に変更する。

## AES
メモを共通鍵で暗号化・復号する。

---

# 構成
client と PDS のみ。本当は検索用に AppView を足したい。
- At Protocol
- React
- argon2id
- AES

---

# なぜ At Protocol がいいのか
- セルホストせずに情報の所有権を持てる。
- これまで散らばっていた CalDAV, CardDAV, KeePass などを集約できる。
- やりたければ体験を犠牲にせずにセルフホストができる。

---

# Demo

---

# 将来性
## 情報の追加
他にも個人的な機微な情報はたくさんある。
- Todo
  これはメモの中に書き込んで、集約できるようにしたほうがよさげ。
- カレンダー
- 連絡先
- Password manager
  Bitwarden の方式を真似すれば、ある程度安全性は担保できそう。
- CouchDB Bridge
  これがあれば、多くの同期機能と互換性を確保できる。

---

## プライバシー向上
タイトルを同型暗号化して、E2EE を保ったまま Appview にを通して検索したい。

---

# ありがとうございました
