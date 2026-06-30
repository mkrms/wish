// アプリ状態とすべてのアクション。プロトタイプ（Wish.dc.html）の Component ロジックを
// React/zustand に移植し、データ部分を localStorage に永続化する。

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Memo, PaletteMode, Priority, Project, Settings, Task, ViewId } from "./types";
import { addDays, nextWeekday, today } from "./lib/date";
import { parse } from "./lib/parse";
import { buildPendingTask, pendingToTask } from "./lib/memo";
import type { MemoTaskForm, PendingTask } from "./lib/memo";
import { seedMemos, seedProjects, seedSettings, seedTasks } from "./lib/seed";

let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Tauri ランタイム上か。tauri.ts の isTauri と同義だが、循環 import を避けるため store 内に持つ。 */
function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

interface DataState {
  tasks: Task[];
  projects: Project[];
  memos: Memo[];
  settings: Settings;
  seq: number;
}

interface UiState {
  view: ViewId;
  quickInput: string;
  paletteOpen: boolean;
  paletteMode: PaletteMode;
  paletteInput: string;
  paletteProjectId: string;
  memoText: string;
  editingDateId: string | null;
  detailId: string | null;
  projectDialogOpen: boolean;
  newProjName: string;
  newProjColor: string;
  recording: keyof Pick<Settings, "open" | "add"> | null;
  toast: string | null;
  // #2 / C メモUI: 展開中のメモ ID（null=全て折りたたみ）。
  // 右ペインは「フォーム入力 → 保留リスト → 一括登録」方式（C）。
  // memoForm = 現在の入力フォーム、memoPending = 登録待ちの保留タスク一覧。
  // いずれも UI 一時状態（partialize 対象外＝永続化しない）。
  expandedMemoId: string | null;
  memoForm: MemoTaskForm;
  memoPending: PendingTask[];
}

interface Actions {
  flash: (msg: string) => void;
  // navigation
  nav: (view: ViewId) => void;
  // tasks
  toggle: (id: string) => void;
  delTask: (id: string) => void;
  // #D 優先度を後から変更する。
  setPriority: (id: string, pri: Priority) => void;
  setQuickInput: (v: string) => void;
  submitQuick: () => void;
  // palette
  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
  setMode: (m: PaletteMode) => void;
  setPaletteInput: (v: string) => void;
  setPaletteProjectId: (id: string) => void;
  submitPaletteTask: (toInbox: boolean) => void;
  // memo capture
  setMemoText: (v: string) => void;
  saveMemo: () => void;
  // memos view
  delMemo: (id: string) => void;
  memoToTask: (id: string) => void;
  // #2 / C メモ2ペイン（展開 → フォーム入力 → 保留リスト → 一括登録）
  expandMemo: (id: string | null) => void;
  /** 右ペインの入力フォームを部分更新する（title / project / pri / due）。 */
  setMemoForm: (patch: Partial<MemoTaskForm>) => void;
  /** 現在のフォーム入力を保留リストへ積む（タイトル必須）。積んだらフォームをクリアする。 */
  addPendingTask: () => void;
  /** 保留リストから 1 件取り除く。 */
  removePendingTask: (key: string) => void;
  /** 保留リストの全件を実タスク化する（元メモ本文を各 notes に保持）。登録後リストをクリア。 */
  commitPendingTasks: (memoId: string) => void;
  // date editor
  openDate: (id: string) => void;
  closeDateEditor: () => void;
  setDueQuick: (kind: string, id?: string) => void;
  pickDay: (iso: string, id?: string) => void;
  // detail
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setDetailNotes: (v: string) => void;
  // project dialog
  openProjectDialog: () => void;
  closeProjectDialog: () => void;
  setNewProjName: (v: string) => void;
  setNewProjColor: (c: string) => void;
  addProject: () => void;
  // settings
  setWeekStart: (v: "月" | "日") => void;
  setDefaultProject: (id: string) => void;
  // #8 デスクトップ自動起動
  /** トグル。OS プラグインへ enable/disable を invoke し、成功したら settings へ反映（結果は握って log）。 */
  toggleAutostart: () => void;
  /** 起動時に OS の実状態（is_enabled）を settings へ同期する（OS 側が正）。 */
  setAutostart: (on: boolean) => void;
  // #7 / B プロジェクト編集（名前・色・削除）
  renameProject: (id: string, name: string) => void;
  /** プロジェクトの色を変更する。 */
  setProjectColor: (id: string, color: string) => void;
  /** プロジェクトを削除する。所属タスクは project=null（受信トレイ）へ退避し、
   *  defaultProject / paletteProjectId / 表示中ビューが消える場合はフォールバックする。 */
  delProject: (id: string) => void;
  toggleNotifyDue: () => void;
  toggleNotifyDaily: () => void;
  startRecording: (which: "open" | "add") => void;
  recordHotkey: (combo: string) => void;
  cancelRecording: () => void;
  // global key handling helpers
  escape: () => void;
}

