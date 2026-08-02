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

---

## 2026-06-30 P2/P3 のビルド経路

### D-010 Tauri 完全版ビルド・配布は GitHub Actions（tauri-action）で CI 実行する
- **決定**: `.msi` / NSIS の生成と GitHub Releases への配布を、ローカルではなく GitHub Actions（`tauri-apps/tauri-action`, `windows-latest`）で行う。`.github/workflows/release.yml` を新設。トリガは (1) タグ push（`v*`）でドラフトリリース作成、(2) 手動 `workflow_dispatch` で installer を成果物（artifact）としてアップロード。
- **背景**: D-003 のとおりローカルに Rust/MSVC が未導入で、数 GB の導入は後回しの判断が続いている。CI なら Windows ランナーがビルドを担い、ローカル導入なしに P3（配布）の本命を満たせる。esbuild 等の audit 懸念（D-009）も CI のビルド成果物（出荷物）には無関係。
- **影響**: D-004（GitHub Releases に msi/NSIS）の配布実現手段を CI に確定。CI を動かすには `develop`（およびタグ）を origin（`git@github.com:mkrms/wish.git`）へ push する必要がある（push 可の承認済み）。**P2 の対話的な実機検証（ホットキー/トレイ/単一起動）は CI では代替できず、CI が生成した installer をユーザーが実機で起動して確認する**（手順は `.claude/spec/infra/tauri-shell-verification.md`）。コード署名は当面なし（未署名 installer。SmartScreen 警告が出る旨を distribution に明記）。

---

## 2026-06-30 RayCast 風リデザイン（設計確定）

設計詳細は `.claude/spec/feature/raycast-redesign.md`。ユーザー要望11点に基づく方針転換。

### D-011 RayCast 風 = 案A（2ウィンドウ構成）を採用
- **決定**: ホットキーは軽量パレット専用。フルUI（今日/受信トレイ/メモ/ダッシュボード/設定）はトレイメニューやパレット内コマンドから開く。実装は2ウィンドウ（`main`=フルUI・起動時 `visible:false` / `palette`=枠なし・透過・最前面・skipTaskbar の小窓）。
- **背景**: ユーザーが「ホットキーで出るのはポップアップだけ、本体は出さない（RayCast 風）」を明確に希望。
- **影響**: `lib.rs` / `tauri.conf.json` / `tauri.ts` / `CapturePalette` / `main.tsx`(ウィンドウ label で出し分け) を改修。**palette はフォーカス喪失で自動 hide**（RayCast 流）。ホットキーは palette の toggle（再押下で閉じる, #9）。2ウィンドウは別 webview で zustand が別インスタンスになるため、**`storage` イベント購読でデータをリアルタイム同期**する。ブラウザ（dev）では従来の単一オーバーレイのまま。

### D-012 種別タグ（TaskType）を全廃
- **決定**: `設計/開発/DOC/MTG` の種別タグを廃止。`types.ts` から `TaskType`/`Task.type`/`ParseResult.type`、`parse.ts` の種別解析、各UIのチップ、ダッシュボードの種別内訳（`metrics.typeBreakdown` と `dashboard.md` の該当部）を撤去。
- **背景**: SE 個人の摩擦削減。種別分類は使われず入力コストになる、というユーザー判断。
- **影響**: dashboard.md を更新（種別内訳の節・AC-16〜19・根拠記述を削除）。既存 persist データの `type` は migrate(v2) で剥がす。

### D-013 サブタスクを廃止
- **決定**: `SubTask`/`Task.sub` と関連 UI（`TaskDetailSheet`/`TaskRow`）・アクション（`addSub`/`toggleSub`）・`display.doneSubLabel` を撤去。タスクは単一粒度に統一。
- **背景**: ユーザー要望。粒度を下げず1タスク=1単位にする。
- **影響**: 既存データの `sub` は migrate(v2) で剥がす。

