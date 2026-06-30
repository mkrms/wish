# 機能仕様: RayCast 風オーバーレイ再設計（raycast-redesign）

## 目的

Wish を **RayCast 風の常駐ランチャー**へ作り替える。グローバルホットキーは「軽量キャプチャパレット専用」とし、フルUI（今日 / 受信トレイ / メモ / ダッシュボード / 設定）はトレイメニューやパレット内コマンドから別途開く構成にする（**確定方針: 案A**）。

あわせて、リリース前のクリーンアップ（seed 全消し・診断コード除去）と、これまで Wish.dc.html からそのまま移植してきた一部機能（種別タグ / サブタスク / メモのタスク候補自動抽出）の**撤去**を行い、SE 個人の「思いついたら摩擦なく捕まえる」体験に絞り込む。

本仕様は P1（UX 磨き・実データ化の延長）と P2（Tauri 完全版）にまたがる。ブラウザ（`npm run dev`）では Tauri 連携は no-op で従来どおり動き、2ウィンドウ挙動の実検証は CI ビルド済み installer の実機確認で行う（D-003 / D-010）。

設計判断の根拠: decisions-log **D-003**（当面ブラウザ確認）/ **D-005**（ダッシュボードに完了率・進捗率・フェーズを出さない）/ **D-008**（seed に偽の完了履歴を足さない）/ **D-010**（Tauri 完全版は CI ビルド）。本仕様で新たに確定が必要な判断は末尾「decisions-log 追記提案」に列挙する（記録はユーザーが別途行う）。

---

## スコープ

本仕様は以下の **11 の変更 + 2 の横断作業**を対象とする。フェーズと出典コードを併記する。

| # | 変更 | フェーズ | 主な対象 |
|---|---|---|---|
| 1 | seed 全消し（クリーンリリース） | P1 | `lib/seed.ts`, `store.ts` |
| 2 | メモUI改修（サマリー → 展開 → 2ペイン） | P1 | `MemosView.tsx`, `store.ts` |
| 3 | タスク即削除（詳細を開かず削除） | P1 | `TaskRow.tsx`, `store.ts` |
| 4 | RayCast 風オーバーレイ（2ウィンドウ構成）★核心 | P2 | `lib.rs`, `tauri.conf.json`, `tauri.ts`, `CapturePalette.tsx`, `App.tsx` |
| 5 | メモのタスク候補機能を削除 | P1 | `parse.ts`, `CapturePalette.tsx`, `store.ts`, `App.tsx` |
| 6 | 種別タグ（TaskType）全廃 | P1 | `types.ts`, `parse.ts`, `TaskRow.tsx`, `CapturePalette.tsx`, `TaskDetailSheet.tsx`, `DashboardView.tsx`, `metrics.ts`, `store.ts`, `seed.ts` |
| 7 | プロジェクト名編集（rename） | P1 | `store.ts`, `Sidebar.tsx` or `SettingsView.tsx` |
| 8 | デスクトップ自動起動（autostart） | P2 | `Cargo.toml`, `capabilities/default.json`, `lib.rs`, `SettingsView.tsx`, `store.ts`, `types.ts` |
| 9 | ホットキーのトグル（再押下で閉じる） | P2 | `lib.rs`, `tauri.ts` |
| 10 | サブタスク削除 | P1 | `types.ts`, `TaskDetailSheet.tsx`, `TaskRow.tsx`, `store.ts`, `display.ts`, `seed.ts` |
| 11 | トレイ右クリック → 設定 | P2 | `lib.rs`, `tauri.ts`, `App.tsx`, `store.ts` |
| A | 診断コード（dbg_log / breadcrumb / panic フック）の除去 | P2/P3 | `lib.rs` |
| B | データ移行（`type` / `sub` を migrate で剥がす） | P1 | `store.ts` |

### スコープに含まないもの（将来拡張へ）

- パレット内コマンド一覧（コマンドパレット化の本格 UI。今回は「フルUIを開く導線」を最低限）。
- メモのタスク候補の**再導入**（#5 で撤去。自動抽出は当面採用しない）。
- 種別タグの代替（ラベル / 任意タグ）機能。
- autostart の遅延起動・最小化起動オプション。
- パレットの自動補完・履歴・最近使ったプロジェクト。

---

## データ構造案

### `src/types.ts` の変更（#6 種別廃止・#10 サブタスク廃止）

**変更前（現状）:**

