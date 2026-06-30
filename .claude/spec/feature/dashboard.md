# 機能仕様: ダッシュボードの実データ化（dashboard）

## 目的

ダッシュボード（`DashboardView`）と左ナビ（`Sidebar`）が表示する成長・案件指標を、`src/lib/seed.ts` の固定値やコンポーネント内のリテラル（`streak = 6` / `total14 = 47` / `+18%` / `HEAT` / `BREAKDOWN` / `Project.bars/recent/stale/staleDays`）から、**実タスク履歴（`tasks[]`）の集計**へ置き換える。

これにより:

- ユーザーが追加したプロジェクトでも「直近2週の動き」「棚卸し推奨」が正しく動く（現状は新規案件で永久に空のまま）。
- streak が `Sidebar` と `DashboardView` の二重定義（ともに `6`）でなく、単一の集計関数に集約される。
- 集計ロジックが `src/lib/metrics.ts`（新設）の純粋関数に寄り、`tester` がユニットテストで受け入れ条件を担保できる。

設計判断の根拠: decisions-log **D-005**（完了率・進捗率・フェーズを出さない）/ **D-006**（Project メトリクスはタスクから導出する計算値に）/ **D-007**（集計を `src/lib/metrics.ts` に集約）。

## スコープ（対象フェーズ: P1）

### 実データ化する指標（本仕様の対象）

| 指標 | 表示箇所 | 現状の出どころ |
|---|---|---|
| streak（連続記録） | `DashboardView` ヒーロー左 / `Sidebar` 下部 | `const streak = 6`（2箇所に直書き） |
| 14日完了数 + 前期間比 | `DashboardView` ヒーロー | `const total14 = 47` / `+18%` リテラル |
| ヒートマップ（直近6週間 / 42日） | `DashboardView` ヒーロー | `seed.ts` の `HEAT` 固定配列 |
| 種別内訳（開発 / 設計 / Doc / MTG） | `DashboardView` ヒーロー | `seed.ts` の `BREAKDOWN` 固定配列 |
| プロジェクト「直近2週の動き」（bars 週次スパークライン / recent 件数） | `DashboardView` プロジェクト行 | `Project.bars` / `Project.recent` 固定値 |
| 棚卸し推奨（stale / staleDays） | `DashboardView` プロジェクト行 | `Project.stale` / `Project.staleDays` 固定値 |

`Sidebar` 下部の「今日 +N」（`doneTodayCount`）は既に実データだが、streak 集約に合わせて metrics 経由へ寄せてよい（任意）。

### 既に実データ済み（対象外・変更しない）

以下はすでに `tasks` から算出済みで、本仕様では**触らない**:

- プロジェクトの「未対応」件数（`open.filter((t) => t.project === p.id)`）
- プロジェクトの「期限間近」件数（`diffDays(t.due) <= 3`）
- プロジェクトの「次の締切」（最も近い `due`、温度感カラー `dueColor`）
- `Sidebar` の各ビュー件数バッジ（今日 / 受信トレイ / メモ）

### 出さないもの（D-005 厳守）

- **完了率**（done / 全件 のような比率）
- **進捗率**（プロジェクトの工程進捗）
- **フェーズ**（工程の進み具合）

本仕様で新設する集計関数群はいずれも上記を**算出しない／公開しない**。レビューで混入があれば重大指摘とする（D-005）。種別内訳のバーは「件数の相対量」であって完了率ではない点に注意（後述）。

### 含まないもの（将来拡張へ）

- しきい値（stale 日数・ヒートマップ日数・前期間比の窓）のユーザー設定化。
- 種別内訳・流量の期間切り替え UI。
- グラフのツールチップ・ドリルダウン。

### 確定したパラメータ

ユーザー確定済み（2026-06-30）。本仕様の既定値はすべてこの値に統一する。