### D-014 メモの自動タスク候補抽出を廃止
- **決定**: `parse.detectCandidates` と候補表示/選択UI・`store.convertSelected` を撤去。メモからのタスク化は2ペインでの**手動一括追加**に一本化。
- **背景**: 誤検出より明示操作を優先（ユーザー要望）。

### D-015 クリーンリリース（seed 全消し）＋初回デフォルトプロジェクト1件
- **決定**: `seedTasks`/`seedMemos` は空に。`seedProjects` は**デフォルトプロジェクト1件のみ**（タスク追加先を必ず確保し、空状態のフォールバック実装を不要にする）。
- **背景**: 偽データを置かない（D-008 と同根）。完全な空だと未仕分け既定のフォールバックが要るため、1件だけ置く方が素直（ユーザー回答）。
- **影響**: 既存 persist データは保持し migrate のみ。

### D-016 デスクトップ自動起動は既定 OFF・OS 側を正とする
- **決定**: `tauri-plugin-autostart`(v2) を導入し、設定画面にトグル（既定 OFF）。起動時は `is_enabled()` で状態同期。自動起動時は完全バックグラウンド（ウィンドウ非表示）。
- **背景**: ユーザー要望（設定で自動起動を切り替えたい）。
- **影響**: Cargo.toml / capabilities / `lib.rs`(command) / `SettingsView` / `store` を配線。P2（Tauri）扱い。

### D-017 リリース前に診断コードを除去
- **決定**: `lib.rs` の `dbg_log`/breadcrumb/panic フック（起動クラッシュ調査で追加したもの）をリリース前に撤去し、`wish-debug.log` 生成を止める。
- **背景**: 調査用の一時コード。製品に残さない。

### D-018 実装は2段階（ブラウザ完結 → Tauri）
- **決定**: STEP1〜6（型刈り込み・UI改修＝ブラウザで検証可能）を先に実装・テスト・ブラウザ検証 → STEP7〜9（2ウィンドウ/autostart/トグル＝Tauri）を CI ビルド・実機検証。
- **背景**: 11変更は大きく、検証手段（ブラウザ vs 実機）が異なるため分割が安全（ユーザー回答）。

---

## 2026-06-30 実機フィードバックによる UI 調整（Wave 3）

第2段階の実機確認後のユーザーフィードバックで確定。

### D-019 メモ→タスクは構造化フォーム＋保留リスト＋一括登録
- **決定**: メモ展開時の右ペインを「1件ずつフォーム入力（タスク名 / プロジェクト / 優先度 / 日付）→ 『リストに追加』で保留リストへ → 『一括登録』でまとめてタスク化」に確定。行ベース textarea 一括（旧 D-014 後の暫定案）は廃止。元メモ本文は各タスクの notes に保持。
- **背景**: 自由記述の取りこぼし・誤りを避け、登録前に内容を確認・編集できる方がよい（ユーザー要望）。ブラウザでUIを提示し合意済み。
- **影響**: `lib/memo.ts` を `PendingTask`/`buildPendingTask`/`pendingToTask` に刷新。store に `memoForm`/`memoPending` と `setMemoForm`/`addPendingTask`/`removePendingTask`/`commitPendingTasks`。

### D-020 プロジェクト編集はプロジェクトビューのヘッダーで（名前・色・削除）
- **決定**: プロジェクトの名前・色の変更と削除を、設定画面ではなく**プロジェクトを開いたときのヘッダー**で行う（インライン編集＋色スウォッチ＋削除）。削除時は所属タスクを受信トレイ（project=null）へ退避。設定画面の rename UI は撤去。
- **背景**: 対象プロジェクトを見ている文脈でその場編集する方が自然（ユーザー要望）。
- **影響**: store に `setProjectColor`/`delProject`（defaultProject/paletteProjectId/表示ビューのフォールバック込み）。`ListView` にヘッダー、`SettingsView` から rename 撤去。