```ts
export type TaskType = "設計" | "開発" | "DOC" | "MTG";

export interface SubTask {
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  project: string | null;
  type: TaskType;        // ← #6 で除去
  pri: Priority;
  due: string | null;
  time: string | null;
  done: boolean;
  doneAt?: string | null;
  inbox: boolean;
  sub: SubTask[];        // ← #10 で除去
  notes: string;
}
```

**変更後（案）:**

```ts
// TaskType は型ごと削除。SubTask インターフェースも削除。
export type Priority = "high" | "med" | "low";
export type ViewId = "today" | "inbox" | "memos" | "dashboard" | "archive" | "settings" | string;

export interface Task {
  id: string;
  title: string;
  /** プロジェクト ID。受信トレイの未仕分けタスクは null。 */
  project: string | null;
  pri: Priority;
  /** 締切日（時刻なし、0:00 正規化）。ISO 文字列で保存。 */
  due: string | null;
  /** 時間指定タスクの "HH:MM"。 */
  time: string | null;
  done: boolean;
  /** 完了日時の ISO 文字列。 */
  doneAt?: string | null;
  /** 受信トレイ（未仕分け）フラグ。 */
  inbox: boolean;
  /** タスクごとのメモ。 */
  notes: string;
}
```

`ParseResult` からも `type` を除去する:

```ts
export interface ParseResult {
  title: string;
  due: string | null;
  time: string | null;
  project: string | null;
  pri: Priority | null;
}
```

### `Project` 型（#7 rename。型自体は不変）

`Project` は現状の 3 フィールド（`{ id, name, color }`）のまま。dashboard 仕様（D-006）で `bars/recent/stale/staleDays` は既に除去済み。rename はアクション追加のみで型変更は不要。

### `Settings` 型（#8 autostart トグル）

autostart の ON/OFF を設定に持たせる。

```ts
export interface Settings {
  open: string;          // クイック起動（グローバルホットキー）
  add: string;           // アプリ内コマンドパレット
  weekStart: "月" | "日";
  defaultProject: string;
  notifyDue: boolean;
  notifyDaily: boolean;
  /** デスクトップ自動起動（既定 false）。OS の自動起動エントリと同期する。 */
  autostart: boolean;    // ← 新規
}
```

> 補足: 自動起動の実体は OS 側のレジストリ/スタートアップ登録（`tauri-plugin-autostart`）であり、`settings.autostart` は UI の表示状態とプラグイン状態を同期するための保存値。**正は OS 側**とし、起動時に `is_enabled()` で実状態を読んで `settings.autostart` に反映する案を推奨（後述「振る舞い #8」）。

### store の新規/変更アクション（シグネチャ案）

```ts
interface Actions {
  // --- #2 メモUI改修 ---
  /** メモ一覧でどのメモを展開しているか（null=全て折りたたみ）。UI 状態。 */
  // state: expandedMemoId: string | null;
  expandMemo: (id: string | null) => void;
  /** 展開中メモの右ペインで編集中の「起こすタスク」入力行。UI 状態。 */
  // state: memoTaskDraft: string;
  setMemoTaskDraft: (v: string) => void;
  /** 展開中メモから 1 行をタスク化（受信トレイへ）。本文は notes に保持しない（単発タスク）。 */
  addTaskFromMemo: (memoId: string, title: string) => void;
  /** 複数行を一括でタスク化（改行区切りの draft をまとめて受信トレイへ）。 */
  addTasksFromMemo: (memoId: string, titles: string[]) => void;

  // --- #3 タスク即削除（既存 delTask を流用。詳細を開かず呼べるようにする） ---
  // delTask は現状のまま。TaskRow から呼べるようにする（UI 配線のみ）。

  // --- #7 プロジェクト rename / delete ---
  renameProject: (id: string, name: string) => void;
  /** （採否は未決）プロジェクト削除。所属タスクは project=null（受信トレイ）へ退避。 */
  delProject?: (id: string) => void;

  // --- #8 autostart ---
  /** トグル。OS プラグインへ enable/disable を invoke し、結果を settings に反映。 */
  toggleAutostart: () => void;
  /** 起動時に OS の実状態を settings へ同期（tauri.ts 側から呼ぶ）。 */
  setAutostart: (on: boolean) => void;

  // --- 撤去されるアクション（#5, #10） ---
  // toggleCandidate / convertSelected を削除（#5）
  // addSub / toggleSub / setSubInput を削除（#10）
}
```

撤去される UI 状態（`UiState`）: `memoSelected`（#5）/ `subInput`（#10）。追加される UI 状態: `expandedMemoId`（#2）/ `memoTaskDraft`（#2）。いずれも `partialize` の対象外（UI 一時状態は永続化しない、現行方針どおり）。

