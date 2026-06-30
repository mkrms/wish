# 機能外仕様: 配布・ビルド（distribution）

Wish の公開・配布とビルドに関する方針。対象は **P3（配布・公開）**。判断の経緯は decisions-log D-003 / D-004。

## 配布先
- **GitHub Releases**（`mkrms/wish`）に Windows インストーラ（`.msi` / NSIS `.exe`）を配布する。
- Microsoft Store（MSIX）は将来の選択肢として保留（現時点では対象外）。

## ビルド要件（完全版）
当面は UI（ブラウザ）確認のみで進め、ネイティブ完全版ビルドは P2 以降で行う（decisions-log D-003）。
完全版ビルドには次が必要:

- **Node.js 18+**（導入済み: v22.18.0 / npm 10.9.3）
- **Rust ツールチェーン**（rustup / cargo）— **未導入**
- **MSVC C++ ビルドツール**（VS 2022 の「C++ によるデスクトップ開発」ワークロード = MSVC toolset / リンカ / Windows SDK）— **未導入**（VS Community 本体はあり）
- **Microsoft Edge WebView2 ランタイム**（導入済み）

## ビルド手順
```bash
npm install
npm run tauri build   # .msi / NSIS を生成（src-tauri/tauri.conf.json のバンドル設定に従う）
```
- バンドル / ウィンドウ / CSP 設定は `src-tauri/tauri.conf.json`、権限は `src-tauri/capabilities/` を参照。

## リリース運用（P3 で確定予定・未決）
- バージョニング（`package.json` / `Cargo.toml` / `tauri.conf.json` のバージョン整合の取り方）
- 署名（コード署名証明書の有無）
- Releases へのアップロードを手動にするか CI 化するか

> 上記「未決」項目は P3 着手時に designer がまとめて提示し、承認の上でこの仕様に追記する。