### D-021 タスクの優先度を後から変更可能にする
- **決定**: タスク詳細シートに 高/中/低 セレクタを追加し、`store.setPriority` で即時変更。
- **背景**: 作成後に優先度を変えられないのは不便（ユーザー指摘）。

### D-017 適用済み
- 診断コード（`lib.rs` の `dbg_log`/panic フック/breadcrumb）を除去。起動経路は安定確認済みのため、`wish-debug.log` 生成を停止。

### D-022 依存 `time` を `=0.3.51` にピン（CI ビルド再現性）
- **決定**: `src-tauri/Cargo.toml` に `time = "=0.3.51"` を追加し、`time` 0.3.52 を避ける。
- **背景**: `Cargo.lock` を未コミットのため CI が毎回最新依存を解決する。2026-06-30 08:48 UTC に公開された `time` 0.3.52 が `cookie` 0.18.1（2024 以降更新なし・Tauri 依存ツリー内）のコンパイルを E0061 で壊し、クリーン版ビルドが失敗した（コード変更とは無関係の外部回帰）。
- **影響**: 直前の 0.3.51 に固定して解消。**根本対策は `Cargo.lock` のコミット**（ローカルに Rust 導入時、または CI で生成してコミットする運用）＝将来の floating 依存リスクを断つ。これは未対応の改善項目として残す。

---

## 2026-07-01 実機フィードバック（リリース候補）

### D-023 palette は背景の半透明を出さない／メモ起こしのタスクに本文を引き継がない
- **決定**: (1) palette ウィンドウはカード下の余白・影の halo（半透明に見える領域）を出さず、**ウィンドウをカード高さへ自動リサイズ**してカードだけが浮く見た目にする（`PaletteApp` で ResizeObserver→`setSize`+`center`、capabilities に `set-size`/`center` 追加）。(2) メモから起こしたタスクの `notes` にメモ本文を**引き継がない**（一時メモはタスク棚卸用のスクラッチで、メモはメモとして残る）。`pendingToTask`/`commitPendingTasks`/`memoToTask` を notes 空に。
- **背景**: 実機フィードバック「背景の半透明いらない」「メモから登録したときメモをタスクに入れなくていい」。
- **影響**: D-019 の「元メモ本文を notes 保持」を撤回。テスト（memo / store.actions）を notes 空に追従。palette 自動リサイズは Tauri 専用で実機検証対象。

---

## 2026-07-02 編集操作の拡充＋「今日」画面の再設計

実機フィードバック（編集ができない／ホットキーでフォーカスが当たらない／「今日」が実質全件表示で俯瞰にならない）を受けて確定。

### D-024 タスク名・プロジェクト・メモを後から編集可能にする
- **決定**: (1) タスク詳細シートのタイトルをインライン編集（Enter/blur 確定・Esc 取消・空は無視、`store.renameTask`）。(2) 同シートのプロジェクトを select で変更可能にし、「受信トレイ（未仕分け）」を先頭に置いて差し戻しも可能に（`store.setTaskProject`、null で project=null・inbox=true）。(3) メモ展開時の左ペイン本文を textarea 化し即時保存（`store.editMemo`）。
- **背景**: 作成後に名前・所属・メモ本文を直せないのは不便（ユーザー指摘）。編集作法は既存の ProjectHeader 名前編集に揃える。
- **影響**: `store` に `renameTask`/`setTaskProject`/`editMemo`。`TaskDetailSheet`（TitleEdit 抽出・folder 行を select 化）、`MemosView`（左ペイン textarea 化）。ユニットテスト追加。

