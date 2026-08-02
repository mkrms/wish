// コマンドパレット（追加・メモ）。タスクモードは自然言語解析、メモモードは本文保存のみ。
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { useStore } from "../store";
import { Icon } from "./Icon";
import { ParsePreview } from "./ParsePreview";
import { TaskInput } from "./TaskInput";
import { isPaletteWindow, isTauri } from "../tauri";

/** Tauri: palette ウィンドウを hide する（送信後・閉じる時）。 */
async function hidePalette(): Promise<void> {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  } catch (e) {
    console.error("[wish] hide palette failed", e);
  }
}

/** Tauri: main ウィンドウをフルUIで表示し、palette を hide する（#4 フルUIを開く導線）。 */
async function openMainUi(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("show_main");
  } catch (e) {
    console.error("[wish] show_main failed", e);
  }
  await hidePalette();
}

export function CapturePalette() {
  const mode = useStore((s) => s.paletteMode);
  const projects = useStore((s) => s.projects);
  const paletteInput = useStore((s) => s.paletteInput);
  const paletteProjectId = useStore((s) => s.paletteProjectId);
  const memoText = useStore((s) => s.memoText);
  const closePalette = useStore((s) => s.closePalette);
  const setMode = useStore((s) => s.setMode);
  const setPaletteInput = useStore((s) => s.setPaletteInput);
  const setPaletteProjectId = useStore((s) => s.setPaletteProjectId);
  const submitPaletteTask = useStore((s) => s.submitPaletteTask);
  const setMemoText = useStore((s) => s.setMemoText);
  const saveMemo = useStore((s) => s.saveMemo);
  // openPalette 毎に +1 されるノンス。palette 窓は常時マウントで再表示時に autoFocus が
  // 再発火しないため、これを依存にして入力欄へ明示 focus を当て直す（ホットキー起動時の自動フォーカス）。
  const paletteSeq = useStore((s) => s.paletteSeq);

  // 専用 palette ウィンドウ内か（Tauri 2ウィンドウ構成）。ブラウザ/main では false。
  const inPalette = isPaletteWindow();

  // 現在のモードの入力欄へフォーカスを当てる。paletteSeq 変化（＝起動/再表示）と
  // モード切替（タスク⇄メモ）の双方で再適用。ブラウザ・palette 窓の両経路で堅牢に効く。
  const taskInputRef = useRef<HTMLInputElement>(null);
  const memoRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = mode === "task" ? taskInputRef.current : memoRef.current;
    if (!el) return;
    // 描画直後・ウィンドウ表示直後に確実に当てるため次フレームで focus する。
    const raf = requestAnimationFrame(() => {
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* 一部要素は setSelectionRange 非対応。focus だけで十分。 */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [mode, paletteSeq]);

  // palette ウィンドウでは送信/保存後にウィンドウ自体も hide する（store は paletteOpen を false にするのみ）。
  const submitTask = (toInbox: boolean) => {
    submitPaletteTask(toInbox);
    if (inPalette) void hidePalette();
  };
  const submitMemo = () => {
    saveMemo();
    if (inPalette) void hidePalette();
  };
  // 閉じる操作: ブラウザは overlay を閉じるだけ、palette ウィンドウは window を hide。
  const onClose = () => {
    closePalette();
    if (inPalette) void hidePalette();
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    fontSize: 13,
    padding: "7px 16px",
    borderRadius: 6,
    cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: active ? "#1967d2" : "#5f6368",
    fontWeight: active ? 500 : 400,
    boxShadow: active ? "0 1px 2px rgba(60,64,67,0.15)" : undefined,
  });

  // パレットカード本体。palette ウィンドウでは透過ウィンドウ内のソリッドな小窓カードとして描画し、
  // ブラウザ/main では従来どおり暗幕オーバーレイの中央に浮かべる。
  // inPalette のときはカードを完全不透明（#fff・角丸・影）にし、カード外（ウィンドウ余白）だけ透過にする。
  const card = (
      <div
        data-palette-card
        onClick={(e) => e.stopPropagation()}
        style={{
          marginTop: inPalette ? 0 : 72,
          width: inPalette ? "100%" : 640,
          maxWidth: inPalette ? "100%" : "92vw",
          // palette ではカードはコンテンツ高さに合わせる（ウィンドウ自体を PaletteApp が
          // カード高さへ自動リサイズするので余白・半透明の halo が出ない）。
          maxHeight: undefined,
          background: "#fff",
          borderRadius: 16,
          boxShadow: inPalette ? "0 10px 40px rgba(0,0,0,0.35)" : "0 24px 60px rgba(60,64,67,0.3)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "pop 0.16s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid #f1f3f4" }}>
          <div style={{ display: "flex", background: "#f1f3f4", borderRadius: 8, padding: 3 }}>
            <div onClick={() => setMode("task")} style={tabStyle(mode === "task")}>
              タスク
            </div>
            <div onClick={() => setMode("memo")} style={tabStyle(mode === "memo")}>
              メモ
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <select
            value={paletteProjectId}
            onChange={(e) => setPaletteProjectId(e.target.value)}
            style={{ fontSize: 13, background: "#fff", border: "1px solid #dadce0", color: "#3c4043", padding: "7px 11px", borderRadius: 8, outline: "none" }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {mode === "task" ? (
          <>
            {/* 候補は inline（カード内）に出す。カード高さに合わせて palette ウィンドウが
                リサイズされるため、浮かせるとウィンドウ外で切れてしまう。 */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 20px" }}>
              <span style={{ display: "flex", height: 27, alignItems: "center", flex: "none" }}>
                <Icon name="bolt" size={24} color="#1a73e8" />
              </span>
              <TaskInput
                inline
                inputRef={taskInputRef}
                value={paletteInput}
                onChange={setPaletteInput}
                onSubmit={submitTask}
                placeholder="設計レビュー @明日 @15:00 #ECサイト !高"
                style={{ fontSize: 18, height: 27 }}
              />
            </div>
            {/* 未入力のときは記法ヒント、入力中は解析プレビュー（D-031）。 */}
            {paletteInput.trim() ? (
              <ParsePreview input={paletteInput} style={{ padding: "0 20px 14px" }} />
            ) : (
              <div style={{ padding: "0 20px 14px", fontSize: 12, color: "#9aa0a6" }}>
                <b style={{ color: "#5f6368" }}>@</b> 日付・時刻{" ・ "}
                <b style={{ color: "#5f6368" }}>#</b> プロジェクト{" ・ "}
                <b style={{ color: "#5f6368" }}>!</b> 優先度{"　（入力すると候補が出ます）"}
              </div>
            )}
            <div style={footer}>
              <span onClick={() => submitTask(false)} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#1a73e8", cursor: "pointer", fontWeight: 500 }}>
                <span style={{ background: "#e8f0fe", padding: "2px 7px", borderRadius: 5 }}>Enter</span> タスクを追加
              </span>
              <span>
                <b style={{ color: "#5f6368", fontWeight: 500 }}>Shift+Enter</b> 受信トレイへ
              </span>
              <div style={{ flex: 1 }} />
              {isTauri() && (
                <span onClick={() => void openMainUi()} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#5f6368", cursor: "pointer" }}>
                  <Icon name="open_in_full" size={14} /> フルUIを開く
                </span>
              )}
              <span>
                <b style={{ color: "#5f6368", fontWeight: 500 }}>Esc</b> 閉じる
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: inPalette ? "12px 16px 4px" : "16px 18px 6px" }}>
              <textarea
                ref={memoRef}
                className="memo-ta"
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder={"会議や設計のメモをそのまま流し込む…\n・決定事項、論点、TODO を混在でOK\n・⌘S で記録として保存"}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  // palette（高さ 300px の小窓）ではカード内に収まる高さにし、はみ出しは内部スクロール。
                  height: inPalette ? 150 : 180,
                  resize: "none",
                  overflowY: "auto",
                  background: "#f8f9fa",
                  border: "1px solid #e8eaed",
                  borderRadius: 10,
                  color: "#3c4043",
                  fontSize: 14,
                  lineHeight: 1.7,
                  padding: "12px 14px",
                  outline: "none",
                }}
              />
            </div>
            <div style={footer}>
              <span onClick={submitMemo} style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#1a73e8", cursor: "pointer", fontWeight: 500 }}>
                <span style={{ background: "#e8f0fe", padding: "2px 7px", borderRadius: 5 }}>⌘S</span> メモとして保存
              </span>
              <div style={{ flex: 1 }} />
              {isTauri() && (
                <span onClick={() => void openMainUi()} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#5f6368", cursor: "pointer" }}>
                  <Icon name="open_in_full" size={14} /> フルUIを開く
                </span>
              )}
              <span>
                <b style={{ color: "#5f6368", fontWeight: 500 }}>Esc</b> 閉じる
              </span>
            </div>
          </>
        )}
      </div>
  );

  // palette ウィンドウ: 暗幕も余白も描かず、カードだけをウィンドウいっぱいに置く。
  // ウィンドウ自体を PaletteApp がカード高さへリサイズするため、背後に半透明の領域は出ない。
  if (inPalette) {
    return (
      <div style={{ background: "transparent", overflow: "hidden", animation: "fade 0.12s ease" }}>
        {card}
      </div>
    );
  }

  // ブラウザ/main: 従来どおり暗幕オーバーレイ。背景クリックで閉じる。
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(32,33,36,0.4)",
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        animation: "fade 0.12s ease",
      }}
    >
      {card}
    </div>
  );
}

const footer: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  padding: "12px 20px",
  borderTop: "1px solid #f1f3f4",
  fontSize: 12,
  color: "#80868b",
};
