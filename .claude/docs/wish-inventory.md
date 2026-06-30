# Wish スコープ棚卸（inventory）

プロジェクトで作るものを要素単位で洗い出し、各要素に**フェーズ**（P1/P2/P3）を付与する。
designer はここを起点に機能仕様（`spec/feature/`）へ展開する。スコープが変わったらここを更新する。

実装は既にほぼ完成している。本棚卸は「既存実装の要素整理」と「残作業のフェーズ付け」を兼ねる。
本版は実ソース（`src/`・`src-tauri/`）を読んで実態に即して精緻化した第2版。
状態 凡例: ✅=実装済み / 🟡=実装済みだが残課題あり / ⬜=未着手。

## フェーズの定義

| フェーズ | 目的 |
|---|---|
| P1 | 実データ化 / UX 磨き（ダッシュボード指標を seed 固定値から実タスク履歴の集計へ。既存 UX の磨き込み・バグ修正） |
| P2 | Tauri 完全版（Rust + MSVC 導入、グローバルホットキー・トレイ常駐・単一起動の実機検証） |
| P3 | 配布・公開（`.msi` / NSIS を GitHub Releases で配布） |

## 要素一覧（フェーズ付き）

### 入力・キャプチャ

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| 自然言語解析（parse） | P1 | ✅ | 優先度（`!高/中/低`）・プロジェクト（`#名前`）・種別・時刻（`HH:MM`/`HH時`）・日付（今日/明日/明後日/今週末/来週/`+Nd`/曜日/`M/D`）を抽出 | `lib/parse.ts` `parse()` | （未） |
| コマンドパレット（タスク/メモ2モード） | P1 | ✅ | オーバーレイUI。タブ切替・プロジェクト選択・解析プレビューchip表示 | `CapturePalette`, `store.openPalette/setMode` | （未） |
| パレットからのタスク追加 | P1 | ✅ | `Enter`=追加 / `Shift+Enter`=受信トレイへ | `store.submitPaletteTask` | （未） |
| メモ流し込み→候補抽出 | P1 | ✅ | 本文から「タスクにできそうな行」を検出（`要対応/TODO/[ ]`/語尾/日付語）し種別推定 | `lib/parse.ts` `detectCandidates()` | （未） |
| 候補の一括タスク化 | P1 | ✅ | `⌘Enter`。選択行（無選択時は全候補）を受信トレイへ。種別を引き継ぐ | `store.convertSelected` | （未） |
| メモ保存 | P1 | ✅ | `⌘S`。本文をメモとして保存 | `store.saveMemo` | （未） |
| 各リストのクイック追加バー | P1 | ✅ | リスト上部の入力欄。`Enter`で追加。表示中プロジェクトを既定プロジェクトに採用 | `ListView`, `store.submitQuick` | （未） |
| アプリ内キーボードショートカット | P1 | ✅ | `⌘/Ctrl+K`でパレット開閉、`Esc`で全オーバーレイ閉じ、メモモードの`⌘Enter`/`⌘S` | `App.tsx onKey` | （未） |

### タスク・ビュー

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| 今日ビュー | P1 | ✅ | 未完了かつ未仕分け、締切なし or 3日以内を表示。時間指定/フォーカスに分割。完了済み（当日）も別枠表示 | `ListView` view=today | （未） |
| 受信トレイビュー | P1 | ✅ | `inbox` フラグの未完了タスク | `ListView` view=inbox | （未） |
| 完了済み（アーカイブ）ビュー | P1 | ✅ | `done` のタスク一覧 | `ListView` view=archive | （未） |
| プロジェクト別ビュー | P1 | ✅ | 当該プロジェクトの未完了・未仕分け | `ListView` else 分岐 | （未） |
| タスク完了トグル | P1 | ✅ | 完了時 `doneAt` を実時刻でセット、`inbox` 解除 | `store.toggle` | （未） |
| タスク削除 | P1 | ✅ | 詳細シートから削除 | `store.delTask` | （未） |
| タスク行（種別/優先度/締切色/メモ有無/サブ進捗） | P1 | ✅ | 締切は温度感カラー、サブタスク `done/total` 表示 | `TaskRow`, `lib/date.dueColor`, `lib/display` | （未） |
| タスク詳細サイドシート | P1 | ✅ | プロジェクト/種別/優先度表示、サブタスク追加・トグル、タスクメモ編集、日付クイックチップ | `TaskDetailSheet` | （未） |
| ワンクリック日付編集ポップオーバー | P1 | ✅ | クイックチップ（今日/明日/今週末/金曜/来週月/指定なし）＋ミニカレンダー。背景クリックで未指定のまま閉じる | `DatePopover`, `store.setDueQuick/pickDay` | （未） |