| 項目 | 確定値 | 補足 |
|---|---|---|
| streak の当日扱い | **grace 継続**（GitHub 風） | 当日まだ完了が無くても、昨日に完了があれば前日までの連続を維持。当日完了で +1。昨日にも完了が無ければ 0。 |
| stale しきい値 | **14日**（`>= 14` で `stale=true`） | 最終完了からの経過日数が 14 日以上。`thresholdDays = 14`。 |
| ヒートマップ | **直近6週間（42日）= 7行 × 6列**（曜日×週の GitHub 風） | `heatmap(tasks, days = 42, now)`。45マス(5×9)の現行は廃止。 |
| 種別内訳の母集合・期間 | **直近14日の完了タスク** | 根拠: seed `BREAKDOWN` 合計 19+11+10+7=47 が `total14=47` と一致。`typeBreakdown(tasks, now, days = 14)`。完了率ではなく相対量（D-005 厳守）。 |
| 完了履歴ゼロのプロジェクト | **`{ stale:false, staleDays:0 }`** | `Project.createdAt` は新設しない（スコープを広げない）。 |
| 流量 bars の区間 | **直近8週の週次完了数（8本のスパークライン）** | `recent` は直近14日の完了数として別に算出。週次区切りで端数問題（14日÷8本）を回避。 |
| 前期間比 null 時の表示 | **「—（比較なし）」** | `deltaPct=null`（前期間0件）のとき UI は比を出さない。metrics は `null` を返し、表示変換は描画側。 |
| 旧 Project フィールド移行 | **`persist` の `version` を上げ `migrate` で剥がす** | 旧 `recent`/`stale`/`staleDays`/`bars` を `migrate` で除去（余剰残置案は破棄）。 |

## データ構造案

### `src/types.ts` の `Project` 型変更（D-006）

`Project` から保存フィールド `recent` / `stale` / `staleDays` / `bars` を**除去**し、タスクからの導出値に置き換える。

**変更前:**

```ts
export interface Project {
  id: string;
  name: string;
  color: string;
  /** 直近2週の完了流量。 */
  recent: number;
  /** 棚卸し推奨（停滞）フラグ。 */
  stale: boolean;
  staleDays: number;
  /** ミニ棒グラフ用の流量データ。 */
  bars: number[];
}
```

**変更後（案）:**

```ts
export interface Project {
  id: string;
  name: string;
  color: string;
}
```

連動して変わる箇所（実装は implementer 範囲。ここでは影響範囲のみ明示）:

- `src/lib/seed.ts` `seedProjects()`: 4フィールドの初期値を削除。
- `src/store.ts` `addProject()`: `recent/stale/staleDays/bars` の書き込みを削除。
- `src/components/DashboardView.tsx`: `p.bars` / `p.recent` / `p.stale` / `p.staleDays` 参照を metrics 呼び出しに置換。

導出値は描画側で「指標 DTO」として組み立てる。たとえば（案）:

```ts
// metrics 側が返す、1プロジェクト分の派生メトリクス（保存しない計算値）
export interface ProjectMetrics {
  bars: number[];      // 直近8週の週次完了数（古い→新しい、長さ 8）
  recent: number;      // 直近14日の完了件数
  stale: boolean;      // 棚卸し推奨フラグ（最終完了から 14 日以上で true）
  staleDays: number;   // 最終完了からの経過日数（完了履歴ゼロなら 0）
}
```

### localStorage の移行（`persist` の `version` / `migrate`）— 確定

旧フィールド（`recent` / `stale` / `staleDays` / `bars`）が既存ユーザーの `wish-store` に残るため、`zustand` `persist` の `version` を上げ、`migrate` で旧フィールドを剥がす（余剰残置はしない）。

- `persist` のオプションに `version`（現行は未指定 = `0`）を `1` 以上へ上げる。
- `migrate(persisted, fromVersion)` で `projects[]` の各要素から `recent` / `stale` / `staleDays` / `bars` を除去（`{ id, name, color }` のみ残す）。
- `migrate` は `tasks` / `memos` / `settings` / `seq` には触れない（プロジェクトのみ整形）。
- 移行後の `projects` は新 `Project` 型（3フィールド）に適合すること。

### `src/lib/metrics.ts`（新設）の純粋関数シグネチャ案（D-007）

すべて副作用なし・時刻は引数 `now` で注入可能（既定は `today()`）。`now` は 0:00 正規化した「今日」を渡す前提（`lib/date.today()` と同じ規約）。

