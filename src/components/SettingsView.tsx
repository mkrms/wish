// 設定（ホットキー / 一般 / 起動 / 通知）。
// プロジェクトの名前・色・削除はプロジェクトビューのヘッダー（ListView）へ移動した（B）。
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../store";
import { canUpdate, checkUpdate, currentVersion, installUpdate } from "../lib/update";

const card: CSSProperties = {
  background: "#fff",
  border: "1px solid #e8eaed",
  borderRadius: 14,
  overflow: "hidden",
  marginBottom: 18,
};
const cardHead: CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid #f1f3f4",
  fontSize: 15,
  fontWeight: 500,
};
const row: CSSProperties = { display: "flex", alignItems: "center", padding: "16px 20px" };
const rowB: CSSProperties = { ...row, borderBottom: "1px solid #f1f3f4" };

function hkStyle(active: boolean): CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 500,
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    border: "1px solid " + (active ? "#1a73e8" : "#dadce0"),
    color: active ? "#1a73e8" : "#3c4043",
    background: active ? "#e8f0fe" : "#fff",
    minWidth: 130,
    textAlign: "center",
  };
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 36,
        height: 14,
        borderRadius: 7,
        cursor: "pointer",
        position: "relative",
        flex: "none",
        transition: "background .15s",
        background: on ? "#aecbfa" : "#bdc1c6",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          boxShadow: "0 1px 3px rgba(60,64,67,0.4)",
          transition: "all .15s",
          background: on ? "#1a73e8" : "#fff",
          left: on ? 18 : -2,
        }}
      />
    </div>
  );
}

const selectStyle: CSSProperties = {
  fontSize: 14,
  border: "1px solid #dadce0",
  borderRadius: 8,
  padding: "8px 12px",
  color: "#202124",
  background: "#fff",
  outline: "none",
};

const btnStyle = (primary: boolean, disabled: boolean): CSSProperties => ({
  fontSize: 13,
  fontWeight: 500,
  padding: "8px 16px",
  borderRadius: 8,
  cursor: disabled ? "default" : "pointer",
  border: "1px solid " + (primary ? "#1a73e8" : "#dadce0"),
  background: primary ? "#1a73e8" : "#fff",
  color: primary ? "#fff" : "#3c4043",
  opacity: disabled ? 0.5 : 1,
  minWidth: 110,
});

/** 更新カードの表示状態（仕様: spec/infra/auto-update.md 3.8）。永続化しない。 */
type UpdateState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "available"; version: string }
  | { kind: "downloading"; percent: number | null }
  | { kind: "installing" }
  | { kind: "error" };

function statusText(s: UpdateState): string | null {
  switch (s.kind) {
    case "checking":
      return "確認中…";
    case "latest":
      return "最新版です";
    case "available":
      return `v${s.version} が利用できます`;
    case "downloading":
      return s.percent === null ? "ダウンロード中…" : `ダウンロード中… ${s.percent}%`;
    case "installing":
      return "インストール中…（自動で再起動します）";
    case "error":
      return "更新を確認できませんでした";
    default:
      return null;
  }
}

/**
 * アップデート（D-030）。Tauri 環境でのみ描画する（ブラウザでは更新の手段が無い）。
 * 検知はしてもインストールは必ずユーザーの明示操作（「今すぐ更新」）を起点にする。
 */