### メモ・プロジェクト・設定

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| メモビュー（一覧・削除・タスク化） | P1 | ✅ | 単独メモのカード一覧。「タスク化」で受信トレイへ（本文をnotesに保持） | `MemosView`, `store.delMemo/memoToTask` | （未） |
| プロジェクト追加 | P1 | ✅ | 名前＋カラー（6スウォッチ）。追加後その新ビューへ遷移 | `AddProjectDialog`, `store.addProject` | （未） |
| サイドナビ（件数バッジ・連続記録） | P1 | 🟡 | 各ビューへの遷移と未対応件数。**連続記録 `streak` がハードコード（`Sidebar.tsx` の `const streak = 6`）** | `Sidebar` | （未） |
| 設定（ホットキー記録） | P1 | ✅ | クイック起動 / アプリ内パレットのホットキーをキー入力で記録 | `SettingsView`, `store.startRecording/recordHotkey`, `App.tsx` | （未） |
| 設定（一般・通知） | P1 | ✅ | 週開始曜日・既定プロジェクト・締切リマインド/デイリーサマリーのトグル | `SettingsView` | （未） |
| トースト通知 | P1 | ✅ | 操作フィードバック（2.2秒で自動消去） | `Toast`, `store.flash` | （未） |

### ダッシュボード（俯瞰と成長）

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| 連続記録（streak） | P1 | 🟡 | **`DashboardView.tsx` `const streak = 6` でハードコード**（`Sidebar` の `6` と二重定義）。実完了履歴からの算出が残作業 | `DashboardView` | （未） |
| 14日完了数・前期間比 | P1 | 🟡 | **`const total14 = 47` と `+18%` がリテラル直書き**。`tasks` の `doneAt` からの集計に置換が残作業 | `DashboardView` | （未） |
| 14日ヒートマップ | P1 | 🟡 | **`seed.ts` の固定配列 `HEAT`（45要素）を描画**。実完了履歴の日別件数からの生成が残作業 | `DashboardView`, `lib/seed.HEAT` | （未） |
| 種別内訳（開発/設計/Doc/MTG） | P1 | 🟡 | **`seed.ts` の固定配列 `BREAKDOWN`（val/pct直書き）を描画**。完了タスクの `type` 集計に置換が残作業 | `DashboardView`, `lib/seed.BREAKDOWN` | （未） |
| プロジェクト「未対応」「期限間近」 | P1 | ✅ | **実タスクから算出済み**（`open.filter`・`diffDays<=3`）。D-005準拠で完了率は出さない | `DashboardView` | （未） |
| プロジェクト「直近2週の動き」（棒グラフ/+件数） | P1 | 🟡 | **`Project.bars` / `recent` が `seed.ts` 固定値**（追加プロジェクトは `bars` 全0・`recent` 0）。完了履歴からの流量算出が残作業 | `DashboardView`, `lib/seed.seedProjects`, `store.addProject` | （未） |
| プロジェクト「次の締切」 | P1 | ✅ | **実タスクから算出済み**（最も近い `due`、温度感カラー） | `DashboardView` | （未） |
| 棚卸し推奨（停滞フラグ） | P1 | 🟡 | **`Project.stale` / `staleDays` が `seed.ts` 固定値**（追加プロジェクトは常に `false/0`）。最終完了からの経過日数判定が残作業 | `DashboardView`, `lib/seed.seedProjects`, `store.addProject` | （未） |

### 永続化・基盤

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| Zustand ストア（全アクション） | P1 | ✅ | データ＋UI状態を集約。`seq` でID採番 | `src/store.ts` | （未） |
| localStorage 永続化 | P1 | ✅ | `persist` + `partialize` で data（tasks/projects/memos/settings/seq）のみ保存。UI一時状態は除外 | `src/store.ts` | （未） |
| サンプルデータ（相対日付） | P1 | ✅ | 初回起動時の seed。日付は「今日」起点の相対値で生成 | `lib/seed.ts` | （未） |
| 純粋ロジックの分離（lib/） | P1 | ✅ | parse / date / display を React から分離（CLAUDE.md方針） | `src/lib/` | （未） |