### 2ウィンドウ構成（#4）— `tauri.conf.json` の `app.windows`

```jsonc
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Wish",
        "width": 1180, "height": 760,
        "minWidth": 900, "minHeight": 600,
        "resizable": true,
        "center": true,
        "visible": false        // ★ 起動時は出さない（トレイ常駐・自動起動でいきなり出さない）
      },
      {
        "label": "palette",
        "title": "Wish — Capture",
        "width": 640, "height": 240,   // ★ サイズは未決（後述）
        "resizable": false,
        "decorations": false,           // 枠なし
        "transparent": true,            // 背景透過
        "alwaysOnTop": true,            // 最前面
        "skipTaskbar": true,            // タスクバーに出さない
        "center": true,                 // 画面中央（上寄せは未決）
        "visible": false,               // 既定は非表示。ホットキーで toggle
        "shadow": true
      }
    ]
  }
}
```

> ウィンドウ識別子は `lib.rs` の `const MAIN: &str = "main"` に加えて `const PALETTE: &str = "palette"` を追加。`capabilities/default.json` の `"windows": ["main"]` を `["main", "palette"]` に拡張し、palette ウィンドウにも show/hide/set-focus/start-dragging 等の権限を付与する。

---

## 振る舞い

### #1 seed 全消し（クリーンリリース）

- `seedTasks()` / `seedMemos()` は**空配列を返す**。`seedProjects()` の扱いは下記 2 案（未決）:
  - **案 1-A（推奨・完全に空）**: `seedProjects()` も `[]`。初回起動はプロジェクト 0 件。`store` 初期値の `paletteProjectId: "p1"` / `settings.defaultProject: "p1"` は存在しない ID になるため、**「未仕分け（project=null・受信トレイ）」を既定**にするフォールバックが必要。
  - **案 1-B（デフォルト 1 件）**: `seedProjects()` は `[{ id: "p1", name: "個人", color: "#1a73e8" }]` の 1 件だけ。既存の `defaultProject:"p1"` がそのまま生き、パレットのプロジェクト選択が空にならない。
- `seedSettings()` は残す（ホットキー既定値・通知トグル等は初期値が必要）。ただし `defaultProject` は案 1-A なら `""`（未仕分け）に変更。
- D-008 の趣旨（偽の完了履歴を仕込まない）と整合。ダッシュボードは初回ほぼ空に見えてよい。
- **既存 persist データの移行**: seed を空にしても、既存ユーザーの localStorage（`wish-store`）には旧 seed 由来のタスク/プロジェクトが残る。これは消さない（ユーザーデータ扱い）。`migrate`（横断作業 B）で `type`/`sub` を剥がすのみ。**「クリーンリリース」は新規インストール時のみ空**を意味する。

### #2 メモUI改修（サマリー → 展開 → 2ペイン）

- メモ一覧（`MemosView`）はカードを**サマリー表示**にする: 本文の先頭数行（例: 3 行 = `line-clamp` 相当、または最大 ~120 字）＋作成日。現行の全文 `whiteSpace:pre-wrap` 表示をやめる。
- カードをクリックすると、そのメモを**展開**（`expandMemo(id)`）。展開は一覧内インライン展開でもモーダル/シートでもよい（表示形態は未決）。
- 展開時は **2ペイン**:
  - **左ペイン**: メモ本文（編集可否は未決。最低限は閲覧。編集可にするなら `setDetailNotes` 相当の memo 編集アクションが別途必要）。
  - **右ペイン**: 「このメモから起こすタスク」を**手動で一括追加**するパネル。複数行入力（textarea、1 行 = 1 タスク）または 1 行ずつ「追加」する UI。**自動候補抽出は使わない**（#5 と一体）。
- 右ペインからの追加は `addTaskFromMemo` / `addTasksFromMemo` を呼び、**受信トレイ（`project:null, inbox:true`）** へ入れる。プロジェクトは未指定（あとで仕分け）を既定とする。
- 既存の `memoToTask`（メモ全体を 1 タスク化、本文を notes に保持）は**残してよい**（カードの「タスク化」導線）。2ペインの一括化とは別機能。
- 展開状態 `expandedMemoId` は UI 状態（非永続）。

### #3 タスク即削除（詳細を開かず削除）

