# 意思決定ログ（Decisions Log）

プロジェクトの重要な設計・技術判断を時系列で記録する。各エントリは「決定 / 背景 / 影響」を残す。
日付は相対表現を避け、絶対日付（YYYY-MM-DD）で記す。

---

## 2026-06-30 初期セットアップ

### D-001 開発基盤の構成: 2 段 CLAUDE.md ＋ .claude/ 構造
- **決定**: ルート `CLAUDE.md`（概要）と `.claude/CLAUDE.md`（詳細）の 2 段構成とし、`.claude/` 配下に
  `agents` / `docs` / `spec`（feature / infra / design / quality）/ `skills` を置く。
- **背景**: 初期読み込みを軽くし、ドキュメントの所在を固定して複数エージェント・将来の自分が迷わないようにするため。
- **影響**: 以後、機能仕様は `spec/feature/`、機能外仕様は `spec/{infra,design,quality}/`、決定はこのログに集約する。既存の `.claude/chats`・`.claude/project`・`.claude/claude-design`（出典資料）は保持する。

### D-002 エージェント構成: 4 役
- **決定**: designer / implementer / code-reviewer / tester の 4 役で進める。
- **背景**: 設計・実装・レビュー・テストの責務を分離するため。個人開発でも役割の住み分けは判断のばらつきを抑える。
- **影響**: `.claude/agents/` に 4 種を定義。code-reviewer は既存 `/code-review` skill も活用する。

### D-003 ビルドは当面 UI（ブラウザ）確認のみ。Tauri 完全版は後回し
- **決定**: 当面の検証は `npm run dev`（Vite, port 1420）でのブラウザ確認に限定し、`npm run tauri dev/build` は後回しにする。
- **背景**: ローカル環境は Node v22 / WebView2 は導入済みだが、Rust（rustup/cargo）と MSVC C++ ビルドツール（VS Community に「C++ デスクトップ開発」ワークロード）が未導入。導入に数 GB かかるため、UI 完成を優先する判断（2026-06-30 時点）。
- **影響**: Tauri ネイティブ機能（グローバルホットキー・トレイ常駐・単一起動）はブラウザでは no-op として動作確認する。完全版ビルドと実機検証は P2 で行う。

### D-004 配布先: GitHub Releases に Windows インストーラ
- **決定**: `npm run tauri build` で生成する `.msi` / NSIS インストーラを、GitHub（`mkrms/wish`）の Releases で配布する。
- **背景**: Windows デスクトップ単一ターゲットで、まず手軽に配布できる経路として Releases を採用。Microsoft Store（MSIX）は将来の選択肢として保留。
- **影響**: 配布手順・要件は `.claude/spec/infra/distribution.md` に定義する。P3 の作業対象。

### D-005 ダッシュボードは完了率・進捗率・フェーズを表示しない
- **決定**: ダッシュボードに完了率・進捗率・フェーズ（工程進捗）を出さない。代わりに自分視点の4指標（未対応 / 期限間近 / 直近2週の動き / 次の締切）で表示し、停滞案件には `🔍 棚卸し推奨` を出す。
- **背景**: 完了率は「全タスクを洗い出せている」前提でしか正しくない（分母が嘘をつく）。フェーズは「自分が全工程を担当する」前提でしか正しくない。SE 個人が一部工程だけ担当する実態に合わないため、意図的に排除する。
- **影響**: 安易に完了率/進捗率を足さない。designer / implementer / code-reviewer はこの方針を厳守し、混入はレビューで重大指摘とする。

---

## 2026-06-30 ダッシュボード実データ化に向けた設計判断

