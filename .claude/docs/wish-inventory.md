# Wish スコープ棚卸（inventory）

プロジェクトで作るものを要素単位で洗い出し、各要素に**フェーズ**（P1/P2/P3）を付与する。
designer はここを起点に機能仕様（`spec/feature/`）へ展開する。スコープが変わったらここを更新する。

実装は既にほぼ完成している。本棚卸は「既存実装の要素整理」と「残作業のフェーズ付け」を兼ねる。
本版は実ソース（`src/`・`src-tauri/`）を読んで実態に即して精緻化した第2版。
状態 凡例: ✅=実装済み / 🟡=実装済みだが残課題あり / ⬜=未着手 / 🗑=撤去予定。

> **方針転換（2026-06-30）: RayCast 風オーバーレイ再設計**
> Wish を RayCast 風に作り替える方向で再設計した（確定方針 = **案A: ホットキー＝軽量パレット専用 / フルUIはトレイ・パレット内コマンドから別途開く**）。
> 詳細・受け入れ条件は `.claude/spec/feature/raycast-redesign.md` に集約。本棚卸の各要素にも影響が及ぶため、
> 「RayCast 再設計スコープ」節（後述）を新設し、撤去・新設・改修される要素を整理する。
> 既存表の状態列にも `🗑`（撤去予定）等を反映している。

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
| メモ流し込み→候補抽出 | P1 | 🗑 | **撤去予定**（raycast #5）。自動候補抽出は使わず、メモ2ペインの手動一括追加に置換 | `lib/parse.ts` `detectCandidates()` | `raycast-redesign.md` #5 |
| 候補の一括タスク化 | P1 | 🗑 | **撤去予定**（raycast #5）。`store.convertSelected`/`memoSelected`/`App` の `⌘Enter` 購読ごと削除 | `store.convertSelected` | `raycast-redesign.md` #5 |
| メモ保存 | P1 | ✅ | `⌘S`。本文をメモとして保存 | `store.saveMemo` | （未） |
| 各リストのクイック追加バー | P1 | ✅ | リスト上部の入力欄。`Enter`で追加。表示中プロジェクトを既定プロジェクトに採用 | `ListView`, `store.submitQuick` | （未） |
| アプリ内キーボードショートカット | P1 | 🟡 | `⌘/Ctrl+K`でパレット開閉、`Esc`で全オーバーレイ閉じ、メモモードの`⌘S`。**`⌘Enter`（候補タスク化）購読は撤去予定**（raycast #5） | `App.tsx onKey` | `raycast-redesign.md` #5 |

### タスク・ビュー

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| 今日ビュー | P1 | ✅ | 未完了かつ未仕分け、締切なし or 3日以内を表示。時間指定/フォーカスに分割。完了済み（当日）も別枠表示 | `ListView` view=today | （未） |
| 受信トレイビュー | P1 | ✅ | `inbox` フラグの未完了タスク | `ListView` view=inbox | （未） |
| 完了済み（アーカイブ）ビュー | P1 | ✅ | `done` のタスク一覧 | `ListView` view=archive | （未） |
| プロジェクト別ビュー | P1 | ✅ | 当該プロジェクトの未完了・未仕分け | `ListView` else 分岐 | （未） |
| タスク完了トグル | P1 | ✅ | 完了時 `doneAt` を実時刻でセット、`inbox` 解除 | `store.toggle` | （未） |
| タスク削除 | P1 | 🟡 | 詳細シートから削除。**詳細を開かず行から即削除する導線を追加**（raycast #3） | `store.delTask`, `TaskRow` | `raycast-redesign.md` #3 |
| タスク行（優先度/締切色/メモ有無） | P1 | 🟡 | 締切は温度感カラー。**種別チップ・サブ進捗表示は撤去予定**（raycast #6/#10） | `TaskRow`, `lib/date.dueColor`, `lib/display` | `raycast-redesign.md` #6,#10 |
| タスク詳細サイドシート | P1 | 🟡 | プロジェクト/優先度表示、タスクメモ編集、日付クイックチップ。**種別チップ・サブタスク UI は撤去予定**（raycast #6/#10） | `TaskDetailSheet` | `raycast-redesign.md` #6,#10 |
| ワンクリック日付編集ポップオーバー | P1 | ✅ | クイックチップ（今日/明日/今週末/金曜/来週月/指定なし）＋ミニカレンダー。背景クリックで未指定のまま閉じる | `DatePopover`, `store.setDueQuick/pickDay` | （未） |