- `TaskRow` に削除導線を追加。方式は下記（未決、いずれか or 併用）:
  - **案 3-A（ホバー削除ボタン・推奨）**: 行ホバー時に右端へゴミ箱アイコンを出し、クリックで `delTask(task.id)`。`e.stopPropagation()` で詳細シートを開かない。
  - **案 3-B（右クリックメニュー）**: 行を右クリックで小さなコンテキストメニュー（削除）。実装コストが高め。
- 既存 `delTask` をそのまま使う（`detailId:null` のリセットは詳細を開いていない場合も無害）。削除トーストは現行どおり。
- 受信トレイ・今日・プロジェクト別・完了済みの各リスト行に共通で効くようにする（`TaskRow` 共通化）。完了済み行（`ListView` の done-today / archive の独自行）にも付けるかは実装裁量。

### #4 RayCast 風オーバーレイ（2ウィンドウ構成）★核心

**役割分担:**

| 役割 | palette ウィンドウ | main ウィンドウ |
|---|---|---|
| 中身 | `CapturePalette` のみ（軽量キャプチャ） | フルUI（`Sidebar` + 各 View） |
| 起動時 | `visible:false` | `visible:false` |
| ホットキー | toggle 表示（#9） | 影響なし |
| トレイ「Wish を開く」/「設定」 | — | show + nav |
| パレット内「フルUIを開く」コマンド | 自身を hide → main を show | — |
| 閉じる（×） | — | hide（トレイ常駐） |
| フォーカス喪失（blur） | hide する（案・未決） | しない |

- **フロント側の同一バンドル問題**: Tauri は同じ `dist` を両ウィンドウで読む。**ウィンドウのラベルで描画を分岐**する。`window.__TAURI_INTERNALS__` 経由で現在のウィンドウ label を取得し（`getCurrentWindow().label`）、`label === "palette"` なら `App` の代わりに `<PaletteApp>`（`CapturePalette` 単体＋必要 store）を描画する。`main.tsx`（エントリ）で分岐する案を推奨。
  - ブラウザ（`npm run dev`、Tauri 無し）では label 取得不可 → 従来どおり `<App>`（フルUI）を描画。パレットは従来の `paletteOpen` オーバーレイ（`CapturePalette` を main 内に重ねる）で確認できる。**つまり 2ウィンドウ分割は Tauri 環境のみ**。
- **Rust（`lib.rs`）の変更:**
  - `const PALETTE: &str = "palette";` を追加。
  - グローバルホットキー押下時は `show_and_capture` ではなく **palette ウィンドウを toggle**（#9）。`show_palette(app)`: palette を `show` + `set_focus`、`hide_palette(app)`: palette を `hide`。`toggle_palette(app)`: 可視状態で分岐。
  - **本体（main）は出さない**: ホットキーは palette だけを出す。main を出すのはトレイメニュー / パレット内コマンド経由のみ。
  - `show_and_capture`（main を出して `toggle-palette` emit）は**廃止または改名**。トレイ「Wish を開く」は `show_main(app)`（main を show + focus、palette には触れない）に変更。
  - 単一起動（single_instance）のコールバックは「既存ウィンドウを前面化」だが、**何を前面化するか**を再定義（main を出すか palette を出すか）。二重起動は「main を show」が自然（未決ではないが実装時に明記）。
- **フロント（`tauri.ts`）の変更:**
  - palette ウィンドウ側では `toggle-palette` emit は不要（ウィンドウの show/hide が即ち開閉）。代わりに **palette が表示されたら入力欄に autoFocus** されるよう、show 後にフロントへ `palette-shown` を emit するか、palette ウィンドウの focus イベントで input にフォーカスする。
  - `set_global_shortcut`（ホットキー再登録）は現行どおり維持。
- **`CapturePalette` の変更:**
  - Tauri の palette ウィンドウ内では「画面全体を覆うオーバーレイ背景（`position:fixed; inset:0; background:rgba(...)`）」は**不要**（ウィンドウ自体が小窓）。透過ウィンドウに合わせて、カード単体をウィンドウいっぱいに描画する。ブラウザ時は従来のオーバーレイのまま。`isTauri()` で分岐。
  - 「フルUIを開く」導線（フッターのコマンド or アイコン）を追加し、`invoke("show_main")` → palette を hide。

### #5 メモのタスク候補機能を削除

- `parse.ts` から `detectCandidates` と `Candidate` インターフェースを削除。
- `CapturePalette` のメモモードから候補リスト表示・選択 UI・`⌘Enter 選択をタスク化` フッターを撤去。メモモードは「本文入力 → `⌘S` で保存」のみになる。
- `store.convertSelected` / `toggleCandidate` / UI 状態 `memoSelected` を削除。
- `App.tsx` の `Ctrl+Enter`（`convertSelected`）購読を撤去。
- 「メモからタスクを起こす」体験は **#2 の 2ペイン（手動一括追加）**に集約する。