function UpdateCard() {
  const autoUpdateCheck = useStore((s) => s.settings.autoUpdateCheck);
  const toggleAutoUpdateCheck = useStore((s) => s.toggleAutoUpdateCheck);
  const updateAvailable = useStore((s) => s.updateAvailable);
  const setUpdateAvailable = useStore((s) => s.setUpdateAvailable);

  const [version, setVersion] = useState<string | null>(null);
  const [state, setState] = useState<UpdateState>(() =>
    updateAvailable ? { kind: "available", version: updateAvailable } : { kind: "idle" }
  );

  // 実行中バージョンの表示（tauri.conf.json の version）。
  useEffect(() => {
    let cancelled = false;
    currentVersion()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 起動時チェックの結果が設定画面より後に届いた場合も拾う（作業中の状態は壊さない）。
  useEffect(() => {
    if (!updateAvailable) return;
    setState((prev) =>
      prev.kind === "idle" || prev.kind === "latest" ? { kind: "available", version: updateAvailable } : prev
    );
  }, [updateAvailable]);

  const busy = state.kind === "checking" || state.kind === "downloading" || state.kind === "installing";

  async function onCheck() {
    setState({ kind: "checking" });
    try {
      const info = await checkUpdate();
      if (info) {
        setUpdateAvailable(info.version);
        setState({ kind: "available", version: info.version });
      } else {
        setUpdateAvailable(null);
        setState({ kind: "latest" });
      }
    } catch (e) {
      console.warn("[wish] update check failed", e);
      setState({ kind: "error" });
    }
  }

  async function onInstall() {
    setState({ kind: "downloading", percent: 0 });
    try {
      // 正常時はインストーラ実行 → relaunch のためここから戻らない。
      await installUpdate((p) => setState(p === 100 ? { kind: "installing" } : { kind: "downloading", percent: p }));
    } catch (e) {
      console.warn("[wish] update install failed", e);
      setState({ kind: "error" });
    }
  }

  const status = statusText(state);
  const isAvailable = state.kind === "available";

  return (
    <div style={{ ...card, marginBottom: 0 }}>
      <div style={cardHead}>アップデート</div>
      <div style={rowB}>
        <div style={{ flex: 1, fontSize: 14 }}>現在のバージョン</div>
        <div style={{ fontSize: 14, color: "#5f6368" }}>{version ?? "—"}</div>
      </div>
      <div style={rowB}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14 }}>起動時に更新を確認</div>
          <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>新しいバージョンがあればお知らせする</div>
        </div>
        <Switch on={autoUpdateCheck} onClick={toggleAutoUpdateCheck} />
      </div>
      <div style={row}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14 }}>更新の確認</div>
          {status && (
            <div style={{ fontSize: 12, color: state.kind === "error" ? "#d93025" : "#80868b", marginTop: 2 }}>
              {status}
            </div>
          )}
        </div>
        <button
          onClick={isAvailable ? onInstall : onCheck}
          disabled={busy}
          style={btnStyle(isAvailable, busy)}
        >
          {isAvailable ? "今すぐ更新" : "更新を確認"}
        </button>
      </div>
    </div>
  );
}

export function SettingsView() {
  const settings = useStore((s) => s.settings);
  const projects = useStore((s) => s.projects);
  const recording = useStore((s) => s.recording);
  const startRecording = useStore((s) => s.startRecording);
  const setWeekStart = useStore((s) => s.setWeekStart);
  const setDefaultProject = useStore((s) => s.setDefaultProject);
  const toggleNotifyDue = useStore((s) => s.toggleNotifyDue);
  const toggleNotifyDaily = useStore((s) => s.toggleNotifyDaily);
  const toggleAutostart = useStore((s) => s.toggleAutostart);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "34px 32px 90px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 400, margin: "0 0 22px" }}>設定</h1>

      {/* ホットキー */}
      <div style={card}>
        <div style={cardHead}>ホットキー</div>
        <div style={rowB}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#202124" }}>クイック起動 / 追加・メモ</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>どの画面からでもWishを呼び出す</div>
          </div>
          <div onClick={() => startRecording("open")} style={hkStyle(recording === "open")}>
            {recording === "open" ? "キーを押す…" : settings.open}
          </div>
        </div>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#202124" }}>アプリ内コマンドパレット</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>Wishにフォーカス中の追加ショートカット</div>
          </div>
          <div onClick={() => startRecording("add")} style={hkStyle(recording === "add")}>
            {recording === "add" ? "キーを押す…" : settings.add}
          </div>
        </div>
      </div>

      {/* 一般 */}
      <div style={card}>
        <div style={cardHead}>一般</div>
        <div style={rowB}>
          <div style={{ flex: 1, fontSize: 14 }}>週の開始曜日</div>
          <select value={settings.weekStart} onChange={(e) => setWeekStart(e.target.value as "月" | "日")} style={selectStyle}>
            <option value="月">月曜</option>
            <option value="日">日曜</option>
          </select>
        </div>
        <div style={row}>
          <div style={{ flex: 1, fontSize: 14 }}>追加時のデフォルトプロジェクト</div>
          <select value={settings.defaultProject} onChange={(e) => setDefaultProject(e.target.value)} style={selectStyle}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 起動 */}
      <div style={card}>
        <div style={cardHead}>起動</div>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14 }}>PC 起動時に Wish を起動</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>サインイン時にバックグラウンド（トレイ）で常駐起動する</div>
          </div>
          <Switch on={settings.autostart} onClick={toggleAutostart} />
        </div>
      </div>

      {/* 通知 */}
      <div style={card}>
        <div style={cardHead}>通知</div>
        <div style={rowB}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14 }}>締切リマインド</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>期限が近いタスクを知らせる</div>
          </div>
          <Switch on={settings.notifyDue} onClick={toggleNotifyDue} />
        </div>
        <div style={row}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14 }}>デイリーサマリー</div>
            <div style={{ fontSize: 12, color: "#80868b", marginTop: 2 }}>毎朝、今日のタスクをまとめて表示</div>
          </div>
          <Switch on={settings.notifyDaily} onClick={toggleNotifyDaily} />
        </div>
      </div>

      {/* アップデート（Tauri 環境のみ。ブラウザでは更新の手段が無いので出さない） */}
      {canUpdate() && <UpdateCard />}
    </div>
  );
}
