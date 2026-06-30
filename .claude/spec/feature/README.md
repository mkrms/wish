# 機能仕様（feature specs）

本ディレクトリは、Wish の**機能面の仕様**を機能単位で分割して保存する。スコープの全体像と
フェーズ付与は `.claude/docs/wish-inventory.md`（棚卸）を参照。

実装は既にほぼ完成しているため、ここに起こす仕様は主に「変更・拡張する機能」の定義になる
（例: ダッシュボードを seed 固定値から実データ集計へ）。出典挙動の正は `project/Wish.dc.html`。

## 機能仕様一覧

| ファイル | 範囲 |
|---|---|
| [`dashboard.md`](dashboard.md) | ダッシュボードの実データ化（streak / 14日完了数・前期間比 / ヒートマップ / 種別内訳 / プロジェクト流量・棚卸し推奨を `tasks` から集計。`src/lib/metrics.ts` 新設）。D-005/006/007 準拠。※ 種別内訳は `raycast-redesign.md` #6 で廃止予定 |
| [`raycast-redesign.md`](raycast-redesign.md) | RayCast 風オーバーレイ再設計（案A: ホットキー＝軽量パレット専用 / フルUIはトレイ・コマンド経由）。seed 全消し・メモ2ペイン・タスク即削除・2ウィンドウ構成・候補機能/種別タグ/サブタスク廃止・プロジェクト rename・autostart・診断コード除去・`type`/`sub` の migrate。P1（型刈り込み・UX）＋P2（2ウィンドウ・Tauri） |

## 記法ルール

- 各仕様は「目的 / スコープ / データ構造案 / 振る舞い / 受け入れ条件 / 未決事項」を含める。
- データ構造は `src/types.ts` の既存ドメイン型（Task / Project / Memo / Settings / ParseResult）を前提とした**案**であり、実装時に `implementer` が調整してよい。
- 後フェーズの要素は本書では「将来拡張」として軽く触れるに留める。
- 新規作成は `feature-spec` スキルを使うと標準フォーマットで書ける。