```ts
import type { Task, TaskType } from "../types";

/** 連続記録（直近で完了タスクがある日が何日連続しているか）。 */
export function computeStreak(tasks: Task[], now?: Date): number;

/** 直近 n 日（now を含む n 日窓）に完了したタスク件数。 */
export function completedInLastNDays(tasks: Task[], n: number, now?: Date): number;

/** 直近 n 日窓の件数と、その直前の同じ長さ n 日窓の件数、増減率（%）。 */
export function periodComparison(
  tasks: Task[],
  n: number,
  now?: Date
): { current: number; previous: number; deltaPct: number | null };

/** 直近 days 日（既定 42）の日別完了件数（古い→新しいの配列、長さ = days）。 */
export function heatmap(tasks: Task[], days?: number, now?: Date): number[];

/** 完了タスクの種別ごと件数。既定は直近 14 日窓の完了タスクが母集合。 */
export function typeBreakdown(
  tasks: Task[],
  opts?: { days?: number; now?: Date }
): Record<TaskType, number>;

/** あるプロジェクトの流量。bars=直近8週の週次完了数（長さ 8）、recent=直近14日の完了件数。 */
export function projectFlow(
  tasks: Task[],
  projectId: string,
  opts?: { weeks?: number; recentDays?: number; now?: Date }
): { bars: number[]; recent: number };

/** あるプロジェクトの停滞判定（最終完了からの経過日数としきい値。既定 14 日）。 */
export function projectStale(
  tasks: Task[],
  projectId: string,
  opts?: { thresholdDays?: number; now?: Date }
): { stale: boolean; staleDays: number };

/** 上記を束ねた1プロジェクト分の派生メトリクス（描画都合のまとめ・任意）。 */
export function projectMetrics(
  tasks: Task[],
  projectId: string,
  opts?: { now?: Date }
): ProjectMetrics;
```

`tasks` は store の全タスク（完了・未完了・受信トレイ含む）をそのまま渡す。関数内で必要なフィルタ（`done` / `doneAt` / `project` / `type`）を行う。

## 振る舞い

### 共通規約

- **「完了」の判定**: `t.done === true` かつ `t.doneAt` が有効な ISO 文字列であること。`done` でも `doneAt` が `null/undefined` の場合は集計から除外する（過去データ・手作業データの保険）。
- **完了日の正規化**: 日別集計は `dateOnly(t.doneAt)`（0:00 正規化）で比較する。`diffDays(t.doneAt, now)` を用い、`0` = 今日完了、`-1` = 昨日完了、… とする。
- **基準時刻 `now`**: 既定は `today()`（実時刻の 0:00）。テスト時は固定 Date を注入する。すべての関数が `now` を受け取り、内部で `new Date()` を呼ばない（再現性のため）。
- **未来の `doneAt` の扱い**: `diffDays(doneAt, now) > 0`（未来完了）は通常起こらないが、もし存在したら窓に含めない（過去・当日のみ対象）。

### 1. streak（連続記録）— `computeStreak`

- 定義: **「完了タスクが1件以上ある日」が、直近の完了日から過去に向かって連続している日数。当日まだ完了が無くても、前日までの連続は途切れたとみなさない（GitHub 風の grace 仕様）。**
- アルゴリズム:
  1. 完了タスクの `doneAt` を `diffDays(doneAt, now)` に変換し、`<= 0`（今日・過去）のものだけ集めて「完了があった日オフセットの集合」を作る（重複排除）。同日複数完了は1日扱い。
  2. **起点の決定（grace）**:
     - 今日（オフセット `0`）に完了があれば起点 = `0`。
     - 今日に完了が無いが**昨日（オフセット `-1`）に完了があれば**起点 = `-1`（当日未完了でも継続とみなす）。
     - 今日にも昨日にも完了が無ければ連続は途切れているので `0` を返す。
  3. 起点から過去方向（`-1, -2, …`）に連続して集合に含まれる限りカウントを増やす。途切れた時点で終了し、連続日数を返す。
