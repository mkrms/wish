// ダッシュボード（俯瞰と成長の可視化）。
// 進捗率は出さず、自分視点の4指標（未対応 / 期限間近 / 直近2週の動き / 次の締切）で見る。
import { useStore } from "../store";
import { diffDays, dueColor, fmtDue, today } from "../lib/date";
import {
  computeStreak,
  heatmap,
  periodComparison,
  projectMetrics,
  typeBreakdown,
} from "../lib/metrics";
import type { TaskType } from "../types";

// 種別内訳の表示順・ラベル・色（描画側の責務）。
const BREAKDOWN_META: { type: TaskType; label: string; color: string }[] = [
  { type: "開発", label: "開発", color: "#1a73e8" },
  { type: "設計", label: "設計", color: "#12b5cb" },
  { type: "DOC", label: "DOC", color: "#f9ab00" },
  { type: "MTG", label: "MTG", color: "#9334e6" },
];

export function DashboardView() {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);

  const now = today();
  const open = tasks.filter((t) => !t.done && !t.inbox);
  const streak = computeStreak(tasks, now);
  const period = periodComparison(tasks, 14, now);
  const total14 = period.current;
  const deltaPct = period.deltaPct;

  // ヒートマップ（直近42日の日別完了件数）。表示用の透明度は最大値正規化で描画側が算出。
  const heat = heatmap(tasks, 42, now);
  const heatMax = Math.max(1, ...heat);

  // 種別内訳（直近14日の完了タスクの件数）。バー幅は最大件数を 100% とした相対量。
  const breakdown = typeBreakdown(tasks, { days: 14, now });
  const breakdownMax = Math.max(1, ...BREAKDOWN_META.map((b) => breakdown[b.type]));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "34px 32px 90px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 4px" }}>ダッシュボード</h1>
      <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 22 }}>自分の歩みと、関わっている案件をひと目で</div>

      {/* growth hero */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e8eaed",
          borderRadius: 16,
          padding: "22px 24px",
          display: "flex",
          gap: 26,
          alignItems: "center",
          marginBottom: 20,
          boxShadow: "0 1px 2px rgba(60,64,67,0.06)",
        }}
      >
        <div style={{ flex: "none", textAlign: "center", paddingRight: 24, borderRight: "1px solid #e8eaed" }}>
          <div style={{ fontSize: 12, color: "#5f6368", marginBottom: 6 }}>連続記録</div>
          <div>
            <span style={{ fontSize: 52, fontWeight: 500, color: "#1a73e8", lineHeight: 1 }}>{streak}</span>
          </div>
          <div style={{ fontSize: 12, color: "#5f6368", marginTop: 2 }}>日連続</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: "#5f6368" }}>この14日の歩み</div>
            <div style={{ flex: 1 }} />
            <div>
              <span style={{ fontSize: 18, fontWeight: 500, color: "#202124" }}>{total14}</span>
              <span style={{ fontSize: 12, color: "#5f6368", marginLeft: 4 }}>完了</span>
            </div>
            <div>
              {deltaPct === null ? (
                <span style={{ fontSize: 13, fontWeight: 500, color: "#80868b" }}>—</span>
              ) : (
                <span
                  style={{ fontSize: 18, fontWeight: 500, color: deltaPct >= 0 ? "#1e8e3e" : "#d93025" }}
                >
                  {deltaPct >= 0 ? "+" : ""}
                  {deltaPct}%
                </span>
              )}
              <span style={{ fontSize: 12, color: "#5f6368", marginLeft: 4 }}>
                {deltaPct === null ? "比較なし" : "前期間比"}
              </span>
            </div>
          </div>
          {/* ヒートマップ（直近42日の日別完了件数を 7行×6列で表示）。
              現状は配列順（古い→新しい）を縦7マスで折り返すだけで、各行が特定の曜日に
              揃ってはいない。曜日×週への厳密な整列（weekStart 連動）は将来拡張。 */}
          <div
            style={{
              display: "grid",
              gridTemplateRows: "repeat(7,11px)",
              gridAutoFlow: "column",
              gridAutoColumns: "11px",
              gap: 4,
            }}
          >
            {heat.map((v, i) => (
              <span
                key={i}
                style={{ borderRadius: 3, background: `rgba(26,115,232,${Math.max(0.08, v / heatMax)})` }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
            {BREAKDOWN_META.map((b) => {
              const val = breakdown[b.type];
              const pct = Math.round((val / breakdownMax) * 100);
              return (
                <div key={b.type} style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5f6368", marginBottom: 4 }}>
                    <span>{b.label}</span>
                    <span>{val}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: "#f1f3f4", overflow: "hidden" }}>
                    <div style={{ width: pct + "%", height: "100%", background: b.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: "#5f6368", marginBottom: 4 }}>関わっているプロジェクト</div>
      <div style={{ fontSize: 12, color: "#9aa0a6", marginBottom: 12 }}>自分が抱える数・期限・動きで見る（進捗率は出しません）</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 18px 8px" }}>
        <div style={{ width: 160, flex: "none" }} />
        <div style={{ width: 54, flex: "none", textAlign: "center", fontSize: 11, color: "#80868b" }}>未対応</div>
        <div style={{ width: 62, flex: "none", textAlign: "center", fontSize: 11, color: "#80868b" }}>期限間近</div>
        <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "#80868b" }}>直近2週の動き</div>
        <div style={{ width: 84, flex: "none", textAlign: "right", fontSize: 11, color: "#80868b" }}>次の締切</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {projects.map((p) => {
          const po = open.filter((t) => t.project === p.id);
          const dueSoon = po.filter((t) => t.due && diffDays(t.due) <= 3);
          const withDue = po.filter((t) => t.due).sort((a, b) => +new Date(a.due!) - +new Date(b.due!));
          const next = withDue[0];
          const urgent = dueSoon.some((t) => diffDays(t.due!) <= 0);
          const pm = projectMetrics(tasks, p.id, { now });
          const maxBar = Math.max(1, ...pm.bars);
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "#fff",
                borderRadius: 12,
                padding: "14px 18px",
                border: "1px solid " + (pm.stale ? "#feefc3" : "#e8eaed"),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, width: 160, flex: "none" }}>
                <span style={{ width: 11, height: 11, borderRadius: 4, background: p.color }} />
                <span style={{ fontSize: 14, fontWeight: 500, color: "#202124" }}>{p.name}</span>
              </div>
              <div style={{ width: 54, flex: "none", textAlign: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 500 }}>{po.length}</span>
              </div>
              <div style={{ width: 62, flex: "none", textAlign: "center" }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: dueSoon.length ? (urgent ? "#d93025" : "#b06000") : "#bdc1c6",
                  }}
                >
                  {dueSoon.length}
                </span>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
                {pm.stale ? (
                  <>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        color: "#b06000",
                        background: "#fef7e0",
                        border: "1px solid #feefc3",
                        padding: "4px 10px",
                        borderRadius: 8,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span className="ms" style={{ fontSize: 15 }}>
                        search
                      </span>
                      棚卸し推奨
                    </span>
                    <span style={{ fontSize: 11, color: "#9aa0a6", whiteSpace: "nowrap" }}>{pm.staleDays}日</span>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22 }}>
                      {pm.bars.map((v, idx) => (
                        <span
                          key={idx}
                          style={{
                            width: 4,
                            borderRadius: 2,
                            height: Math.max(3, Math.round((v / maxBar) * 22)),
                            background:
                              idx === pm.bars.length - 1
                                ? "#1a73e8"
                                : `rgba(26,115,232,${(0.35 + 0.45 * (v / maxBar)).toFixed(2)})`,
                          }}
                        />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: "#1e8e3e", fontWeight: 500 }}>↗ +{pm.recent}</span>
                  </>
                )}
              </div>
              <div style={{ width: 84, flex: "none", textAlign: "right" }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: next ? dueColor(next.due) : "#bdc1c6" }}>
                  {next ? fmtDue(next.due) : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