### #6 種別タグ（TaskType）全廃

- `types.ts`: `TaskType` 型と `Task.type` / `ParseResult.type` を削除（データ構造案のとおり）。
- `parse.ts`: 種別解析ブロック（`if (/設計/...) r.type = ...`）を削除。`detectCandidates` は #5 で消えるので種別推定も道連れ。
- `TaskRow.tsx`: `task.type` のチップ（`<span>{task.type}</span>`）を削除。
- `CapturePalette.tsx`: 解析プレビューの `hasType` / `typeText` chip を削除。
- `TaskDetailSheet.tsx`: プロジェクト行の `{task.type}` チップを削除。
- `DashboardView.tsx`: **種別内訳セクション（`BREAKDOWN_META` / `typeBreakdown` の描画）を削除**。ヒーローは streak / 14日完了数・前期間比 / ヒートマップ の 3 要素になる。
- `metrics.ts`: `typeBreakdown` 関数と `TASK_TYPES` 定数を削除。`import type { ... TaskType }` を除去。
- `store.ts`: `newTask` の `type: p.type || "開発"` を削除。`memoToTask` / `convertSelected`（#5 で消滅）内の `type` セットを削除。
- `seed.ts`: タスクの `type` フィールド（#1 で seed 空になるが、型の不整合を残さない）。
- **dashboard.md への波及**: dashboard 仕様の「種別内訳（`typeBreakdown`）」関連（スコープ表 / 振る舞い #4 / AC-16〜19 / 確定パラメータの該当行）は本変更で**廃止**になる。dashboard.md の更新が必要（後述「dashboard.md 修正要否」）。本仕様では raycast-redesign.md に集約し、dashboard.md は別途修正する。

### #7 プロジェクト名編集（rename）

- `store.renameProject(id, name)`: `projects` の該当要素の `name` を更新。空文字は無視（トーストで通知）。
- UI 導線（未決、いずれか）:
  - **案 7-A（サイドバー）**: プロジェクト行のホバーで編集アイコン → インライン input または小ダイアログ。
  - **案 7-B（設定画面）**: 設定にプロジェクト管理セクションを新設し、各プロジェクトの rename / color 変更 / 削除をまとめる。RayCast の「Extensions/設定で管理」に近く、推奨。
- **プロジェクト削除（delProject）の採否は未決**。削除する場合: 所属タスクは `project=null`（受信トレイへ退避）にし、`settings.defaultProject` / `paletteProjectId` が消えた ID を指していたらフォールバック（未仕分け or 先頭プロジェクト）。

### #8 デスクトップ自動起動（autostart）

- `tauri-plugin-autostart`（v2）を導入。
  - `Cargo.toml`: `tauri-plugin-autostart = "2"` を追加。
  - `lib.rs`: `.plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))`（Windows では引数は無視されるが API 上必要）。起動時に main を出さない（`visible:false`）ことと併せ、**自動起動でいきなりウィンドウが出ない**ようにする。
  - `capabilities/default.json`: `autostart:allow-enable` / `autostart:allow-disable` / `autostart:allow-is-enabled` を追加。
- `SettingsView`: 「一般」または新規「起動」カードに**トグル**を追加（`Switch` コンポーネント流用）。ラベル例「PC 起動時に Wish を起動」。
- `store.toggleAutostart`: `isTauri()` なら `invoke`/プラグイン API で enable/disable → 成功したら `settings.autostart` を更新。ブラウザでは no-op（トグルは見た目だけ動かす or 無効表示）。
- 起動時同期: `tauri.ts` に `useAutostartSync()` を追加し、`isEnabled()` の実値を `setAutostart` で `settings` に反映（OS 側が正）。
- **デフォルトは OFF**（`seedSettings().autostart = false`）。

### #9 ホットキーのトグル（再押下で閉じる）

- グローバルホットキー押下で palette が**非表示なら表示**、**表示中なら非表示**（#4 の `toggle_palette` と一体）。
- Rust 側で palette の `is_visible()` を見て分岐。表示時は `set_focus` も行い、入力欄へフォーカス。
- 既存実装はホットキーで常に `show_and_capture`（出すだけ）だった。これを toggle に変更。
- blur で hide する案（#4）を採る場合、「フォーカスが外れた瞬間に隠れる」のと「もう一度ホットキーで閉じる」が両立する（ホットキー押下時点で既に隠れていれば表示される）。blur-hide の有無は未決。