### D-025 ホットキー／再表示時に入力欄へ自動フォーカス
- **決定**: palette を開く度に +1 する UI ノンス `paletteSeq` を導入し、`CapturePalette` が `paletteSeq`・mode 変化で現在モードの入力欄へ明示 `focus()`（次フレーム）する。従来の `autoFocus` は撤去して一本化。
- **背景**: Tauri の palette ウィンドウは常時マウントのため再表示（focus）で `autoFocus` が再発火せず、ホットキー起動時に入力欄へカーソルが入らなかった。`usePaletteWindow` の onFocusChanged が `openPalette()` を呼ぶ経路にも自然に乗る。
- **影響**: `store.openPalette` が `paletteSeq` を加算。ブラウザ・palette 窓の両経路で効く。

### D-026 「今日」画面を日付軸のセクション構成に再設計
- **決定**: 従来の「期限なし＋3日以内を一括表示」を廃し、**期限切れ / 今日 / 今週 / 期限なし** のセクションに再構成。期限切れは赤で最上部に強調、今週の境界は設定 `weekStart` 基準（`date.endOfWeek`）。**来週以降の期限つきは今日画面に出さない**（各ビュー/プロジェクトで見る）。各セクション内は時間指定を時刻順で先頭に、その他を締切の近い順で並べる。各セクションはラベルクリックで折りたたみ可能（初期は全展開）。全セクション空なら従来の完了メッセージ。
- **背景**: 旧仕様は実質ほぼ全件表示で「今やること」の俯瞰として機能していなかった（ユーザー指摘）。期限切れの気づき・今週の見通しを持たせる。週境界は「weekStart 基準」でユーザー確定。当初は「期限なしを出さない」方針だったが、フォローで**期限なしも表示（最下部）＋各セクション折りたたみ**に修正（ユーザー要望）。
- **影響**: `date.ts` に純粋関数 `endOfWeek(weekStart)`（テスト追加）。`ListView` の today 分岐を TodaySections（折りたたみ state 込み）に置換（他ビューの timed/focus 表示は不変）。

### D-027 「今日」を「タスク」に改称＋クイック追加にプロジェクト select＋未指定は受信トレイ
- **決定**: (1) 「今日」ビューの画面タイトルとサイドバーのラベルを **「タスク」** に改称（`today` という内部 view id は据え置き）。サイドバーのバッジ件数も「タスク」ビュー表示分（期限なし＋今週末までの期限つき、`endOfWeek(weekStart)` 基準）に一致させた。(2) 全リストビューのクイック追加フォームに **投入先プロジェクトのインライン select**（先頭「受信トレイ」＋各プロジェクト）を追加。既定はプロジェクトビューならそのプロジェクト、それ以外は受信トレイ（未仕分け）。(3) `submitQuick(projectId)` に変更し、**プロジェクト未指定（受信トレイ選択）なら project=null・inbox=true**（タスク画面での追加は既定で受信トレイへ）。`#プロジェクト` 記法があればそれを最優先。
- **背景**: タスク画面で追加したものがデフォルトプロジェクトに紛れるのを避け、仕分け前は受信トレイに集約したい（ユーザー要望）。追加先をその場で選べるようにする。
- **影響**: `store.submitQuick` の引数化と受信トレイ既定化（旧 `isCoreView`/`defaultProject` フォールバックは撤去）。`ListView` にクイック追加の select（ローカル state、view 毎に `key` で remount 初期化）。`App` で `<ListView key={view}>`。`Sidebar` のラベル改称と件数ロジック更新。

### D-028 タスク詳細シートにカレンダーを設置（MiniCalendar 共用化）
- **決定**: 詳細シートの日付指定に、クイックチップに加えて**ミニカレンダー**を常設し任意日を選べるようにする。`DatePopover` 内のカレンダー実装を `MiniCalendar`（`due` と `onPick` を受ける表示部品）へ切り出し、`DatePopover` と詳細シートで共用する。
- **背景**: 詳細シートではクイックチップ（今日/明日/今週末/なし）しかなく、任意の日付を選べなかった（ユーザー要望）。
- **影響**: `MiniCalendar.tsx` を新設。`DatePopover` は同部品を使う形にリファクタ（重複排除、`setDueQuick`/`pickDay` に taskId を明示）。`TaskDetailSheet` はチップ下に `MiniCalendar` を追加（`pickDay(iso, task.id)`）。

