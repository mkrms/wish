# 機能外仕様: 自動更新（auto-update）

Wish をアプリ内から更新できるようにする（Tauri 2 updater プラグイン）。
`distribution.md` の「未決事項 → 自動更新（updater）」を解決する仕様。判断の経緯は decisions-log **D-030**。

> **前提**: 配布先は GitHub Releases（`mkrms/wish`）、ビルドは GitHub Actions（D-004 / D-010）。本仕様はその経路の上に updater を載せる。

---

## 1. 目的と方針

| | |
|---|---|
| **目的** | 新バージョンの検知・ダウンロード・インストール・再起動を**アプリ内で完結**させ、「Releases を開いて installer を落として実行する」手作業をなくす。 |
| **配信元** | GitHub Releases の **publish 済み** 最新リリースに添付された `latest.json` |
| **更新の起点** | ①起動時の自動チェック（既定 ON・設定で OFF 可） ②設定画面の「更新を確認」ボタン（手動） |
| **インストールの実行** | **必ずユーザーの明示的な承諾後**。黙って落として黙って入れることはしない。 |
| **対象バンドル** | **NSIS（`.exe`）のみ**を更新経路にする。`.msi` は手動ダウンロード用に残す。 |

### 非目標（今回スコープ外）
- コード署名（Authenticode）による SmartScreen 警告の解消 … 別課題（`distribution.md` の未決事項に残す）
- バックグラウンドでの自動サイレント更新（承諾なしのインストール）
- ロールバック・チャネル分け（stable/beta）・差分更新

---

## 2. 全体の流れ

```
[リリース側]  タグ push → CI ビルド → 秘密鍵で署名
                → Release に  wish_0.3.0_x64-setup.exe
                              wish_0.3.0_x64-setup.exe.sig
                              latest.json            を添付（draft）
                → 実機検証 → publish

[アプリ側]    起動 or 「更新を確認」
                → GET https://github.com/mkrms/wish/releases/latest/download/latest.json
                → version を現在バージョンと比較
                → 新しければ「v0.3.0 が利用できます」を提示
                → ユーザーが「今すぐ更新」
                → .exe をダウンロード（進捗%）→ 公開鍵で .sig を検証
                → NSIS を passive モードで実行 → アプリ再起動
```

**署名は minisign 鍵ペア**（Tauri updater 専用）で、Authenticode（コード署名証明書）とは別物。
- **秘密鍵** … GitHub Secrets に置き、CI が更新アーティファクトへの署名に使う。**ローカルにもバックアップを保管**（失うと既存ユーザーへ更新を配信できなくなる）。
- **公開鍵** … `tauri.conf.json` に平文で埋め込む（アプリに焼き込まれる）。

---

## 3. 設定・実装項目

### 3.1 鍵の生成（一度きり）

```bash
npx tauri signer generate -w src-tauri/.tauri/wish.key
```
- Rust ツールチェーンは不要（`@tauri-apps/cli` に同梱のバイナリで実行できる）。
- パスフレーズを設定する。
- 生成物: `wish.key`（秘密鍵）/ `wish.key.pub`（公開鍵）
- **`src-tauri/.tauri/` は `.gitignore` に追加**し、秘密鍵は絶対にコミットしない。
- GitHub Secrets へ登録:

  | Secret 名 | 値 |
  |---|---|
  | `TAURI_SIGNING_PRIVATE_KEY` | `wish.key` の中身（1 行のテキスト） |
  | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 生成時に設定したパスフレーズ |

### 3.2 `src-tauri/Cargo.toml`

```toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```
`process` は更新後の再起動（`relaunch()`）に使う。

### 3.3 `src-tauri/src/lib.rs`

```rust
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```
既存の plugin 登録に並べる（既存方針どおり `unwrap`/`expect` を増やさない）。

### 3.4 `src-tauri/tauri.conf.json`

```json
"bundle": {
  "createUpdaterArtifacts": true,      // ← .sig と latest.json 生成に必須
  ...
},
"plugins": {
  "updater": {
    "pubkey": "<wish.key.pub の中身>",
    "endpoints": [
      "https://github.com/mkrms/wish/releases/latest/download/latest.json"
    ],
    "windows": { "installMode": "passive" }
  }
}
```
- `installMode: "passive"` … インストール進捗バーだけ出て操作不要。`quiet` は NSIS で不具合報告があるため採らない。
- `endpoints` は `latest/download` を使うため、**publish 済みリリースのみ**が拾われる（draft 中は配信されない ＝ 現行の「draft → 実機検証 → publish」フローと整合する）。

### 3.5 `src-tauri/capabilities/default.json`

```json
"updater:default",
"process:allow-restart"
```
を `permissions` に追加。

### 3.6 `.github/workflows/release.yml`

`tauri-action` ステップに以下を追加:
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
with:
  includeUpdaterJson: true