- 効果: 「今日まだ動いていないが昨日まで N 日連続」のとき streak は N を維持し、今日完了すれば N+1 になる（途中で 0 に落ちない）。
- 使用フィールド: `done` / `doneAt`。

### 2. 14日完了数 + 前期間比 — `completedInLastNDays` / `periodComparison`

- 完了数: `diffDays(doneAt, now)` が `(-n+1) 〜 0` の範囲（= now を含む直近 n 日窓）にある完了タスク件数。既定 `n = 14`。
- 前期間比: 直前の同じ長さの窓（`-2n+1 〜 -n`）の件数 `previous` と比較し、増減率を出す。
  - `deltaPct = previous > 0 ? Math.round((current - previous) / previous * 100) : null`。
  - `previous === 0` のときは率を定義できないため `null`。**UI は比を出さず「—（比較なし）」を表示する**（metrics は `null` を返し、表示変換は描画側）。現状の `+18%` リテラルは廃止。
- 使用フィールド: `done` / `doneAt`。

### 3. ヒートマップ（直近6週間 / 42日）— `heatmap`

- 直近 `days` 日（**既定 `days = 42`**）の**日別完了件数**の配列を返す。インデックスは古い→新しい（`[0]` = `days-1` 日前、末尾 = 今日）。長さは常に `days`。
- 表示形状は **7行 × 6列 = 42マス**（曜日 × 週の GitHub 風）。グリッド形状（行=曜日 / 列=週）と並びの正規化は描画側の責務。
- 各要素は件数（整数）。0 件の日は `0`。
- 描画側で最大値正規化して濃淡（`rgba(26,115,232, …)`）に変換する。**集計関数は件数を返すだけ**にして、表示用の透明度計算は描画側に置く（ロジックと描画の分離）。
- 既存 `HEAT`（45要素 = 5×9 グリッド、値域 0〜1 の透明度）は廃止し、42 マスへ移行する。
- 使用フィールド: `done` / `doneAt`。

### 4. 種別内訳（開発 / 設計 / Doc / MTG）— `typeBreakdown`

- 母集合: **直近 14 日窓の完了タスク**（`done && doneAt` かつ `diffDays(doneAt, now)` が `-13 〜 0`）。既定 `opts.days = 14`。根拠: seed `BREAKDOWN` の合計（19+11+10+7=47）が `total14=47` と一致するため、母集合は 14 日完了タスクで確定。
- `type`（`"設計" | "開発" | "DOC" | "MTG"`）ごとに件数を数え、`Record<TaskType, number>` を返す（0件の種別も 0 を入れて4キーを必ず揃える）。
- 表示の対応: ラベルは型に準拠（`設計` / `開発` / `DOC` / `MTG`）。現行 UI の `Doc` 表記は `DOC` に揃えるか UI 側で表示変換する（軽微・実装裁量）。色は現行の固定割当（開発=青 / 設計=シアン / Doc=黄 / MTG=紫）を踏襲し、描画側に置く。
- バー幅（現行 `pct`）は「**最大件数の種別を 100% とした相対量**」で描画側が計算する。**完了率ではない**（D-005。母集合は完了タスクのみで、未完了を分母に取らない）。集計関数は件数のみ返す。
- 使用フィールド: `done` / `doneAt` / `type`。

### 5. プロジェクト「直近2週の動き」（bars / recent）— `projectFlow`

- 対象: `t.project === projectId` かつ完了（`done && doneAt`）のタスク。
- recent: **直近14日窓**（`recentDays = 14`、`diffDays(doneAt, now)` が `-13 〜 0`）の完了件数。現行の `↗ +{recent}` に対応するヘッドライン数値。
- bars: **直近8週の週次完了数**（`weeks = 8`、長さ 8、古い→新しい）。
  - 週の区切り: 各完了タスクのオフセット `d = |diffDays(doneAt, now)|`（`0`〜）を `week = Math.floor(d / 7)` で週インデックス化し、`week < 8` のものを `bars[7 - week]` に加算する（`week=0` = 直近7日 = 末尾 `bars[7]`、`week=7` = 49〜56日前 = 先頭 `bars[0]`）。
  - 週次区切りにすることで「14日 ÷ 8本」の端数問題を避ける（流量の表示と recent のヘッドラインは別の窓・別の意味を持つ）。