### #10 サブタスク削除

- `types.ts`: `SubTask` 型と `Task.sub` を削除。
- `TaskDetailSheet.tsx`: サブタスク表示・追加 input・`toggleSub` を撤去（「サブタスク」見出しごと削除）。
- `TaskRow.tsx`: `variant === "focus" && task.sub.length > 0` の `doneSubLabel` 表示を撤去。
- `store.ts`: `addSub` / `toggleSub` / `setSubInput` と UI 状態 `subInput` を削除。`newTask` / `memoToTask` の `sub: []` を削除。
- `display.ts`: `doneSubLabel` を削除。
- `seed.ts`: `sub` フィールド（#1 で空になるが型整合のため）。

### #11 トレイ右クリック → 設定

- トレイメニューに「設定」を追加（現行は「Wish を開く」「終了」のみ）。
- 「設定」選択時: main を show + focus し、フロントへ `open-settings`（または既存 `toggle-palette` とは別の）イベントを emit → フロントが受けて `store.nav("settings")`。
- `tauri.ts` に `open-settings` の購読を追加（`useStore.getState().nav("settings")`）。
- 「Wish を開く」は従来の今日ビュー（直前のビュー）で開く。

### 横断 A: 診断コードの除去

- `lib.rs` の `dbg_log` 関数、`run()` 冒頭の `dbg_log(...)` 呼び出し群（`0:`〜`6:`）、`std::panic::set_hook`（breadcrumb panic フック）を**すべて削除**する。
- リリース前（P3 配布の前提）に実施。実装スコープに含める。
- これにより実行ファイル同フォルダへの `wish-debug.log` 生成が止まる。

### 横断 B: データ移行（`type` / `sub` を migrate で剥がす）

- `types.ts` から `type`/`sub` を外すため、既存 localStorage の `tasks[]` に残る `type`/`sub` を `persist` の `migrate` で剥がす。
- `persist` の `version` を現行 `1` → **`2`** に上げる。
- `migrateState`（既存の純粋関数）を拡張: `projects` の整形に加え、`tasks` の各要素から `type` / `sub` を除去する（`notes`/`due`/`time`/`done`/`doneAt`/`inbox`/`pri`/`project`/`id`/`title` のみ残す）。
- `memos` / `settings` / `seq` は触れない（ただし #8 で `settings.autostart` が無い旧データには既定 `false` を補完する案も検討 → 未決。zustand の `merge` 既定で seedSettings とマージされるなら不要かも、実装時に確認）。
- 冪等性・入力非変異（現行 `migrateState` の方針）を維持。

---

## 受け入れ条件

tester / implementer が使える粒度で記す。純粋ロジック（`parse` / `metrics` / `migrateState`）は Vitest 化を推奨。UI/Tauri 挙動はブラウザ確認 + 実機確認（CI installer）に分ける。

### 型・ビルド（#6, #10, B）

- AC-1: `types.ts` から `TaskType` / `SubTask` / `Task.type` / `Task.sub` / `ParseResult.type` を除去しても `tsc --noEmit` が通る（全参照の解消）。
- AC-2: `metrics.ts` に `typeBreakdown` / `TASK_TYPES` が**存在しない**。`import` に `TaskType` が残らない。
- AC-3: `display.ts` に `doneSubLabel` が**存在しない**。
- AC-4: `npm run build` が成功する（残存参照によるビルドエラーが無い）。

### parse（#5, #6）

- AC-5: `parse("明日15時 設計レビュー #ECサイト !高", projects)` が `type` キーを返さない（`ParseResult` に `type` が無い）。日付 / 時刻 / プロジェクト / 優先度の解析は従来どおり維持。
- AC-6: `parse.ts` に `detectCandidates` / `Candidate` が**存在しない**。

### migrate（B）

- AC-7: `version 1` 時代の永続データ（`tasks[]` に `type`/`sub`、`projects[]` に旧4フィールドを含む）を `migrateState` に通すと、各 task が `type`/`sub` を持たず、各 project が `{id,name,color}` のみになる。`memos`/`settings`/`seq` は不変。
- AC-8: `migrateState` は冪等（2 回通しても結果が同じ）で、入力オブジェクトを変異させない。
- AC-9: `persist` の `version` が `2` 以上。

### seed（#1）

