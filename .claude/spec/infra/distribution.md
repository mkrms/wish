# 機能外仕様: 配布・ビルド（distribution）

Wish の公開・配布とビルドに関する方針。対象は **P3（配布・公開）**。判断の経緯は decisions-log D-003 / D-004 / **D-010**。

> **ビルド経路は CI に確定**: `.msi` / NSIS の生成と Releases 配布は GitHub Actions（`tauri-apps/tauri-action`, `windows-latest`）で行う（D-010）。ローカルビルドは Rust/MSVC 導入時のオプション扱い（D-003）。

## 配布先
- **GitHub Releases**（`mkrms/wish`）に Windows インストーラ（`.msi` / NSIS `.exe`）を配布する。
- Microsoft Store（MSIX）は将来の選択肢として保留（現時点では対象外）。

## ビルド経路: GitHub Actions（本命）
- **生成コマンドは `npm run tauri build`**（`src-tauri/tauri.conf.json` の `bundle.targets = ["nsis","msi"]` に従い `.msi` / NSIS `.exe` を生成）だが、**実行は CI（`windows-latest` ランナー）が担う**。ローカルに Rust/MSVC を導入せずに配布物を得る（D-003 / D-010）。
- ワークフロー定義は **`.github/workflows/release.yml`**（別途管理。本仕様では「こう動く」前提で参照のみ。内容は二重に持たない）。
- ワークフローの想定挙動:

  | トリガ | 動作 | 成果物の置き場所 |
  |---|---|---|
  | タグ push `v*`（例 `v0.1.0`） | `tauri-action` がビルドし、GitHub Releases に**ドラフトリリース**を作成。`.msi` / NSIS をアセット添付 | Releases（draft） |
  | 手動 `workflow_dispatch` | ビルドのみ行い、installer を**ワークフローの artifact** として出力（リリースは作らない） | Actions の Artifacts |

- `workflow_dispatch` は「リリース前にビルドが通るか・installer が起動するか」を試すための経路。タグ push は「実際にリリースを切る」経路。
- CI を動かすには `develop`（およびタグ）を origin（`git@github.com:mkrms/wish.git`）へ push する必要がある（push 可は承認済み・D-010）。

## ローカルビルド（オプション / Rust・MSVC 導入時のみ）
当面は不要。Rust ツールチェーンと MSVC C++ ビルドツールを導入した場合にのみ、手元で同じ成果物を生成できる。
```bash
npm install
npm run tauri build   # .msi / NSIS を生成（CI と同じコマンド）
```
ローカル完全版ビルドに必要なもの:

- **Node.js 18+**（導入済み: v22.18.0 / npm 10.9.3）
- **Microsoft Edge WebView2 ランタイム**（導入済み）
- **Rust ツールチェーン**（rustup / cargo）— **未導入**（CI 経路では不要）
- **MSVC C++ ビルドツール**（VS 2022「C++ によるデスクトップ開発」ワークロード = MSVC toolset / リンカ / Windows SDK）— **未導入**（CI 経路では不要）

> バンドル / ウィンドウ / CSP 設定は `src-tauri/tauri.conf.json`、権限は `src-tauri/capabilities/default.json` を参照。

## バージョニング
インストーラのバージョンは **3 ファイルを手で揃える**運用とする（いずれも現状 `0.1.0`）。

| ファイル | フィールド | 役割 |
|---|---|---|
| `package.json` | `version` | npm パッケージ / フロント側のバージョン |
| `src-tauri/Cargo.toml` | `[package].version` | Rust クレートのバージョン |
| `src-tauri/tauri.conf.json` | `version` | バンドル（installer / 製品）のバージョン |

ルール:
- 3 ファイルは**常に同一の値**にする（例: すべて `0.2.0`）。
- リリースタグは **`vX.Y.Z`**（`v` プレフィックス付き）とし、3 ファイルのバージョンと**数字部分を一致させる**（タグ `v0.2.0` ⇔ version `0.2.0`）。
- バージョンを上げないまま同名タグを再 push しない（Releases / installer の取り違えを防ぐ）。SemVer に従い、機能追加は minor、修正は patch を上げる。

## 署名（コード署名）
- **当面コード署名なし**で配布する（証明書未取得）。
- 影響: 未署名 installer は初回実行時に **Windows SmartScreen の警告**（「WindowsによってPCが保護されました」）が出る。利用者は「詳細情報」→「実行」で起動できる。配布ページ（Release ノート）にこの旨と回避手順を明記する。
- 将来の選択肢（**未決**）: コード署名証明書（OV / EV）の導入で警告を解消できる。EV はハードウェアトークン必須でコスト高、OV は安価だが SmartScreen の信用蓄積に時間がかかる。導入可否は別途検討（「未決事項」参照）。

## リリース手順（チェックリスト）
1. **バージョンを 3 ファイルで更新**（`package.json` / `src-tauri/Cargo.toml` / `src-tauri/tauri.conf.json` を同一値に）。
2. **（推奨）`workflow_dispatch` で事前ビルド確認**: 手動実行で installer が artifact 出力されるところまで通すと、タグ前にビルド失敗を潰せる。
3. 変更を**コミット**（バージョン更新コミット）。
4. **タグ付け & push**: `git tag vX.Y.Z` → `git push origin vX.Y.Z`（`develop` 本体も push しておく）。
5. CI が**ビルド → ドラフトリリース作成**（`.msi` / NSIS ＋ updater 用の `*.sig` / `latest.json` をアセット添付）。
6. **生成 installer で実機検証**（手順は `spec/infra/tauri-shell-verification.md`）。ホットキー・トレイ・単一起動・×でトレイ退避・永続化を確認。
7. 検証 OK なら Release ノート（変更点 + SmartScreen 回避手順）を記入し、**ドラフトを publish**。NG なら publish せず修正 → 2 へ戻る。

> P2 の実機検証（5 と 6 の間）は CI では代替できない。CI が生成した installer をユーザーが実機で起動して確認する（D-010）。チェックリストは `spec/infra/tauri-shell-verification.md`。

## 自動更新（updater）
**導入済み（D-030）**。アプリ内から更新を検知・インストールできる。仕様は **`auto-update.md`** を参照（本仕様では二重に持たない）。配布フローへの影響は次の 2 点のみ:

- CI が `.msi` / NSIS に加えて **`*-setup.exe.sig` と `latest.json`** を Release へ添付する（`includeUpdaterJson: true`）。
- アプリは **publish 済みの最新リリース**だけを見る（`releases/latest/download/latest.json`）。**draft のままでは誰にも配信されない**＝下記チェックリストの 7 が更新配信のトリガーになる。

## 未決事項（まとめて提示）
- **コード署名**: 証明書（OV/EV）を導入して SmartScreen 警告を解消するか、当面未署名のままとするか。導入する場合は `tauri-action` の署名設定（証明書を CI Secrets に配置）と運用が必要。updater の minisign 署名とは別物で、updater を入れても SmartScreen 警告は消えない。
- **タグ運用の自動化**: バージョン 3 ファイルの整合を CI でチェック（不一致ならタグ push 時に fail）するか、手運用のままにするか。