- 使用フィールド: `done` / `doneAt` / `project`。`due` は使わない（流量は完了実績で測る）。

### 6. 棚卸し推奨（stale / staleDays）— `projectStale`

- 対象: `t.project === projectId` かつ完了（`done && doneAt`）のタスク。
- staleDays: **最終完了日からの経過日数**＝ `min(|diffDays(doneAt, now)|)`（最も新しい完了の `diffDays` の絶対値）。**完了が1件も無いプロジェクト（追加直後を含む）は `{ stale:false, staleDays:0 }` を返す**（`Project.createdAt` は新設せず、スコープを広げない）。
- stale: `staleDays >= thresholdDays` のとき `true`。**既定 `thresholdDays = 14`**（最終完了から 14 日以上で棚卸し推奨）。
- 表示連動: `stale === true` のとき UI は棒グラフの代わりに「🔍 棚卸し推奨 + N日」を出す（現行挙動を踏襲）。`stale` 行は枠線色 `#feefc3`。
- 使用フィールド: `done` / `doneAt` / `project`。

### UI フロー（描画側の責務）

- `DashboardView` / `Sidebar` は metrics 関数を呼んで件数・配列を受け取り、**透明度・バー高さ・パーセント幅・色**などの表示変換のみを行う（現行のスタイル計算ロジックは維持）。
- `now` は描画側で `today()` を渡す（既定引数任せでも可だが、テスト容易性のため明示渡しを推奨）。
- streak は `DashboardView` と `Sidebar` の両方が `computeStreak(tasks, today())` を呼ぶ（二重定義 `const streak = 6` を撤廃）。

## 受け入れ条件

`tester` が `src/lib/metrics.ts` のユニットテストへ落とせる粒度で記す。各テストは `now` を固定 Date で注入し、`tasks` をインラインで組み立てる。`doneAt` は `addDays(-k, now)` 相当の ISO で与える。

### computeStreak

- AC-1: 今日・昨日・一昨日に各1件完了 → `3`。
- AC-2: 今日・昨日完了、3日前は無し、4日前あり → `2`（途切れたら止まる）。
- AC-3: 同日に複数完了（今日2件・昨日1件）→ `2`（同日は1日扱い）。
- AC-4: 完了タスクが空 → `0`。
- AC-5（grace・当日未完了）: 今日完了が無く、昨日・一昨日・3日前に各1件完了（4日前は無し）→ `3`（当日未完了でも昨日起点で前日までの連続を維持）。
- AC-5b（grace・2日空き）: 今日も昨日も完了が無く、一昨日以前のみ完了 → `0`（昨日まで途切れているので継続しない）。
- AC-5c（当日完了で +1）: 昨日・一昨日に完了があり今日も完了 → `3`（今日完了で連続が伸びる）。
- AC-6: `done: true` だが `doneAt` が null のタスクは streak に寄与しない。

### completedInLastNDays / periodComparison

- AC-7: `n=14`。窓内（0〜13日前）に5件、窓外（14日前以前）に3件 → `completedInLastNDays = 5`。
- AC-8: 境界。ちょうど13日前の完了は窓内、14日前の完了は窓外。
- AC-9: `periodComparison(n=14)`。current=10 / previous=8 → `deltaPct = 25`。
- AC-10: previous=0（前期間に完了無し）→ `deltaPct = null`（UI は率を出さない）。
- AC-11: current=0 / previous=4 → `deltaPct = -100`。

### heatmap

- AC-12: 既定（`days=42`）で返る配列長は常に 42（= 7行×6列）。
- AC-13: 各要素は当該日の完了件数（整数）。完了の無い日は 0。
- AC-14: 末尾要素 = 今日（オフセット0）の件数、先頭 = 41日前の件数（古い→新しい）。
- AC-15: 42日より前（42日前以前）の完了は配列に含まれない。

### typeBreakdown

