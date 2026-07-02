// リストビュー（今日 / 受信トレイ / 完了済み / プロジェクト別）。
import { useState } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../store";
import { diffDays, endOfWeek, fmtHeaderDate } from "../lib/date";
import { sortTasks } from "../lib/sort";
import type { Project, SortDir, SortKey, Task } from "../types";
import { SWATCHES } from "../lib/seed";
import { Icon } from "./Icon";
import { TaskRow } from "./TaskRow";

export function ListView() {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const view = useStore((s) => s.view);
  const weekStart = useStore((s) => s.settings.weekStart);
  const sortKey = useStore((s) => s.settings.sortKey);
  const sortDir = useStore((s) => s.settings.sortDir);
  const quickInput = useStore((s) => s.quickInput);
  const setQuickInput = useStore((s) => s.setQuickInput);
  const submitQuick = useStore((s) => s.submitQuick);
  const toggle = useStore((s) => s.toggle);
  const openDetail = useStore((s) => s.openDetail);

  // クイック追加の投入先プロジェクト。プロジェクトビューならそのプロジェクト、
  // それ以外（今日/受信トレイ/完了済み）は既定を受信トレイ（未仕分け＝null）にする。
  // ListView は App 側で key={view} により view 毎に remount され、初期値がリセットされる。
  const [quickProject, setQuickProject] = useState<string | null>(
    projects.some((p) => p.id === view) ? view : null
  );

  const open = tasks.filter((t) => !t.done && !t.inbox);
  const doneToday = tasks.filter((t) => t.done && t.doneAt && diffDays(t.doneAt) === 0);

  // 「今日」画面は日付軸で 期限切れ / 今日 / 今週 に振り分ける（期限なし・来週以降は出さない）。
  // 週末は設定 weekStart 基準（endOfWeek）。
  const eowDays = diffDays(endOfWeek(weekStart));
  const overdue = open.filter((t) => t.due && diffDays(t.due) < 0);
  const dueToday = open.filter((t) => t.due && diffDays(t.due) === 0);
  const dueThisWeek = open.filter((t) => {
    if (!t.due) return false;
    const d = diffDays(t.due);
    return d > 0 && d <= eowDays;
  });
  // 期限なしも表示する（最下部の控えめなセクション）。来週以降の期限つきは今日画面には出さない。
  const noDue = open.filter((t) => !t.due);
  const todayCount = overdue.length + dueToday.length + dueThisWeek.length + noDue.length;

  let listTasks = open;
  let listTitle = "今日";
  let listSub = "";
  let listDate = "";
  let focusLabel = "フォーカス";
  let emptyMsg = "";
  const isArchive = view === "archive";
  // プロジェクトビューのときだけヘッダー（名前編集・色・削除）を出す。
  const curProject = projects.find((x) => x.id === view) ?? null;

  if (view === "today") {
    listTitle = "タスク";
    listDate = fmtHeaderDate();
    listSub = "残り " + todayCount + "件";
    emptyMsg = "タスクはありません。お疲れさまでした。";
  } else if (view === "inbox") {
    listTasks = tasks.filter((t) => t.inbox && !t.done);
    listTitle = "受信トレイ";
    listSub = listTasks.length + "件";
    listDate = "あとで整理する未仕分けのタスク";
    focusLabel = "未整理";
    emptyMsg = "受信トレイは空です。";
  } else if (view === "archive") {
    listTasks = tasks.filter((t) => t.done);
    listTitle = "完了済み";
    listSub = listTasks.length + "件";
    listDate = "これまで積み上げてきた記録";
    focusLabel = "完了済み";
    emptyMsg = "まだ完了タスクがありません。";
  } else {
    const p = projects.find((x) => x.id === view);
    listTasks = open.filter((t) => t.project === view);
    listTitle = p ? p.name : "";
    listSub = "未対応 " + listTasks.length + "件";
    listDate = "このプロジェクトでの自分の担当";
    emptyMsg = "未対応タスクはありません。";
  }

  const isToday = view === "today";
  const timed = listTasks.filter((t) => t.time);
  const focus = listTasks.filter((t) => !t.time);
  const listEmpty = isToday ? todayCount === 0 : timed.length + focus.length === 0 && !isArchive;
  const hasDoneToday = isToday && doneToday.length > 0;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "34px 32px 90px" }}>
      {curProject ? (
        // key で remount し、別プロジェクトへ切替時に名前の下書き state を確実にリセットする。
        <ProjectHeader key={curProject.id} project={curProject} sub={listSub} />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 400, color: "#202124", margin: 0, letterSpacing: 0 }}>{listTitle}</h1>
            <div style={{ flex: 1 }} />
            <SortControl />
            <div style={{ fontSize: 13, color: "#5f6368" }}>{listSub}</div>
          </div>
          <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 22 }}>{listDate}</div>
        </>
      )}

      {/* quick add */}
      <div
        className="quickadd"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#f1f3f4",
          borderRadius: 10,
          padding: "12px 16px",
          marginBottom: 24,
        }}
      >
        <Icon name="add" size={22} color="#1a73e8" />
        <input
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitQuick(quickProject);
          }}
          placeholder="タスクを追加  例: 金曜まで 障害報告書 #顧客A !高"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#202124", fontSize: 14 }}
        />
        <select
          value={quickProject ?? ""}
          onChange={(e) => setQuickProject(e.target.value === "" ? null : e.target.value)}
          title="追加先プロジェクト"
          style={{
            fontSize: 12,
            color: "#3c4043",
            background: "#fff",
            border: "1px solid #dadce0",
            borderRadius: 7,
            padding: "5px 8px",
            outline: "none",
            maxWidth: 160,
          }}
        >
          <option value="">受信トレイ</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: "#80868b", border: "1px solid #dadce0", padding: "2px 7px", borderRadius: 5 }}>
          Enter
        </span>
      </div>

      {isToday ? (
        // 「今日」画面: 期限切れ / 今日 / 今週 / 期限なし のセクション（来週以降の期限つきは出さない）。
        // 各セクション内を選択中の並び順で並べる（既定 added は時間指定→期限近い順を維持）。
        <TodaySections
          overdue={overdue}
          dueToday={dueToday}
          dueThisWeek={dueThisWeek}
          noDue={noDue}
          sortKey={sortKey}
          sortDir={sortDir}
        />
      ) : sortKey === "added" ? (
        // 既定（追加順）: 従来の 時間指定 / フォーカス の2ブロック表示。
        <>
          {timed.length > 0 && (
            <>
              <div style={sectionLabel}>時間指定</div>
              {timed.map((t) => (
                <TaskRow key={t.id} task={t} variant="timed" />
              ))}
              <div style={{ height: 18 }} />
            </>
          )}

          {focus.length > 0 && (
            <>
              <div style={sectionLabel}>{focusLabel}</div>
              {focus.map((t) => (
                <TaskRow key={t.id} task={t} variant="focus" />
              ))}
            </>
          )}
        </>
      ) : (
        // 明示的な並び順（優先度 / 期限日）: 分割せず1リストで並べる。
        <>
          <div style={sectionLabel}>{focusLabel}</div>
          {sortTasks(listTasks, sortKey, sortDir).map((t) => (
            <TaskRow key={t.id} task={t} variant={t.time ? "timed" : "focus"} />
          ))}
        </>
      )}

      {listEmpty && (
        <div style={{ textAlign: "center", padding: "70px 0", color: "#9aa0a6" }}>
          <Icon name="check_circle" size={46} color="#dadce0" />
          <div style={{ fontSize: 14, marginTop: 12 }}>{emptyMsg}</div>
        </div>
      )}

      {/* done today */}
      {hasDoneToday && (
        <>
          <div style={{ ...sectionLabel, margin: "26px 0 6px" }}>完了 · {doneToday.length}</div>
          {doneToday.map((t) => (
            <div
              key={t.id}
              className="task-row"
              onClick={() => openDetail(t.id)}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 10px", borderRadius: 10, cursor: "pointer" }}
            >
              <Icon
                name="check_circle"
                size={22}
                color="#1e8e3e"
                style={{ flex: "none", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(t.id);
                }}
              />
              <span style={{ fontSize: 14, flex: 1, color: "#80868b", textDecoration: "line-through" }}>{t.title}</span>
              <span style={{ fontSize: 12, color: "#9aa0a6" }}>{t.doneAt ? "完了" : ""}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/**
 * プロジェクトビューのヘッダー（B）。名前のインライン編集 + 色スウォッチ + 削除。
 * 削除は簡易な確認（confirm 風のインライン確認）を挟み、誤削除を防ぐ。
 */
function ProjectHeader({ project, sub }: { project: Project; sub: string }) {
  const renameProject = useStore((s) => s.renameProject);
  const setProjectColor = useStore((s) => s.setProjectColor);
  const delProject = useStore((s) => s.delProject);

  const [name, setName] = useState(project.name);
  const [showColors, setShowColors] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const commitName = () => {
    const next = name.trim();
    if (!next || next === project.name) {
      setName(project.name);
      return;
    }
    renameProject(project.id, next);
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {/* 色スウォッチ（クリックでパレット開閉） */}
        <div style={{ position: "relative", flex: "none" }}>
          <span
            onClick={() => setShowColors((v) => !v)}
            title="色を変更"
            style={{ display: "block", width: 18, height: 18, borderRadius: 6, background: project.color, cursor: "pointer", boxShadow: "0 0 0 1px rgba(0,0,0,0.06)" }}
          />
          {showColors && (
            <div
              style={{
                position: "absolute",
                top: 26,
                left: 0,
                zIndex: 30,
                display: "flex",
                gap: 8,
                background: "#fff",
                border: "1px solid #e8eaed",
                borderRadius: 10,
                padding: 10,
                boxShadow: "0 8px 24px rgba(60,64,67,0.18)",
              }}
            >
              {SWATCHES.map((c) => (
                <span
                  key={c}
                  onClick={() => {
                    setProjectColor(project.id, c);
                    setShowColors(false);
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: c,
                    cursor: "pointer",
                    boxShadow: project.color === c ? "0 0 0 2px #fff,0 0 0 4px " + c : "none",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 名前インライン編集 */}
        <input
          className="input-focus proj-name-edit"
          data-proj-name={project.id}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            else if (e.key === "Escape") {
              setName(project.name);
              (e.target as HTMLInputElement).blur();
            }
          }}
          style={{
            fontSize: 28,
            fontWeight: 400,
            color: "#202124",
            border: "1px solid transparent",
            borderRadius: 8,
            padding: "2px 8px",
            outline: "none",
            background: "transparent",
            minWidth: 120,
            maxWidth: 420,
          }}
        />

        <div style={{ flex: 1 }} />
        <SortControl />
        <div style={{ fontSize: 13, color: "#5f6368" }}>{sub}</div>
        {/* 削除 */}
        <Icon
          name="delete"
          size={20}
          color="#9aa0a6"
          className="del-icon"
          title="プロジェクトを削除"
          style={{ cursor: "pointer", padding: 4, borderRadius: 8 }}
          onClick={() => setConfirmDel(true)}
        />
      </div>
      <div style={{ fontSize: 13, color: "#5f6368", paddingLeft: 8 }}>このプロジェクトでの自分の担当</div>

      {confirmDel && (
        <div
          style={{
            marginTop: 12,
            background: "#fef7f6",
            border: "1px solid #f3c9c4",
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Icon name="warning" size={18} color="#d93025" />
          <span style={{ fontSize: 13, color: "#3c4043", flex: 1 }}>
            「{project.name}」を削除します。所属タスクは受信トレイへ移動します。
          </span>
          <button
            onClick={() => setConfirmDel(false)}
            style={{ border: "1px solid #dadce0", background: "#fff", color: "#3c4043", fontSize: 13, fontWeight: 500, padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}
          >
            キャンセル
          </button>
          <button
            onClick={() => {
              setConfirmDel(false);
              delProject(project.id);
            }}
            style={{ border: "none", background: "#d93025", color: "#fff", fontSize: 13, fontWeight: 500, padding: "7px 16px", borderRadius: 8, cursor: "pointer" }}
          >
            削除する
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 「今日」画面のセクション表示（期限切れ / 今日 / 今週 / 期限なし）。
 * 各セクションは時間指定を時刻順で先頭に、その他を締切の近い順に並べる。空セクションは出さない。
 * セクションはラベルクリックで折りたたみ可能（初期は全展開）。
 */
function TodaySections({
  overdue,
  dueToday,
  dueThisWeek,
  noDue,
  sortKey,
  sortDir,
}: {
  overdue: Task[];
  dueToday: Task[];
  dueThisWeek: Task[];
  noDue: Task[];
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  // 折りたたみ状態（key→true で折りたたみ）。初期は空＝全展開。
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // 既定（追加順）はセクション内の従来並び（時間指定→期限近い順）を維持。
  // 優先度 / 期限日を選んだときはその基準でセクション内を並べ替える。
  const order = (arr: Task[]) => (sortKey === "added" ? sortSection(arr) : sortTasks(arr, sortKey, sortDir));

  const sections = [
    { key: "overdue", label: "期限切れ", danger: true, tasks: overdue },
    { key: "today", label: "今日", danger: false, tasks: dueToday },
    { key: "week", label: "今週", danger: false, tasks: dueThisWeek },
    { key: "nodue", label: "期限なし", danger: false, tasks: noDue },
  ];
  return (
    <>
      {sections
        .filter((s) => s.tasks.length > 0)
        .map((s) => {
          const isCollapsed = !!collapsed[s.key];
          const color = s.danger ? "#d93025" : "#80868b";
          return (
            <div key={s.key} style={{ marginBottom: 18 }}>
              <div
                onClick={() => toggle(s.key)}
                style={{ ...sectionLabel, color, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, userSelect: "none" }}
              >
                <Icon name={isCollapsed ? "chevron_right" : "expand_more"} size={16} color={color} />
                {s.label} · {s.tasks.length}
              </div>
              {!isCollapsed &&
                order(s.tasks).map((t) => (
                  <TaskRow key={t.id} task={t} variant={t.time ? "timed" : "focus"} />
                ))}
            </div>
          );
        })}
    </>
  );
}

/**
 * 追加順（既定）でのセクション内並び: 時間指定（時刻昇順）→ その他。
 * その他は締切の近い順（due あり優先）、期限なし同士は元の順序を保つ。
 */
function sortSection(arr: Task[]): Task[] {
  const timed = arr.filter((t) => t.time).sort((a, b) => (a.time! < b.time! ? -1 : a.time! > b.time! ? 1 : 0));
  const rest = arr
    .filter((t) => !t.time)
    .sort((a, b) => {
      if (a.due && b.due) return diffDays(a.due) - diffDays(b.due);
      if (a.due) return -1;
      if (b.due) return 1;
      return 0;
    });
  return [...timed, ...rest];
}

/** ヘッダーの並び替えコントロール（並び順セレクト＋昇順/降順トグル）。全ビュー共通・永続化。 */
function SortControl() {
  const sortKey = useStore((s) => s.settings.sortKey);
  const sortDir = useStore((s) => s.settings.sortDir);
  const setSortKey = useStore((s) => s.setSortKey);
  const toggleSortDir = useStore((s) => s.toggleSortDir);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <select
        value={sortKey}
        onChange={(e) => setSortKey(e.target.value as SortKey)}
        title="並び順"
        style={{
          fontSize: 12,
          color: "#3c4043",
          background: "#fff",
          border: "1px solid #dadce0",
          borderRadius: 7,
          padding: "5px 8px",
          outline: "none",
        }}
      >
        <option value="added">追加順</option>
        <option value="priority">優先度順</option>
        <option value="due">期限日順</option>
      </select>
      <Icon
        name={sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
        size={18}
        color="#5f6368"
        className="icon-btn"
        title={sortDir === "asc" ? "昇順（クリックで降順）" : "降順（クリックで昇順）"}
        style={{ cursor: "pointer", padding: 5, borderRadius: 8 }}
        onClick={toggleSortDir}
      />
    </div>
  );
}

const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.6px",
  color: "#80868b",
  textTransform: "uppercase",
  marginBottom: 6,
};