- AC-10: 新規インストール（localStorage 空）で `seedTasks()` / `seedMemos()` が空配列。今日ビュー・メモ・受信トレイ・ダッシュボードが「空」表示（クラッシュしない）。
- AC-11: （案 1-A 採用時）プロジェクト 0 件でも、パレット/クイック追加でタスクを追加でき、未仕分け（受信トレイ）に入る。`paletteProjectId`/`defaultProject` が存在しない ID でも落ちない。

### メモ 2ペイン（#2, #5）

- AC-12: メモ一覧はサマリー（先頭数行）で表示され、クリックで展開する。
- AC-13: 展開時に左（本文）/右（タスク起こしパネル）の 2ペインが表示される。
- AC-14: 右ペインで複数行を入力 → 一括追加すると、行数ぶんのタスクが受信トレイ（`inbox:true, project:null`）に増える。
- AC-15: メモモードのパレットに「タスク候補」リストが**表示されない**（#5 撤去）。`⌘Enter` 押下で候補タスク化が起きない。

### タスク即削除（#3）

- AC-16: タスク行から（ホバー削除 or 右クリック）詳細シートを開かずに削除でき、トーストが出る。
- AC-17: 削除操作で詳細シートが開かない（`stopPropagation` が効く）。

### プロジェクト rename（#7）

- AC-18: `renameProject(id, "新名称")` で当該プロジェクト名が変わり、サイドバー / パレット選択 / ダッシュボードに反映される。
- AC-19: 空文字 rename は無視され、名前が変わらない（トースト等で通知）。

### autostart（#8）

- AC-20: 設定にトグルがあり、既定 OFF。
- AC-21（実機）: トグル ON で OS のスタートアップに Wish が登録され、PC 再起動後に Wish が**ウィンドウ非表示のまま**常駐起動する（トレイに出る）。OFF で登録解除。
- AC-22: ブラウザ（dev）ではトグルがクラッシュしない（no-op）。

### 2ウィンドウ / ホットキー（#4, #9, #11）— 実機（CI installer）

- AC-23: アプリ起動直後、main ウィンドウは表示されない（トレイ常駐）。
- AC-24: グローバルホットキーで **palette ウィンドウ**（小窓・枠なし・最前面）が中央に出て、入力欄にフォーカスがある。**main は出ない**。
- AC-25: palette 表示中にもう一度ホットキーを押すと palette が閉じる（トグル）。
- AC-26: palette でタスクを追加（Enter）すると受信トレイ/指定先に入り、palette が閉じる。
- AC-27: トレイ「Wish を開く」で main がフルUIで表示される。× で閉じるとトレイへ退避（プロセスは生存）。
- AC-28: トレイ「設定」で main が**設定ビュー**で表示される。
- AC-29: palette の「フルUIを開く」導線で main が表示され palette が閉じる。
- AC-30（blur-hide を採用する場合）: palette からフォーカスが外れると palette が自動で隠れる。

### 診断コード除去（A）

- AC-31: `lib.rs` に `dbg_log` / `set_hook`（panic breadcrumb）/ `wish-debug.log` への書き込みが**存在しない**。
- AC-32: ビルドした exe を起動しても `wish-debug.log` が生成されない。

### 回帰・D-005

- AC-33: ダッシュボードに完了率・進捗率・フェーズが出ない（D-005 維持）。種別内訳セクションが消えても、未対応 / 期限間近 / 直近2週の動き / 次の締切 の 4指標と streak / 14日完了 / ヒートマップは従来どおり動く。

---

## 実装ステップ（リスク低 → 高）

純粋ロジック・型の刈り込みを先に行い、Tauri の 2ウィンドウ化を最後に回す。各ステップ後に `tsc` / `npm run build` / ブラウザ確認を挟む。