export type Store = DataState & UiState & Actions;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // ----- data -----
      tasks: seedTasks(),
      projects: seedProjects(),
      memos: seedMemos(),
      settings: seedSettings(),
      seq: 100,

      // ----- ui -----
      view: "today",
      quickInput: "",
      paletteOpen: false,
      paletteMode: "task",
      paletteInput: "",
      paletteProjectId: "p1",
      memoText: "",
      editingDateId: null,
      detailId: null,
      projectDialogOpen: false,
      newProjName: "",
      newProjColor: "#1a73e8",
      recording: null,
      toast: null,
      expandedMemoId: null,
      memoForm: emptyMemoForm(),
      memoPending: [],

      // ----- actions -----
      flash: (msg) => {
        set({ toast: msg });
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: null }), 2200);
      },

      nav: (view) => set({ view, editingDateId: null, detailId: null }),

      toggle: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, done: !t.done, doneAt: !t.done ? today().toISOString() : null, inbox: false }
              : t
          ),
        })),

      delTask: (id) => {
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), detailId: null }));
        get().flash("タスクを削除しました");
      },

      setPriority: (id, pri) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, pri } : t)) })),

      setQuickInput: (v) => set({ quickInput: v }),

      submitQuick: () => {
        const s = get();
        const v = s.quickInput.trim();
        if (!v) return;
        const p = parse(v, s.projects);
        if (!p.title) return;
        const proj =
          p.project || (s.view.startsWith("p") && !isCoreView(s.view) ? s.view : s.settings.defaultProject);
        const nt = newTask(s.seq + 1, { ...p, project: proj, inbox: false });
        set((st) => ({ tasks: [nt, ...st.tasks], quickInput: "", seq: st.seq + 1 }));
        s.flash("タスクを追加しました");
      },

      openPalette: (mode) =>
        set((s) => ({ paletteOpen: true, paletteMode: mode ?? s.paletteMode })),
      closePalette: () => set({ paletteOpen: false }),
      setMode: (m) => set({ paletteMode: m }),
      setPaletteInput: (v) => set({ paletteInput: v }),
      setPaletteProjectId: (id) => set({ paletteProjectId: id }),

      submitPaletteTask: (toInbox) => {
        const s = get();
        const v = s.paletteInput.trim();
        if (!v) return;
        const p = parse(v, s.projects);
        if (!p.title) return;
        const proj = p.project || s.paletteProjectId;
        const nt = newTask(s.seq + 1, { ...p, project: toInbox ? null : proj, inbox: !!toInbox });
        set((st) => ({ tasks: [nt, ...st.tasks], paletteInput: "", paletteOpen: false, seq: st.seq + 1 }));
        s.flash(toInbox ? "受信トレイに保存しました" : "タスクを追加しました");
      },

      setMemoText: (v) => set({ memoText: v }),

      saveMemo: () => {
        const s = get();
        const t = s.memoText.trim();
        if (!t) {
          s.flash("メモが空です");
          return;
        }
        const nm: Memo = { id: "me" + (s.seq + 1), text: t, createdAt: today().toISOString() };
        set((st) => ({ memos: [nm, ...st.memos], memoText: "", paletteOpen: false, seq: st.seq + 1 }));
        s.flash("メモを保存しました");
      },

      delMemo: (id) => {
        set((s) => ({ memos: s.memos.filter((m) => m.id !== id) }));
        get().flash("メモを削除しました");
      },

      memoToTask: (id) => {
        const s = get();
        const m = s.memos.find((x) => x.id === id);
        if (!m) return;
        const title = m.text.split("\n")[0].slice(0, 60);
        const nt: Task = {
          id: "n" + (s.seq + 1),
          title,
          // 受信トレイ＝未仕分け（project=null）に統一（M-2 / 受信トレイの不変条件）。
          project: null,
          pri: "med",
          due: null,
          time: null,
          done: false,
          inbox: true,
          notes: m.text,
        };
        set((st) => ({ tasks: [nt, ...st.tasks], seq: st.seq + 1 }));
        s.flash("メモをタスク化しました（受信トレイへ）");
      },

      // 展開時はフォーム・保留リストをリセットする（メモごとに独立した下書き）。
      expandMemo: (id) => set({ expandedMemoId: id, memoForm: emptyMemoForm(), memoPending: [] }),
      setMemoForm: (patch) => set((s) => ({ memoForm: { ...s.memoForm, ...patch } })),

      addPendingTask: () => {
        const s = get();
        const key = "pt" + (s.seq + 1);
        // タスク名にだけ軽く parse をかけ、フォームの値を優先して保留タスクを構築する。
        const parsed = parse(s.memoForm.title.trim(), s.projects);
        const pending = buildPendingTask(key, s.memoForm, parsed);
        if (!pending) {
          s.flash("タスク名を入力してください");
          return;
        }
        set((st) => ({
          memoPending: [...st.memoPending, pending],
          memoForm: emptyMemoForm(),
          seq: st.seq + 1,
        }));
      },

      removePendingTask: (key) =>
        set((s) => ({ memoPending: s.memoPending.filter((p) => p.key !== key) })),

      commitPendingTasks: (memoId) => {
        const s = get();
        const memo = s.memos.find((m) => m.id === memoId);
        if (!memo) return;
        if (s.memoPending.length === 0) {
          s.flash("リストにタスクを追加してください");
          return;
        }
        let seq = s.seq;
        // 各保留タスクを実 Task へ。元メモ本文を notes に保持する（memoToTask の挙動を踏襲）。
        const created: Task[] = s.memoPending.map((p) => {
          seq += 1;
          return pendingToTask("n" + seq, p, memo.text);
        });
        set((st) => ({ tasks: [...created, ...st.tasks], seq, memoPending: [], memoForm: emptyMemoForm() }));
        s.flash(`${created.length}件のタスクを登録しました`);
      },

      openDate: (id) => set({ editingDateId: id }),
      closeDateEditor: () => set({ editingDateId: null }),

      setDueQuick: (kind, id) => {
        const s = get();
        const tid = id || s.editingDateId;
        if (!tid) return;
        let due: string | null = null;
        if (kind === "today") due = today().toISOString();
        else if (kind === "tomorrow") due = addDays(1).toISOString();
        else if (kind === "weekend") due = nextWeekday(6).toISOString();
        else if (kind === "fri") due = nextWeekday(5).toISOString();
        else if (kind === "nextmon") due = nextWeekday(1).toISOString();
        else due = null;
        set((st) => ({ tasks: st.tasks.map((t) => (t.id === tid ? { ...t, due } : t)), editingDateId: null }));
      },

      pickDay: (iso, id) => {
        const s = get();
        const tid = id || s.editingDateId;
        if (!tid) return;
        set((st) => ({ tasks: st.tasks.map((t) => (t.id === tid ? { ...t, due: iso } : t)), editingDateId: null }));
      },

      openDetail: (id) => set({ detailId: id }),
      closeDetail: () => set({ detailId: null }),
      setDetailNotes: (v) => {
        const id = get().detailId;
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, notes: v } : t)) }));
      },

      openProjectDialog: () => set({ projectDialogOpen: true, newProjName: "", newProjColor: "#1a73e8" }),
      closeProjectDialog: () => set({ projectDialogOpen: false }),
      setNewProjName: (v) => set({ newProjName: v }),
      setNewProjColor: (c) => set({ newProjColor: c }),
      addProject: () => {
        const s = get();
        const n = s.newProjName.trim();
        if (!n) {
          s.flash("プロジェクト名を入力してください");
          return;
        }
        const id = "p" + (s.seq + 1);
        const proj: Project = { id, name: n, color: s.newProjColor };
        set((st) => ({ projects: [...st.projects, proj], projectDialogOpen: false, seq: st.seq + 1, view: id }));
        s.flash("プロジェクトを追加しました");
      },

      setWeekStart: (v) => set((s) => ({ settings: { ...s.settings, weekStart: v } })),
      setDefaultProject: (id) => set((s) => ({ settings: { ...s.settings, defaultProject: id } })),

      // #8 自動起動: OS 側が正。トグルは Rust の set_autostart を invoke し、成功したら settings に反映。
      // ブラウザ（Tauri 非検出）では見た目だけ即座に反映（no-op invoke）。
      setAutostart: (on) => set((s) => ({ settings: { ...s.settings, autostart: on } })),
      toggleAutostart: () => {
        const next = !get().settings.autostart;
        // ブラウザでは invoke しない（見た目だけ反映）。
        if (!isTauriRuntime()) {
          get().setAutostart(next);
          return;
        }
        // Tauri: Rust command へ委譲。成功時のみ settings を更新（OS 側を正にする）。
        import("@tauri-apps/api/core")
          .then(({ invoke }) => invoke("set_autostart", { enabled: next }))
          .then(() => get().setAutostart(next))
          .catch((e) => console.error("[wish] set_autostart failed", e));
      },
      renameProject: (id, name) => {
        const n = name.trim();
        if (!n) {
          get().flash("プロジェクト名を入力してください");
          return;
        }
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name: n } : p)) }));
        get().flash("プロジェクト名を変更しました");
      },
      setProjectColor: (id, color) => {
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, color } : p)) }));
      },
      delProject: (id) => {
        const s = get();
        if (!s.projects.some((p) => p.id === id)) return;
        const projects = s.projects.filter((p) => p.id !== id);
        // 所属タスクは受信トレイ（project=null, inbox=true）へ退避する。
        const tasks = s.tasks.map((t) =>
          t.project === id ? { ...t, project: null, inbox: !t.done } : t
        );
        // defaultProject / paletteProjectId が消えた ID を指していたら先頭プロジェクト
        // （無ければ受信トレイ＝空文字）へフォールバックする。
        const fallback = projects[0]?.id ?? "";
        const settings =
          s.settings.defaultProject === id ? { ...s.settings, defaultProject: fallback } : s.settings;
        const paletteProjectId = s.paletteProjectId === id ? fallback : s.paletteProjectId;
        // 表示中のビューが消えるプロジェクトなら「今日」へ退避する。
        const view = s.view === id ? "today" : s.view;
        // 詳細・日付編集はプロジェクト変更で開きっぱなしを避けるため閉じる。
        set({ projects, tasks, settings, paletteProjectId, view, detailId: null, editingDateId: null });
        s.flash("プロジェクトを削除しました");
      },
      toggleNotifyDue: () => set((s) => ({ settings: { ...s.settings, notifyDue: !s.settings.notifyDue } })),
      toggleNotifyDaily: () => set((s) => ({ settings: { ...s.settings, notifyDaily: !s.settings.notifyDaily } })),
      startRecording: (which) => set({ recording: which }),
      recordHotkey: (combo) =>
        set((s) => (s.recording ? { settings: { ...s.settings, [s.recording]: combo }, recording: null } : {})),
      cancelRecording: () => set({ recording: null }),

      escape: () =>
        set({
          paletteOpen: false,
          editingDateId: null,
          detailId: null,
          projectDialogOpen: false,
          recording: null,
          expandedMemoId: null,
        }),
    }),
    {
      name: "wish-store",
      // v1: 旧 Project フィールド（recent/stale/staleDays/bars）を剥がす。
      // v2: 旧 Task フィールド（type/sub）を剥がす（種別タグ廃止 D-012 / サブタスク廃止 D-013）。
      version: 2,
      // データのみ永続化。UI の一時状態は保存しない。
      partialize: (s) => ({
        tasks: s.tasks,
        projects: s.projects,
        memos: s.memos,
        settings: s.settings,
        seq: s.seq,
      }),
      // 旧 Project フィールド（recent/stale/staleDays/bars）と旧 Task フィールド（type/sub）を
      // 確実に剥がす。version 非依存・冪等で、入力 persisted を変異させない純粋な整形
      // （src/lib/ の純粋関数方針と一貫）。memos / settings / seq には触れない。
      // v1→v2 も v0→v2 も同じ写像で正しく動く（積み増しでなく冪等な一括整形）。
      // ロジックはユニットテスト可能化のため純粋関数 `migrateState` に切り出している。
      migrate: (persisted) => migrateState(persisted),
    }
  )
);