### D-029 タスクの並び替え（追加順/優先度/期限日・方向トグル・全ビュー共通で永続化）
- **決定**: 各リストビューのヘッダーに並び順セレクト（追加順 / 優先度順 / **期限日順=既定・近い順(asc)**）と**昇順↔降順トグル**を置く。設定は `settings.sortKey`/`sortDir` に持ち、**全ビュー共通で永続化**。手動ドラッグ並べ替えは今回スコープ外。並び規則: 優先度=高→中→低（安定）、期限日=近い順で**期限なしは方向に関わらず末尾**、追加順=新規が先頭（desc）/古い順（asc）。「タスク」画面はセクション（期限切れ/今日/今週/期限なし）を維持し**各セクション内**を並べ替える。既定（追加順）のときはセクション内・他ビューとも従来の「時間指定→期限近い順 / 時間指定・フォーカス2ブロック」を維持し、優先度・期限日を選んだときのみその基準で（他ビューは分割せず1リスト）。
- **背景**: 「優先度順・日付順で見たい」というユーザー要望。既定時の見え方は変えたくないため、明示選択時のみ基準適用とした。
- **影響**: `types` に `SortKey`/`SortDir` と `Settings.sortKey`/`sortDir`。`seed`・`migrate` に既定（`added`/`desc`）補完。純粋関数 `lib/sort.ts`（テスト追加）。`store` に `setSortKey`/`toggleSortDir`（テスト追加）。`ListView` に `SortControl`（通常ヘッダー・ProjectHeader 双方）とソート適用。`store.test` の Settings リテラルを新キーに追従。

---

## 2026-08-03 アプリ内自動更新

### D-030 Tauri updater でアプリ内アップデートを導入（NSIS・承諾必須・GitHub Releases 配信）
- **決定**: `tauri-plugin-updater` + `tauri-plugin-process` を導入し、更新の検知・ダウンロード・インストール・再起動を**アプリ内で完結**させる。配信元は GitHub Releases の **publish 済み最新**リリースに添付する `latest.json`（`https://github.com/mkrms/wish/releases/latest/download/latest.json`）。更新経路は **NSIS のみ**（`.msi` は手動ダウンロード用に残す）。`installMode` は **passive**（進捗バーのみ・操作不要。`quiet` は NSIS で不具合報告があるため採らない）。
  - **検知しても自動では入れない**: 起動時チェック（`settings.autoUpdateCheck`、既定 ON）は store とトーストで知らせるだけ。インストールは設定画面の「今すぐ更新」＝**ユーザーの明示操作**を起点とする。
  - 署名は updater 専用の **minisign 鍵**（`src-tauri/.tauri/`。`.gitignore` 済み・秘密鍵は GitHub Secrets）。**Authenticode によるコード署名とは別物**で、SmartScreen 警告はこれでは消えない（未署名配布の方針は据え置き）。
  - **通信失敗はユーザーに見せない**（オフライン前提のアプリのため、起動時チェックの失敗は log のみ。手動チェック時だけエラー表示）。
- **背景**: 更新のたびに Releases から installer を落として実行する手作業が発生していた（ユーザー要望）。`distribution.md` の未決事項「自動更新（updater）」を解決する。`latest/download` は draft を拾わないため、現行の「draft → 実機検証 → publish」フローとそのまま噛み合う。
- **影響**: `Cargo.toml` / `lib.rs` に 2 プラグイン、`tauri.conf.json` に `bundle.createUpdaterArtifacts` と `plugins.updater`（公開鍵・エンドポイント）、`capabilities/default.json` に `updater:default` / `process:allow-restart`、`release.yml` に署名 env と `includeUpdaterJson`。フロントは新規 `lib/update.ts`（プラグインは動的 import＝ブラウザに実体を持ち込まない）、`tauri.ts` の `useUpdateCheck`、`SettingsView` の「アップデート」カード、`types`/`seed`/`migrate` に `settings.autoUpdateCheck`（既定 true・補完テスト追加）、UI 一時状態 `updateAvailable`。**秘密鍵を失うと既存ユーザーへ更新を配信できなくなる**（公開鍵がアプリに焼き込まれるため）。updater を載せた最初の版は**一度だけ手動インストールが必要**。仕様は `spec/infra/auto-update.md`。