1. **STEP 1（型刈り込み・低リスク）**: #6 種別廃止 + #10 サブタスク廃止 + B 移行（version 2）。`types.ts` を起点に全参照を解消 → `parse.ts` / `metrics.ts` / 各コンポーネント / `store.ts` / `seed.ts` / `display.ts`。`tsc` で漏れを潰す。`migrateState` 拡張のユニットテスト。
2. **STEP 2（候補機能撤去・低）**: #5。`detectCandidates` 削除、`CapturePalette` メモモード簡素化、`store`/`App.tsx` の購読撤去。
3. **STEP 3（メモ UI・中）**: #2 の 2ペイン化と新アクション。#5 で空いたメモモードの役割と整合させる。
4. **STEP 4（タスク即削除・低〜中）**: #3。`TaskRow` に削除導線。
5. **STEP 5（rename・低〜中）**: #7。`renameProject` + UI（設定 or サイドバー）。delProject の採否確定後に追加。
6. **STEP 6（seed 空・低）**: #1。フォールバック（案 1-A or 1-B）を確定して実装。ここまでブラウザで完結。
7. **STEP 7（診断コード除去・低）**: A。`lib.rs` の dbg_log / panic フック削除。
8. **STEP 8（autostart・中）**: #8。プラグイン導入 + capabilities + 設定トグル + 同期。CI ビルドで配線確認。
9. **STEP 9（2ウィンドウ + ホットキー toggle + トレイ設定・高）★核心**: #4 / #9 / #11。`tauri.conf.json` の windows 追加、`main.tsx` のラベル分岐描画、`lib.rs` の show/hide/toggle 再設計、`tauri.ts` のイベント購読更新、`CapturePalette` の Tauri 分岐。CI installer で実機検証（AC-23〜30）。

> STEP 1〜6 は P1（ブラウザ確認）で完結。STEP 7〜9 は P2（CI ビルド + 実機検証、D-010）。

---

## 将来拡張

- **コマンドパレット本格化**: palette から「今日を開く」「ダッシュボード」「設定」「プロジェクトへ移動」等をコマンドとして検索・実行（RayCast のコマンドリスト）。
- **メモ → タスクの補助**: 手動 2ペインに加え、（再評価のうえ）行検出のヒントや quick-parse を右ペインに足す。
- **autostart オプション**: 最小化起動 / 起動遅延。
- **プロジェクト管理 UI の拡充**: 並べ替え・アーカイブ・色変更を設定に集約。
- **palette のテーマ/サイズ設定**: ユーザーが小窓サイズや配置（中央 / 上寄せ）を選べる。
- **複数モニタ対応**: palette をカーソルのあるディスプレイ中央に出す。

---

## 未決事項（まとめて確認したい点）

1. **初回 default project（#1）**: 案 1-A（完全に空・未仕分け既定）か、案 1-B（「個人」等のデフォルト 1 件）か。空にする場合 `defaultProject`/`paletteProjectId` のフォールバック設計が要る。
2. **メモ 2ペインの操作詳細（#2）**: (a) 展開は一覧内インライン展開かモーダル/シートか。(b) 左ペインの本文は**編集可**にするか閲覧のみか。(c) 右ペインは「複数行 textarea を一括」か「1 行ずつ追加」か。(d) 起こしたタスクは常に受信トレイ固定か、プロジェクト指定も許すか。
3. **タスク即削除の方式（#3）**: 案 3-A（ホバー削除ボタン）／案 3-B（右クリックメニュー）／両方。削除前の確認（即削除 vs Undo トースト）。
4. **プロジェクト削除（#7）**: `delProject` を今回スコープに**含めるか**。含める場合、所属タスクは受信トレイ退避でよいか。rename の UI 置き場は設定（案 7-B）かサイドバー（案 7-A）か。
5. **autostart デフォルトと挙動（#8）**: 既定 OFF で確定でよいか。autostart 起動時は「完全バックグラウンド（トレイのみ）」で確定か（main も palette も出さない）。
6. **palette のサイズ / 配置 / blur 挙動（#4, #9, #30）**: (a) サイズ（暫定 640×240）。(b) 配置（画面中央か上寄せ ~20% か）。(c) **フォーカス喪失で自動 hide するか**（RayCast は hide する）。透過ウィンドウの影・角丸の見せ方。
7. **2ウィンドウのフロント分岐方式（#4）**: `main.tsx` でウィンドウ label により `<App>` / `<PaletteApp>` を出し分ける方針で確定してよいか（store はウィンドウ間で共有されない＝各ウィンドウが独自 localStorage 同期になる点の確認。zustand persist は同一 origin の localStorage を読むため、**ウィンドウ間でタスク追加が即時反映されない**可能性 → main をホットキーで開いたとき再読込が要るか、`storage` イベント購読が要るか、を実装時に検証）。
8. **migrate と settings.autostart（B, #8）**: 旧データに `settings.autostart` が無い場合の補完（zustand `merge` 既定で足りるか、`migrate` で明示補完するか）。
9. **トレイ「Wish を開く」の遷移先（#11）**: 直前のビューを覚えるか、常に「今日」で開くか。

> 重要度が高いのは **1（初回プロジェクト）/ 6（palette 挙動）/ 7（2ウィンドウのデータ同期）**。ここは実装の土台に関わるため、着手前に方針を固めたい。