### メモ・プロジェクト・設定

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| メモビュー（一覧・削除・タスク化） | P1 | 🟡 | 単独メモのカード一覧。**サマリー表示→クリックで展開→2ペイン（本文 / タスク手動一括追加）へ改修予定**（raycast #2） | `MemosView`, `store.delMemo/memoToTask` | `raycast-redesign.md` #2 |
| プロジェクト追加 | P1 | ✅ | 名前＋カラー（6スウォッチ）。追加後その新ビューへ遷移 | `AddProjectDialog`, `store.addProject` | （未） |
| プロジェクト名編集（rename） | P1 | ⬜ | **新設予定**。`store.renameProject` ＋ UI（設定 or サイドバー）。削除（delProject）は採否未決 | `store`, `SettingsView`/`Sidebar` | `raycast-redesign.md` #7 |
| サイドナビ（件数バッジ・連続記録） | P1 | 🟡 | 各ビューへの遷移と未対応件数。**連続記録 `streak` がハードコード（`Sidebar.tsx` の `const streak = 6`）** | `Sidebar` | （未） |
| 設定（ホットキー記録） | P1 | ✅ | クイック起動 / アプリ内パレットのホットキーをキー入力で記録 | `SettingsView`, `store.startRecording/recordHotkey`, `App.tsx` | （未） |
| 設定（一般・通知） | P1 | 🟡 | 週開始曜日・既定プロジェクト・締切リマインド/デイリーサマリーのトグル。**デスクトップ自動起動トグル（既定OFF）を追加予定**（raycast #8） | `SettingsView` | `raycast-redesign.md` #8 |
| トースト通知 | P1 | ✅ | 操作フィードバック（2.2秒で自動消去） | `Toast`, `store.flash` | （未） |

### ダッシュボード（俯瞰と成長）

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| 連続記録（streak） | P1 | 🟡 | **`DashboardView.tsx` `const streak = 6` でハードコード**（`Sidebar` の `6` と二重定義）。実完了履歴からの算出が残作業 | `DashboardView` | （未） |
| 14日完了数・前期間比 | P1 | 🟡 | **`const total14 = 47` と `+18%` がリテラル直書き**。`tasks` の `doneAt` からの集計に置換が残作業 | `DashboardView` | （未） |
| 14日ヒートマップ | P1 | 🟡 | **`seed.ts` の固定配列 `HEAT`（45要素）を描画**。実完了履歴の日別件数からの生成が残作業 | `DashboardView`, `lib/seed.HEAT` | （未） |
| 種別内訳（開発/設計/Doc/MTG） | P1 | 🗑 | **撤去予定**（raycast #6 で種別タグ全廃）。dashboard.md の `typeBreakdown` 関連も削除が必要 | `DashboardView`, `lib/metrics.typeBreakdown` | `raycast-redesign.md` #6 |
| プロジェクト「未対応」「期限間近」 | P1 | ✅ | **実タスクから算出済み**（`open.filter`・`diffDays<=3`）。D-005準拠で完了率は出さない | `DashboardView` | （未） |
| プロジェクト「直近2週の動き」（棒グラフ/+件数） | P1 | 🟡 | **`Project.bars` / `recent` が `seed.ts` 固定値**（追加プロジェクトは `bars` 全0・`recent` 0）。完了履歴からの流量算出が残作業 | `DashboardView`, `lib/seed.seedProjects`, `store.addProject` | （未） |
| プロジェクト「次の締切」 | P1 | ✅ | **実タスクから算出済み**（最も近い `due`、温度感カラー） | `DashboardView` | （未） |
| 棚卸し推奨（停滞フラグ） | P1 | 🟡 | **`Project.stale` / `staleDays` が `seed.ts` 固定値**（追加プロジェクトは常に `false/0`）。最終完了からの経過日数判定が残作業 | `DashboardView`, `lib/seed.seedProjects`, `store.addProject` | （未） |

