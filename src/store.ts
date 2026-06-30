// アプリ状態とすべてのアクション。プロトタイプ（Wish.dc.html）の Component ロジックを
// React/zustand に移植し、データ部分を localStorage に永続化する。

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Memo, PaletteMode, Priority, Project, Settings, Task, TaskType, ViewId } from "./types";
import { addDays, nextWeekday, today } from "./lib/date";
import { detectCandidates, parse } from "./lib/parse";
import { seedMemos, seedProjects, seedSettings, seedTasks } from "./lib/seed";

let toastTimer: ReturnType<typeof setTimeout> | undefined;

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
  memoSelected: Record<string, boolean>;
  editingDateId: string | null;
  detailId: string | null;
  subInput: string;
  projectDialogOpen: boolean;
  newProjName: string;
  newProjColor: string;
  recording: keyof Pick<Settings, "open" | "add"> | null;
  toast: string | null;
}

interface Actions {
  flash: (msg: string) => void;
  // navigation
  nav: (view: ViewId) => void;
  // tasks
  toggle: (id: string) => void;
  delTask: (id: string) => void;
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
  toggleCandidate: (key: string) => void;
  convertSelected: () => void;
  saveMemo: () => void;
  // memos view
  delMemo: (id: string) => void;
  memoToTask: (id: string) => void;
  // date editor
  openDate: (id: string) => void;
  closeDateEditor: () => void;
  setDueQuick: (kind: string, id?: string) => void;
  pickDay: (iso: string, id?: string) => void;
  // detail
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setDetailNotes: (v: string) => void;
  setSubInput: (v: string) => void;
  addSub: () => void;
  toggleSub: (id: string, idx: number) => void;
  // project dialog
  openProjectDialog: () => void;
  closeProjectDialog: () => void;
  setNewProjName: (v: string) => void;
  setNewProjColor: (c: string) => void;
  addProject: () => void;
  // settings
  setWeekStart: (v: "月" | "日") => void;
  setDefaultProject: (id: string) => void;
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
      memoSelected: {},
      editingDateId: null,
      detailId: null,
      subInput: "",
      projectDialogOpen: false,
      newProjName: "",
      newProjColor: "#1a73e8",
      recording: null,
      toast: null,

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
      toggleCandidate: (key) =>
        set((s) => ({ memoSelected: { ...s.memoSelected, [key]: !s.memoSelected[key] } })),

      convertSelected: () => {
        const s = get();
        const cands = detectCandidates(s.memoText);
        const chosen = cands.filter((c) => s.memoSelected[c.key]);
        const pick = chosen.length ? chosen : cands;
        if (!pick.length) {
          s.flash("タスク候補がありません");
          return;
        }
        let seq = s.seq;
        const proj = s.paletteProjectId;
        const newTasks: Task[] = pick.map((c) => ({
          id: "n" + ++seq,
          title: c.text,
          project: proj,
          type: c.typeText,
          pri: "med",
          due: null,
          time: null,
          done: false,
          inbox: true,
          sub: [],
          notes: "",
        }));
        set((st) => ({ tasks: [...newTasks, ...st.tasks], seq, memoSelected: {} }));
        s.flash(pick.length + "件をタスク化しました（受信トレイへ）");
      },

      saveMemo: () => {
        const s = get();
        const t = s.memoText.trim();
        if (!t) {
          s.flash("メモが空です");
          return;
        }
        const nm: Memo = { id: "me" + (s.seq + 1), text: t, createdAt: today().toISOString() };
        set((st) => ({ memos: [nm, ...st.memos], memoText: "", memoSelected: {}, paletteOpen: false, seq: st.seq + 1 }));
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
          project: s.settings.defaultProject,
          type: "開発",
          pri: "med",
          due: null,
          time: null,
          done: false,
          inbox: true,
          sub: [],
          notes: m.text,
        };
        set((st) => ({ tasks: [nt, ...st.tasks], seq: st.seq + 1 }));
        s.flash("メモをタスク化しました（受信トレイへ）");
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

      openDetail: (id) => set({ detailId: id, subInput: "" }),
      closeDetail: () => set({ detailId: null }),
      setDetailNotes: (v) => {
        const id = get().detailId;
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, notes: v } : t)) }));
      },
      setSubInput: (v) => set({ subInput: v }),
      addSub: () => {
        const s = get();
        const v = s.subInput.trim();
        if (!v) return;
        const id = s.detailId;
        set((st) => ({
          tasks: st.tasks.map((t) => (t.id === id ? { ...t, sub: [...t.sub, { title: v, done: false }] } : t)),
          subInput: "",
        }));
      },
      toggleSub: (id, idx) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, sub: t.sub.map((x, j) => (j === idx ? { ...x, done: !x.done } : x)) } : t
          ),
        })),

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
      toggleNotifyDue: () => set((s) => ({ settings: { ...s.settings, notifyDue: !s.settings.notifyDue } })),
      toggleNotifyDaily: () => set((s) => ({ settings: { ...s.settings, notifyDaily: !s.settings.notifyDaily } })),
      startRecording: (which) => set({ recording: which }),
      recordHotkey: (combo) =>
        set((s) => (s.recording ? { settings: { ...s.settings, [s.recording]: combo }, recording: null } : {})),
      cancelRecording: () => set({ recording: null }),

      escape: () =>
        set({ paletteOpen: false, editingDateId: null, detailId: null, projectDialogOpen: false, recording: null }),
    }),
    {
      name: "wish-store",
      // 旧フィールド（projects[].recent/stale/staleDays/bars）を剥がすため version を上げる。
      version: 1,
      // データのみ永続化。UI の一時状態は保存しない。
      partialize: (s) => ({
        tasks: s.tasks,
        projects: s.projects,
        memos: s.memos,
        settings: s.settings,
        seq: s.seq,
      }),
      // 旧 Project の保存フィールド（recent/stale/staleDays/bars）を確実に剥がし、
      // 各 project を { id, name, color } のみへ写像する。version 非依存・冪等で、
      // 入力 persisted を変異させない純粋な整形（src/lib/ の純粋関数方針と一貫）。
      // tasks / memos / settings / seq には触れない。
      // ロジックはユニットテスト可能化のため純粋関数 `migrateState` に切り出している。
      migrate: (persisted) => migrateState(persisted),
    }
  )
);

/**
 * persist の migrate 本体（純粋関数）。version 非依存・冪等で、入力 persisted を
 * 変異させずに旧 Project フィールド（recent/stale/staleDays/bars）を剥がす。
 * tasks / memos / settings / seq には触れない。テスト可能化のため named export。
 */
export function migrateState(persisted: unknown): unknown {
  const state = persisted as Partial<DataState> | undefined;
  if (!state || !Array.isArray(state.projects)) return persisted as DataState;
  return {
    ...state,
    projects: state.projects.map((p) => {
      const { id, name, color } = p as Project;
      return { id, name, color };
    }),
  } as DataState;
}

function isCoreView(v: ViewId): boolean {
  return v === "today" || v === "inbox" || v === "memos" || v === "dashboard" || v === "archive" || v === "settings";
}

function newTask(
  seq: number,
  p: { title: string; project: string | null; type: TaskType | null; pri: Priority | null; due: string | null; time: string | null; inbox: boolean }
): Task {
  return {
    id: "n" + seq,
    title: p.title,
    project: p.project,
    type: p.type || "開発",
    pri: p.pri || "med",
    due: p.due,
    time: p.time,
    done: false,
    inbox: p.inbox,
    sub: [],
    notes: "",
  };
}