/**
 * persist の migrate 本体（純粋関数）。version 非依存・冪等で、入力 persisted を
 * 変異させずに旧フィールドを剥がす:
 * - 各 project を { id, name, color } のみへ写像（旧 recent/stale/staleDays/bars を除去）。
 * - 各 task から旧 type / sub を除去し、現行 Task の許容フィールドのみへ写像。
 * memos / settings / seq には触れない。テスト可能化のため named export。
 */
export function migrateState(persisted: unknown): unknown {
  const state = persisted as Partial<DataState> | undefined;
  if (!state) return persisted as DataState;

  const hasProjects = Array.isArray(state.projects);
  const hasTasks = Array.isArray(state.tasks);
  // 旧データに settings.autostart が無い場合は既定 false を補完する（#8 / shallow merge で
  // 旧 settings が seed を置き換えるため、ここで欠損キーを埋める）。
  const settings = state.settings as Settings | undefined;
  const needsAutostart = !!settings && typeof (settings as Partial<Settings>).autostart !== "boolean";
  // 整形対象が無ければ同参照で返す（純粋・冪等、不要なコピーを避ける）。
  if (!hasProjects && !hasTasks && !needsAutostart) return persisted as DataState;

  const out: Record<string, unknown> = { ...state };

  if (needsAutostart) {
    out.settings = { ...(settings as Settings), autostart: false };
  }

  if (hasProjects) {
    out.projects = (state.projects as Project[]).map((p) => {
      const { id, name, color } = p as Project;
      return { id, name, color };
    });
  }

  if (hasTasks) {
    out.tasks = (state.tasks as Task[]).map((t) => {
      // 旧 type / sub を含む可能性のある永続データから、現行 Task の許容フィールドのみ抜き出す。
      const { id, title, project, pri, due, time, done, doneAt, inbox, notes } = t as Task & {
        doneAt?: string | null;
      };
      const task: Task = { id, title, project, pri, due, time, done, inbox, notes };
      if (doneAt !== undefined) task.doneAt = doneAt;
      return task;
    });
  }

  return out as unknown as DataState;
}

/** 右ペインの入力フォームの初期値（受信トレイ・優先度中・日付なし）。 */
function emptyMemoForm(): MemoTaskForm {
  return { title: "", project: null, pri: "med", due: null };
}

function isCoreView(v: ViewId): boolean {
  return v === "today" || v === "inbox" || v === "memos" || v === "dashboard" || v === "archive" || v === "settings";
}

function newTask(
  seq: number,
  p: { title: string; project: string | null; pri: Priority | null; due: string | null; time: string | null; inbox: boolean }
): Task {
  return {
    id: "n" + seq,
    title: p.title,
    project: p.project,
    pri: p.pri || "med",
    due: p.due,
    time: p.time,
    done: false,
    inbox: p.inbox,
    notes: "",
  };
}