- AC-16: 直近14日窓で 開発3 / 設計2 / DOC1 / MTG0 の完了 → `{ 設計:2, 開発:3, DOC:1, MTG:0 }`（4キー必ず存在）。
- AC-17: 完了が無い → 全キー 0。
- AC-18: 未完了タスク（`done:false`）は母集合に含めない。
- AC-19: 窓外（15日前）の完了は含めない（既定 days=14 のとき）。

### projectFlow

- AC-20: `recent` は対象プロジェクトの直近14日（`-13〜0`）完了件数。他プロジェクトの完了は数えない。
- AC-21: `bars` の長さは常に 8（週次×8、既定 `weeks=8`）。
- AC-22: 完了が無いプロジェクト → `recent=0`、`bars` は全要素 0（**追加直後プロジェクトでも空配列でなく長さ 8 の 0 配列**）。
- AC-23: 今日（オフセット0）の完了は最新週 = 末尾 `bars[7]` に入る。
- AC-23b（週境界）: 7日前（`d=7`）の完了は `week=1` で `bars[6]`、6日前（`d=6`）は `week=0` で `bars[7]`。56日前以前（`week>=8`）は bars に含まれない。

### projectStale

- AC-24: 最終完了が3日前、既定 `thresholdDays=14` → `{ stale:false, staleDays:3 }`。
- AC-25: 最終完了が20日前、既定 `thresholdDays=14` → `{ stale:true, staleDays:20 }`。
- AC-26: 完了履歴ゼロのプロジェクト（追加直後）→ `{ stale:false, staleDays:0 }`。
- AC-27: しきい値ちょうど（経過 = 14日 = thresholdDays）→ `stale:true`（`>=` 判定）。
- AC-28: 他プロジェクトの完了は当該の staleDays に影響しない。

### 全体・回帰

- AC-29: 完了率・進捗率・フェーズに相当する値（done/total 比など）を返す関数・公開値が `metrics.ts` に**存在しない**（D-005 の機械的チェックにできる範囲で）。
- AC-30: すべての関数が同じ `tasks` / `now` を渡せば毎回同じ結果を返す（`new Date()` の内部呼び出しが無い＝決定的）。
- AC-31: `Project` 型から `bars/recent/stale/staleDays` を除去しても `tsc` が通る（型変更の波及が解消済み）。
- AC-32（移行）: 旧フィールド入りの永続データ（`projects[].bars/recent/stale/staleDays` を含む）を `migrate` に通すと、各 `project` が `{ id, name, color }` のみになり、旧4フィールドが除去される。`tasks` / `memos` / `settings` / `seq` は変化しない。

## 将来拡張

- しきい値（stale 日数・ヒートマップ日数・前期間比窓・流量 buckets）の**設定 UI 化**（`Settings` に追加）。
- 種別内訳・流量の**期間切り替え**（7日 / 14日 / 30日）。
- ヒートマップ・棒グラフの**ツールチップ／クリックでその日のタスク一覧へドリルダウン**。
- プロジェクトに**作成日（`createdAt`）**を持たせ、完了履歴ゼロの案件でも「作成からの経過」で stale 判定する（今回は採用せず＝完了履歴ゼロは `staleDays:0` 固定。将来必要になれば検討）。
- ヒートマップ／流量の**曜日並びを `Settings.weekStart` に追従**させる。

## 未決事項

主要な論点は「確定したパラメータ」へ移した（streak の当日扱い / stale しきい値 / ヒートマップ日数・形状 / 種別内訳の母集合 / 完了履歴ゼロの staleDays / 流量 bars の区間 / 前期間比 null の表示 / 旧フィールド移行）。残るのは実装時に詰める軽微な点のみ。

1. **`migrate` の `version` 番号**: `version` を `1` にするか、将来の余地を見て採番ルールを決めるか（軽微。実装裁量で可）。
2. **ヒートマップの曜日並び**: 7行を「日→土」か「月→日」か（`Settings.weekStart` に追従させるか固定か）。集計（件数配列）には影響せず描画のみの問題。`weekStart` 連動は将来拡張に倒してよい。
3. **種別内訳ラベルの表記ゆれ**: UI の `Doc` を型どおり `DOC` に統一するか、表示だけ `Doc` のまま残すか（軽微・描画側の文言調整）。
</invoke>