```
タグ push 時のみ `latest.json` が Release へ添付される（`workflow_dispatch` は従来どおり artifact 出力のみ）。

### 3.7 フロントエンド

依存追加: `@tauri-apps/plugin-updater` / `@tauri-apps/plugin-process`

新規 `src/lib/update.ts`（純粋寄りの薄いラッパ。ブラウザでは no-op）:

| API | 役割 |
|---|---|
| `checkUpdate(): Promise<UpdateInfo \| null>` | 更新の有無を返す（`{ version, notes, date }`）。Tauri 非環境／通信失敗時は `null` |
| — | **`check({ target: "windows-x86_64-nsis" })` と target を明示する**（下記） |
| `installUpdate(onProgress): Promise<void>` | ダウンロード＋インストール＋`relaunch()` |
| `currentVersion(): Promise<string>` | `@tauri-apps/api/app` の `getVersion()`。ブラウザでは `package.json` 相当の定数 |

**通信失敗は握って無視する**（オフライン前提のアプリなので、更新チェックの失敗でユーザーを煩わせない）。手動チェック時のみ「確認できませんでした」を表示する。

> **⚠️ target の明示は必須**（v0.3.0 のドラフト検証で判明）。`tauri-action` が生成する `latest.json` は
> `windows-x86_64`(=**MSI**) / `windows-x86_64-msi` / `windows-x86_64-nsis` の 3 キーを持つ。
> updater は target 未指定だと既定キー `windows-x86_64` を引くため、**放置すると MSI が配信される**。
> Wish の更新経路は NSIS（`installMode: passive` も NSIS 前提）なので、
> `check({ target: "windows-x86_64-nsis" })` と明示する。外すと NSIS で入れた環境に MSI の更新が降り、
> 別製品として二重インストールされうる。

### 3.8 UI（`SettingsView` にカード追加）

```
┌─ アップデート ───────────────────────┐
│ 現在のバージョン              0.2.0  │
├──────────────────────────────────────┤
│ 起動時に更新を確認             [ ON ]│
├──────────────────────────────────────┤
│ 更新の確認                 [ 確認 ]  │
│   └ 状態表示（下記）                 │
└──────────────────────────────────────┘
```

状態遷移（同カード内の 1 行で表現）:

| 状態 | 表示 | 操作 |
|---|---|---|
| idle | （なし） | 「更新を確認」 |
| checking | 「確認中…」 | ボタン disabled |
| latest | 「最新版です」 | 「更新を確認」 |
| available | 「v0.3.0 が利用できます」 | **「今すぐ更新」** |
| downloading | 「ダウンロード中… 42%」 | ボタン disabled |
| installing | 「インストール中…（自動で再起動します）」 | ボタン disabled |
| error | 「更新を確認できませんでした」 | 「更新を確認」（再試行） |

- 状態は `SettingsView` のローカル state。永続化しない。
- 起動時の自動チェックで更新が見つかった場合は、**既存の `Toast` で「v0.3.0 が利用できます — 設定から更新できます」** を出すだけに留める（作業を中断させない）。押下で設定画面へ遷移。
- Tauri 非環境（ブラウザ）ではカード自体を非表示にする。

### 3.9 ストア（`src/store.ts` / `types.ts`）

`Settings` に `autoUpdateCheck: boolean`（既定 `true`）を追加。`seed` と `migrate` に既定値の補完を入れる（D-029 と同じ要領）。トグルは `toggleAutoUpdateCheck()`。

---

## 4. バージョニングとの関係

`distribution.md` の 3 ファイル同値ルール（`package.json` / `Cargo.toml` / `tauri.conf.json`）はそのまま。updater は **`tauri.conf.json` の `version` と `latest.json` の `version` を比較**するため、3 ファイルの不一致は更新の取り違えに直結する。手順は `distribution.md` のリリースチェックリストに従う。

---

## 5. 移行（初回だけ手動インストールが必要）

現行 v0.2.0 には updater が入っていないため、**updater を載せた最初の版（v0.3.0 想定）は一度だけ手動でインストールする必要がある**。それ以降は v0.3.0 → v0.4.0 … がアプリ内更新で完結する。Release ノートにその旨を記載する。

---

## 6. 受け入れ条件

1. `npm run build` / `tsc` が通り、ブラウザ（`npm run dev`）では設定にアップデートカードが出ず、コンソールエラーも出ない。
2. タグ push の CI で、Release に `*-setup.exe` / `*-setup.exe.sig` / `latest.json` の 3 点が添付される。
3. publish 済みの新バージョンがあるとき、旧版アプリの「更新を確認」で「vX.Y.Z が利用できます」が出る。
4. 「今すぐ更新」で進捗が進み、インストール後にアプリが自動再起動し、バージョン表示が新しくなる。
5. 最新版のとき「最新版です」、オフライン時に「更新を確認できませんでした」が出て、アプリはクラッシュしない。
6. 起動時チェックを OFF にすると、起動時にトーストが出ない。

> 3〜5 は CI が生成した installer での実機検証項目。手順は `spec/infra/tauri-shell-verification.md` に追記する。

---

## 7. リスク・注意点

| 項目 | 内容 |
|---|---|
| **秘密鍵の紛失** | 公開鍵がアプリに焼き込まれるため、鍵を失うと既存ユーザーへ更新を配信できない（＝全員に再インストールを強いる）。GitHub Secrets とローカル退避の**二重保管**が必須。 |
| **未署名（Authenticode なし）** | updater を入れても SmartScreen 警告は消えない。ただし更新は passive 実行のため初回インストールほど目立たない。UAC は NSIS の `currentUser` インストールなら出ない。 |
| **draft 中は配信されない** | 意図的な挙動。publish を忘れると誰にも届かない。 |
| **`latest.json` の書式** | `tauri-action` が生成する。手で書かない。 |
