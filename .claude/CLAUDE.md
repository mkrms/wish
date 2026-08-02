# Wish 開発ガイド（詳細）

ルート `CLAUDE.md` の詳細版。開発に必要な知見・ドキュメント所在・禁止事項をここに集約する。

---

## 1. プロジェクト概要

- **目的**: SE 個人の「思いついたら摩擦なく捕まえ、完了を振り返り、案件を俯瞰して成長を可視化する」を最小操作で叶える。
- **対象ユーザー / 最終ゴール**: 複数案件の一部工程だけを担当することが多い SE 個人。全タスクを律儀に管理させるのではなく、自分視点で「今やること・次の締切・停滞案件」が一目で分かる常駐ツールにする。
- **技術スタック**: Tauri 2（Rust 殻）+ React 18 + TypeScript + Vite。状態管理は Zustand（`persist` で localStorage に永続化）。フォント・アイコン（Roboto / Material Symbols）はローカル同梱で CDN 非依存。Windows デスクトップ。
- **公開・配布**: GitHub Releases（`mkrms/wish`）に Windows インストーラ（`.msi` / NSIS）を配布。詳細は `.claude/spec/infra/distribution.md`。

## 2. 開発方針（フェーズ）

| フェーズ | 目的 | 概要 |
|---|---|---|
| 1 | 実データ化 / UX 磨き | ダッシュボードの各指標（streak・14日完了数・ヒートマップ・種別内訳・プロジェクト4指標）を `src/lib/seed.ts` の固定値から、実タスク履歴の集計に置き換える。既存 UX の磨き込み・バグ修正。 |
| 2 | Tauri 完全版 | Rust ツールチェーン + MSVC C++ ワークロード導入の上で、グローバルホットキー・トレイ常駐・単一起動を実機検証し、ネイティブ殻として完成させる。 |
| 3 | 配布・公開 | `npm run tauri build` で `.msi` / NSIS を生成し、GitHub Releases で配布する。 |

実装は既にほぼ完成しており、出典は `project/Wish.dc.html`（Claude Design モックアップ）。
詳細なスコープは `.claude/docs/wish-inventory.md`（棚卸）を参照。

## 3. 技術スタックの決定事項

- **ロジックと描画/入力/通信を分離**する。自然言語解析・日付・候補抽出・表示ヘルパー等の純粋ロジックは `src/lib/`（`parse.ts` / `date.ts` / `display.ts` / `seed.ts`）に寄せ、React コンポーネントから切り離す。
- **状態は Zustand ストア（`src/store.ts`）に集約**し、`persist` で localStorage に永続化する。
- **ロジックは `project/Wish.dc.html` を出典に忠実移植**する。ただし「今日」は固定値でなく実時刻ベースにし、サンプルデータは相対日付で生成して、いつ開いてもデザイン通りに見せる。
  - **例外: 入力解析（`lib/parse.ts`）は出典から意図的に離れた**（D-031）。出典の自動推測は「入出金 → 金曜日」のような誤爆を生むため、明示プレフィックス（`@` / `#` / `!`）＋候補サジェストへ移行済み。以後 `parse` は `spec/feature/task-input-syntax.md` を正とする。
- **CDN に依存しない**。フォント・アイコンは `src/assets/fonts/` に同梱する。
- Tauri 連携（`src/tauri.ts`）はブラウザでは no-op で動く。当面の検証はブラウザ（`npm run dev`, port 1420）で行う（完全版ビルドは後回し。理由は `decisions-log.md` D-003）。
- 設計判断の経緯は `.claude/docs/decisions-log.md` に記録する。

## 4. ドキュメント構成（所在）

```
CLAUDE.md                      … プロジェクト概要のみ（このファイルへの誘導）
.claude/
├─ CLAUDE.md                  … 本ファイル（開発ガイド詳細）
├─ docs/                      … 設計ドキュメント・棚卸・意思決定ログ
├─ spec/
│  ├─ feature/               … 機能仕様
│  ├─ infra/                 … 機能外: 公開・通信・ビルド（distribution.md）
│  ├─ design/                … 機能外: デザイン方針
│  └─ quality/               … 機能外: テスト・レビュー方針
├─ agents/                    … エージェント定義（designer / implementer / code-reviewer / tester）
└─ skills/                    … プロジェクトローカルのスキル（update-docs / feature-spec）
```

- **ドキュメント全般** → `.claude/docs/`
- **機能仕様** → `.claude/spec/feature/`
- **機能外仕様** → `.claude/spec/` 配下にディレクトリを分けて保存（infra / design / quality など）
- なお `project/`（モックアップ）と `chats/`（デザイン確定までの会話）は **実装の出典**であり、消さない。

## 5. エージェント構成

| 名前 | 役割 |
|---|---|
| `designer` | 仕様・設計の起こし（docs / spec の執筆、現状調査） |
| `implementer` | 実装（TypeScript/React の `src/`、Rust の `src-tauri/`） |
| `code-reviewer` | コードレビュー（既存の `/code-review` skill も活用） |
| `tester` | テスト（純粋ロジックのユニットテスト。Vitest を導入候補とする） |

## 6. 禁止事項・厳守事項

### ❌ 禁止
- **承認なしに次のステップへ進むこと。** 各エージェントの完了時・作業の区切りごとに、必ずユーザーへ
  「次へ進んでよいか」の承認を求める。
- **承認なしの `git commit` / `git push`。** ブランチ作成・差分提示・コミット文案の提示までは可。
  実際のコミット／プッシュはユーザーの承認後のみ。
- プロジェクトの資産（ソース・データ・設定、および `project/` / `chats/` の出典資料）への破壊的変更を、確認なしに行うこと。
- `git init`（リポジトリはユーザーが用意する。こちらから初期化しない）。
- **ダッシュボードに完了率・進捗率・フェーズを足さないこと。**（意図的な設計判断。理由は `decisions-log.md` D-005）

### ✅ 厳守・推奨
- **不明点は、できるだけ一度にまとめて質問する。**（細切れに聞かない）
- 効率化のため、必要に応じて **git workflow / エージェントの並列起動**を活用してよい。
- 仕様にない追加・スコープ拡大を独断でしない（必要なら提案して承認を得る）。
- ロジック（解析・日付・候補抽出）は `project/Wish.dc.html` を出典とし、忠実移植を保つ。
  ただし**入力解析（`lib/parse.ts` / `lib/suggest.ts`）は例外**で、`spec/feature/task-input-syntax.md` が正（D-031）。
  裸のテキストからの日付・時刻・優先度の推測を復活させないこと（誤爆の原因）。

## 7. よく使うワークフロー

- **設計** → `designer` で docs / spec を起こす → 承認 → 実装へ。
- **実装** → `implementer` が実装 → 型チェック（`tsc`）・`npm run build`・`npm run dev`（port 1420, preview）で描画とコンソールエラーを確認 → `code-reviewer` → `tester` → 承認 →
  コミット文案提示 → 承認後コミット。
