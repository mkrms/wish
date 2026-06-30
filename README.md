# Wish

SE 個人のための、シンプルで高UXなタスク管理デスクトップアプリ。
「Wish my Dreams ― 一日ひとつずつ強くなって夢を叶える」をコンセプトに、
**ゼロ摩擦の入力**・**完了の振り返り**・**俯瞰と成長の可視化**を軸にしている。

Claude Design のモックアップ（`project/Wish.dc.html`）を **Tauri 2 + React + TypeScript** で実装したもの。
ターゲットは Windows デスクトップ。データはローカルに永続化される。

---

## 技術スタック

| 層              | 採用                                            |
| --------------- | ----------------------------------------------- |
| デスクトップ殻  | [Tauri 2](https://tauri.app)（Rust）            |
| UI              | React 18 + TypeScript + Vite                    |
| 状態管理        | Zustand（`persist` で localStorage に永続化）   |
| フォント        | Roboto / Material Symbols（**ローカル同梱**）    |

CDN に依存せず、フォント・アイコンを同梱しているのでオフラインでも完全に動作する。

---

## セットアップ & 実行

前提: Node.js 18+ と Rust ツールチェーン。
さらに OS ごとの Tauri 依存（Windows なら [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)、
Linux なら `webkit2gtk` 等）が必要。詳細は [Tauri prerequisites](https://tauri.app/start/prerequisites/) を参照。

```bash
npm install

# デスクトップアプリとして開発起動（ホットリロード + Rust 殻）
npm run tauri dev

# Windows インストーラ（.msi / NSIS）をビルド
npm run tauri build

# UI だけブラウザで確認したいとき
npm run dev        # http://localhost:1420
```

---

## 機能

- **ゼロ摩擦の入力** — グローバルホットキー（既定 `Alt+Space`）でどの画面からでも呼び出し、
  コマンドパレットで自然言語入力。`明日15時 設計レビュー #ECサイト !高` を
  日付 / 時刻 / プロジェクト / 種別 / 優先度 に解析してチップ表示。
- **タスク / メモの2モード** — 同じパレットで会議メモを流し込み、「要対応」「〜する」等の行を
  自動でタスク候補化（`⌘Enter` で一括タスク化）。`⌘S` で単独メモとして保存。
- **タスクごとのメモ + サブタスク** — タスクをクリックすると右からサイドシートが開く。
- **ワンクリック日付編集** — 日付バッジ → クイックチップ + ミニカレンダー。
  背景クリックで未指定のまま閉じられる。
- **ダッシュボード（俯瞰と成長）** — 連続記録・14日ヒートマップ・種別内訳に加え、
  プロジェクトを **自分視点の4指標**（未対応 / 期限間近 / 直近2週の動き / 次の締切）で表示。
  進捗率やフェーズは「分母が信用できない／全工程を担当しない」ため意図的に出していない。
  停滞している案件には `🔍 棚卸し推奨` を出す。
- **プロジェクト管理** — サイドバーから名前＋カラーで追加。
- **設定** — ホットキー記録、週の開始曜日、デフォルトプロジェクト、通知トグル。
- **常駐** — システムトレイに常駐し、ウィンドウを閉じてもトレイに残る。

ナビ語彙はチャットの要望に合わせ「今日 / 受信トレイ / メモ / ダッシュボード / 完了済み / 設定」。

---

## ディレクトリ構成

```
src/
  main.tsx            エントリ
  App.tsx             レイアウト + アプリ内キーボードショートカット
  store.ts            Zustand ストア（全アクション + localStorage 永続化）
  types.ts            ドメイン型
  tauri.ts            Tauri 連携（グローバルホットキー購読、ブラウザでは no-op）
  lib/
    date.ts           日付ユーティリティ
    parse.ts          自然言語タスク解析 / メモ候補抽出
    display.ts        色・スタイルヘルパー
    seed.ts           初期サンプルデータ
  components/         各ビュー・オーバーレイ（Sidebar, ListView, DashboardView, …）
  assets/fonts/       同梱フォント（Roboto / Material Symbols）

src-tauri/
  src/lib.rs          グローバルホットキー・トレイ・常駐・単一起動
  tauri.conf.json     ウィンドウ / バンドル / CSP 設定
  capabilities/       権限定義

project/              元の Claude Design モックアップ（実装の出典）
chats/                デザイン確定までの会話ログ
```

実装は `project/Wish.dc.html` を出典としており、ロジック（自然言語解析・日付・候補抽出など）は
忠実に移植している。「今日」だけは固定値ではなく実時刻ベースにし、サンプルデータを相対日付で
生成することで、いつ開いてもデザイン通りに見えるようにしている。