### D-006 プロジェクトのメトリクスは保存値でなくタスクから導出する計算値にする
- **決定**: `Project` 型の `bars` / `recent` / `stale` / `staleDays` を保存フィールドから外し、完了タスク履歴（`tasks[].doneAt` / `due` / `project`）から**都度導出する計算値**として扱う。
- **背景**: 現状これらは `src/lib/seed.ts` の `seedProjects()` 固定値で、`store.addProject` は新規案件に `bars:[0…0], recent:0, stale:false, staleDays:0` を入れるため、**ユーザーが追加したプロジェクトの「直近2週の動き」「棚卸し推奨」が永久に空のまま**になる（seed のサンプル案件しか動かない）。保存値だと追加・完了のたびに整合を取る必要があり崩れやすい。
- **影響**: `src/types.ts` の `Project` 型を変更（4フィールド除去）。導出は D-007 の `src/lib/metrics.ts` に集約し、`DashboardView` / `Sidebar` から呼ぶ。`store.addProject` / `seedProjects()` から当該フィールドの書き込みを除去。これにより追加プロジェクトも自然にメトリクスが動く。移行（既存 localStorage の partialize データに残る旧フィールド）の扱いは dashboard 仕様で定義する。

### D-007 完了履歴の集計ロジックを src/lib/metrics.ts に集約する
- **決定**: streak / 14日完了数（前期間比）/ 14日ヒートマップ / 種別内訳 / プロジェクト流量（bars・recent）/ 停滞判定（stale・staleDays）を算出する純粋関数を `src/lib/metrics.ts`（新設）に集約し、`DashboardView` と `Sidebar` から共用する。
- **背景**: 既存方針「ロジックは `src/lib/` の純粋関数へ」の具体化。現状 `streak = 6` が `Sidebar.tsx` と `DashboardView.tsx` に**二重定義**されており、集計が各コンポーネントに散らばると整合が崩れる。
- **影響**: `src/lib/metrics.ts` を新設。tester は parse/date と並びここを主要なユニットテスト対象にできる（時刻依存は基準時刻固定で再現可能に）。`DashboardView` / `Sidebar` のリテラル（`streak` / `total14` / `+18%`）と `seed.ts` の `HEAT` / `BREAKDOWN` 固定値は metrics 経由の算出に置換する。

### D-008 seed には過去の完了履歴を足さない（実データのみ）
- **決定**: ダッシュボード実データ化後も、`seedTasks()` にデモ見栄え用の過去完了タスク履歴を追加しない。初回起動時はダッシュボードが「ほぼ空」（streak=1・14日完了=2・ヒートマップ末尾のみ）に見えることを許容する。
- **背景**: 固定値（旧 `streak=6` 等）を廃して実タスク集計にした以上、空に見えるのは正しい挙動。デモ見栄えのために偽の完了履歴を仕込むと、実データ化の趣旨（分母・履歴が信用できる値だけを出す。D-005 と同根）に反する。
- **影響**: 初回起動のダッシュボードは寂しく見えるが、ユーザーが実際にタスクを完了するにつれ自然に埋まる。将来この判断を見直す場合も、ここを起点に再検討する（同じ提案を再び持ち込まない）。

### D-009 npm audit の脆弱性（esbuild 由来）は開発専用として受容する
- **決定**: `npm audit` が報告する5件（3 moderate / 1 high / 1 critical の表示）について、`npm audit fix --force` 等の破壊的修正は行わず、開発専用の既知リスクとして受容する。
- **背景**: 5件すべてが単一 advisory（esbuild の開発サーバ SSRF, GHSA-67mh-4wv8-2f99）に由来し、依存チェーンは `esbuild → vite → @vitest/mocker / vite-node → vitest`。「critical 1」は npm のチェーン重大度の積み上げ表示で、根本は esbuild の moderate 1件。これらは**開発時のみ動くツール**であり、Tauri が出荷するビルド済み静的アセットには含まれない。発火条件は「`npm run dev` 実行中に悪意あるサイトを開く」ことで、ローカルのデスクトップ開発では実リスクが低い。なお esbuild 脆弱性は Vitest 導入前から `vite ^5.4.10` 経由で既に存在していた。`audit fix --force` は vite@8（破壊的変更）を入れ、現行の vite 5 / Tauri 構成を壊す。
- **影響**: 当面は対応しない。将来 vite をメジャー更新する際に自然解消を狙う。次に audit の critical を見ても再調査不要（この判断を参照する）。