### 永続化・基盤

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| Zustand ストア（全アクション） | P1 | ✅ | データ＋UI状態を集約。`seq` でID採番 | `src/store.ts` | （未） |
| localStorage 永続化 | P1 | 🟡 | `persist` + `partialize`。**migrate を `version 2` へ上げ、既存 `tasks` の `type`/`sub` を剥がす拡張が必要**（raycast 横断B）。現状 v1 は旧 Project フィールド除去まで | `src/store.ts` | `raycast-redesign.md` 横断B |
| サンプルデータ（相対日付） | P1 | 🗑 | **撤去予定**（raycast #1 クリーンリリース）。`seedTasks/Memos` は空配列に。`seedProjects` の扱い（空 or 1件）は未決 | `lib/seed.ts` | `raycast-redesign.md` #1 |
| 純粋ロジックの分離（lib/） | P1 | ✅ | parse / date / display を React から分離（CLAUDE.md方針） | `src/lib/` | （未） |

### Tauri 殻・配布

| 要素 | フェーズ | 状態 | 概要 | 出典コード | 仕様 |
|---|---|---|---|---|---|
| グローバルホットキー | P2 | 🟡 | 既定 `Alt+Space`。**再設計（raycast #4/#9）: 本体ではなく palette ウィンドウを toggle 表示（再押下で閉じる）に変更**。設定変更時の `set_global_shortcut` 再登録は維持 | `src-tauri/src/lib.rs`, `src/tauri.ts` | `raycast-redesign.md` #4,#9 / `spec/infra/tauri-shell-verification.md` |
| RayCast 風 2ウィンドウ構成 | P2 | ⬜ | **新設（raycast #4）★核心**: palette（枠なし/透過/最前面/小窓）＋ main（フルUI・起動時非表示）。ホットキーは palette のみ表示、フルUIはトレイ/コマンド経由 | `src-tauri/src/lib.rs`, `tauri.conf.json`, `src/tauri.ts`, `CapturePalette`, `main.tsx` | `raycast-redesign.md` #4 |
| トレイ常駐・ウィンドウトグル | P2 | 🟡 | トレイアイコン。**メニューに「設定」追加（raycast #11）→ main を設定ビューで開く**。× で main をトレイ退避は維持 | `src-tauri/src/lib.rs` | `raycast-redesign.md` #11 / `spec/infra/tauri-shell-verification.md` |
| デスクトップ自動起動（autostart） | P2 | ⬜ | **新設（raycast #8）**: `tauri-plugin-autostart` 導入＋設定トグル（既定OFF）。自動起動時は完全バックグラウンド（ウィンドウ非表示） | `Cargo.toml`, `capabilities`, `lib.rs`, `SettingsView`, `store` | `raycast-redesign.md` #8 |
| 単一起動 | P2 | 🟡 | `single_instance` プラグインで二重起動時は既存ウィンドウを前面化。**再設計で「何を前面化するか（main）」を再定義（raycast #4）** | `src-tauri/src/lib.rs` | `raycast-redesign.md` #4 / `spec/infra/tauri-shell-verification.md` |
| 診断コード（dbg_log/panic フック） | P2/P3 | 🗑 | **撤去予定（raycast 横断A）**: `lib.rs` の `dbg_log`/breadcrumb/`set_hook` をリリース前に除去（`wish-debug.log` 生成を止める） | `src-tauri/src/lib.rs` | `raycast-redesign.md` 横断A |
| 配布（.msi / NSIS, GitHub Releases） | P3 | 🟡 | CI（GitHub Actions, `windows-latest`）で `npm run tauri build` 成功を実証。タグ `v0.1.0` で **ドラフトリリース作成済み**（`.msi` / NSIS 添付・リリースノート記入済み）。残: 実機検証 → **publish**（D-010） | `.github/workflows/release.yml` | `spec/infra/distribution.md` |

## RayCast 再設計スコープ（raycast-redesign.md）

確定方針 = **案A: ホットキー＝軽量パレット専用 / フルUIはトレイ・パレット内コマンドから別途開く**。
詳細・データ構造案・受け入れ条件・未決事項は `.claude/spec/feature/raycast-redesign.md` を参照。実装は「型刈り込み（低リスク）→ 2ウィンドウ（高リスク）」の順。