---

## 2026-08-03 タスク入力記法の見直し

### D-031 入力解析を自動推測から明示プレフィックス（@ / # / !）＋候補サジェストへ
- **決定**: `parse()` の**裸のテキストからの推測を全廃**し、日付・時刻も `#` `!` と同じ明示プレフィックス `@` に揃える（`@明日` `@金曜` `@8/10` `@+3d` `@15:00`）。タイプ量が増える分は、**`@` `#` `!` を打った時点でドロップダウン候補を出す**ことで相殺する（↑↓ で選び Enter/Tab で確定、Esc で候補だけ閉じる）。解釈できない `@xyz` / 未登録の `#名前` は**黙って消さずタイトルに残す**。あわせて `高優先` の裸解釈、`まで/までに` のタイトル除去、`#` の逆方向あいまい一致も廃止する。
- **背景**: 曜日の正規表現が `(月|火|水|木|金|土|日)曜?` と `曜` を任意にしていたため、**「入出金」→ 金曜日**、「日報」→ 日曜、「月次レポート」→ 月曜のように、単独漢字 1 文字で日付が付く誤爆が起きていた（ユーザー報告）。`3時間` → 3:00、`1/2 に分割` → 1月2日 も同様。一方 `#` `!` はプレフィックス必須で誤爆していなかったため、日付・時刻を同じ土俵に載せるのが一貫すると判断した。「推測の境界を厳格化するだけ」の案も検討したが、誤爆リスクが残る（「金曜ロードショーを見る」）ため採らなかった。
- **`project/Wish.dc.html` からの意図的な乖離**: `parse()` はモックアップからの忠実移植を維持してきたが（`.claude/CLAUDE.md` 3・6 章）、本件は**出典の挙動そのものが実用上のバグ**であるため、意図的に離れる。以後 `parse` は出典ではなく `spec/feature/task-input-syntax.md` を正とする。
- **IME 対応**: 併せて `onKeyDown` に `isComposing` ガードを入れた。日本語入力の変換確定 Enter が「タスク追加」に化ける既存の不具合も解消する。Esc は App / PaletteApp が **window の keydown** で拾うため、React 合成イベントの `stopPropagation` では止まらない。TaskInput 側で **window の capture フェーズ**に登録して先に捕まえる。
- **影響**: `lib/parse.ts` を書き換え（`parseDate` / `parseTime` / `findProject` を named export）。新規 `lib/suggest.ts`（`activeToken` / `suggestFor` / `applySuggestion`）、新規 `components/TaskInput.tsx`（入力＋サジェスト共用部品）、新規 `components/ParsePreview.tsx`（解析チップを `CapturePalette` から切り出し）。適用先はパレット・各リストのクイック追加・メモ起こしフォームの**全入力欄**。パレットは候補を `inline`（カード内）に出す — palette ウィンドウはカード高さに合わせて OS ウィンドウをリサイズするため（`PaletteApp` の ResizeObserver）、浮かせると窓外で切れる。クイック追加にも解析チップを追加。テストは `lib/parse.test.ts`（29 件・誤爆防止が中心）と `lib/suggest.test.ts`（15 件）を新設し、旧記法前提だった `lib/memo.test.ts` を新記法へ追従。**保存済みタスクには影響しない**（解析は入力時のみ）。