### Tauri 殻・配布

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| グローバルホットキー | P2 | 🟡 | 既定 `Alt+Space`。Rust登録＋`toggle-palette` emit→フロント購読。設定変更時は `set_global_shortcut` で再登録。**Rust/MSVC未導入のため実機未検証**（ブラウザでは no-op） | `src-tauri/src/lib.rs`, `src/tauri.ts` | `spec/infra/distribution.md` |
| トレイ常駐・ウィンドウトグル | P2 | 🟡 | トレイアイコン（左クリックで表示/非表示、メニューで開く/終了）。閉じるボタンはトレイへ退避。**実機未検証** | `src-tauri/src/lib.rs` | `spec/infra/distribution.md` |
| 単一起動 | P2 | 🟡 | `single_instance` プラグインで二重起動時は既存ウィンドウを前面化。**実機未検証** | `src-tauri/src/lib.rs` | `spec/infra/distribution.md` |
| 配布（.msi / NSIS, GitHub Releases） | P3 | ⬜ | `npm run tauri build` → Releases 配布 | — | `spec/infra/distribution.md` |

## 既知の残課題・気づき（コード裏取り）

- **ダッシュボードの seed 固定値依存（P1の中核）**: 以下が実タスク履歴ではなく固定値。
  - `DashboardView.tsx`: `streak = 6`、`total14 = 47`、`+18%`（いずれもコンポーネント内リテラル）。
  - `src/lib/seed.ts`: `HEAT`（ヒートマップ）、`BREAKDOWN`（種別内訳）の固定配列。
  - `src/lib/seed.ts` `seedProjects()`: `bars` / `recent` / `stale` / `staleDays` の固定値。`store.addProject` は新規プロジェクトに `bars:[0…0], recent:0, stale:false, staleDays:0` を入れるため、**ユーザーが追加した案件の「動き」「棚卸し推奨」は永久に空のまま**になる。
  - 一方、プロジェクトの**「未対応」「期限間近」「次の締切」は既に実タスクから算出済み**で置換不要。
- **streak の二重定義**: `Sidebar.tsx` と `DashboardView.tsx` でそれぞれ `const streak = 6`。実データ化の際は1箇所（lib/集計関数）に集約すべき。
- **集計ロジックの置き場所が未整備**: 既存方針（ロジックは `lib/` の純粋関数へ）に従うなら、完了履歴からの集計関数（streak / 14日件数 / ヒートマップ / 種別内訳 / プロジェクト流量・停滞）を `src/lib/`（例: `metrics.ts`）に新設するのが自然。現状そのファイルは無い。
- **ユニットテスト未整備**: `lib/parse.ts` / `lib/date.ts` 等の純粋関数に対するテストが無い（Vitest 未導入）。実データ化の受け入れ条件を担保する基盤として要検討。
- **機能仕様が未起票**: `spec/feature/` は README のみ。本棚卸の各要素に対応する仕様ファイルは未作成（表の「仕様」列は当面「（未）」）。

## 次のアクション

1. **ダッシュボード実データ化の仕様化（最優先）**: `feature-spec` で `spec/feature/dashboard.md` を起こす。
   - スコープ: 上記「seed 固定値依存」の各指標を `tasks[].doneAt` / `done` / `type` / `project` からの集計へ置換。
   - 集計は `src/lib/metrics.ts`（新設案）の純粋関数に寄せ、`DashboardView` / `Sidebar` から呼ぶ（streak の二重定義を解消）。
   - データ構造の見直し: `Project` の `bars/recent/stale/staleDays` は**タスクから導出する計算値**に変更する（decisions-log **D-006** で確定。`types.ts` から除去）。集計は `src/lib/metrics.ts`（新設）に集約（**D-007** で確定）。
   - **完了率・進捗率・フェーズは出さない**（decisions-log D-005 厳守）。受け入れ条件を `tester` がテスト可能な粒度で定義。
2. **純粋ロジックのユニットテスト基盤（Vitest）導入**を `tester` で検討（`parse` / `date` / 新設 `metrics` を対象）。
3. **P2 実機検証の前提整理**: Rust/MSVC 導入（D-003）後に、グローバルホットキー・トレイ・単一起動を実機検証する手順を `spec/infra/distribution.md` 側で具体化。