| # | 変更 | フェーズ | 種別 |
|---|---|---|---|
| 1 | seed 全消し（クリーンリリース） | P1 | 撤去 |
| 2 | メモUI改修（サマリー→展開→2ペイン手動一括追加） | P1 | 改修 |
| 3 | タスク即削除（詳細を開かず削除） | P1 | 新設 |
| 4 | RayCast 風 2ウィンドウ構成 ★核心 | P2 | 新設 |
| 5 | メモのタスク候補機能を削除 | P1 | 撤去 |
| 6 | 種別タグ（TaskType）全廃 | P1 | 撤去 |
| 7 | プロジェクト名編集（rename） | P1 | 新設 |
| 8 | デスクトップ自動起動（autostart） | P2 | 新設 |
| 9 | ホットキーのトグル（再押下で閉じる） | P2 | 改修 |
| 10 | サブタスク削除 | P1 | 撤去 |
| 11 | トレイ右クリック→設定 | P2 | 改修 |
| A | 診断コード除去（dbg_log/panic フック） | P2/P3 | 撤去 |
| B | データ移行（`type`/`sub` を migrate で剥がす・version 2） | P1 | 改修 |

主要な未決（着手前に固めたい）: **初回プロジェクトの有無（#1）/ palette のサイズ・配置・blur 挙動（#4,#9）/ 2ウィンドウ間のデータ同期（#4）**。
そのほかの未決はすべて raycast-redesign.md「未決事項」に集約。

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

0. **RayCast 再設計の着手（最優先・新方針）**: `spec/feature/raycast-redesign.md` に基づき実装。
   - 主要な未決（初回プロジェクト #1 / palette 挙動 #4,#9 / 2ウィンドウのデータ同期 #4）を先に確定。
   - 実装順は raycast-redesign.md「実装ステップ」（STEP 1 型刈り込み → STEP 9 2ウィンドウ）。STEP 1〜6 は P1（ブラウザ）、STEP 7〜9 は P2（CI ビルド・実機）。
   - **`dashboard.md` の追従更新**（種別内訳 `typeBreakdown` 関連の削除）が必要。
1. **（旧）ダッシュボード実データ化**: `spec/feature/dashboard.md`。※ 実データ化自体は実装済み。種別内訳は raycast #6 で廃止のため `dashboard.md` の該当部分を削除する。
   - スコープ: 上記「seed 固定値依存」の各指標を `tasks[].doneAt` / `done` / `type` / `project` からの集計へ置換。
   - 集計は `src/lib/metrics.ts`（新設案）の純粋関数に寄せ、`DashboardView` / `Sidebar` から呼ぶ（streak の二重定義を解消）。
   - データ構造の見直し: `Project` の `bars/recent/stale/staleDays` は**タスクから導出する計算値**に変更する（decisions-log **D-006** で確定。`types.ts` から除去）。集計は `src/lib/metrics.ts`（新設）に集約（**D-007** で確定）。
   - **完了率・進捗率・フェーズは出さない**（decisions-log D-005 厳守）。受け入れ条件を `tester` がテスト可能な粒度で定義。
2. **純粋ロジックのユニットテスト基盤（Vitest）導入**を `tester` で検討（`parse` / `date` / 新設 `metrics` を対象）。
3. **P2/P3 のCIビルド経路で進める（D-010）**。ローカルへの Rust/MSVC 導入は不要。
   1. `.github/workflows/release.yml` を作成（別途担当）。
   2. `develop`（必要に応じてタグ）を origin へ **push**。
   3. **`workflow_dispatch`** を手動実行し、CI が installer（`.msi` / NSIS）を artifact 出力するところまで**ビルド確認**。
   4. artifact の installer を **DL → 実機検証**（手順: `spec/infra/tauri-shell-verification.md`。ホットキー/トレイ/×退避/単一起動/永続化）。
   5. 検証 OK なら **バージョン 3 ファイルを更新 → コミット → タグ `vX.Y.Z` push** で CI がドラフトリリース作成 → Release ノート記入 → **publish**（手順: `spec/infra/distribution.md`）。
   - 署名は当面なし（未署名 installer = SmartScreen 警告。証明書導入は未決）。
