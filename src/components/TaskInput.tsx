// タスク入力欄（記法サジェスト付き / D-031・spec/feature/task-input-syntax.md）。
// コマンドパレットと各リストのクイック追加で共用する。
//
// @ / # / ! を打つと入力欄の直下に候補が出て、↑↓ と Enter・Tab で確定できる。
// 候補が出ている間の Enter は「候補の確定」で、タスクの追加はしない（誤送信を防ぐ）。

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { useStore } from "../store";
import { activeToken, applySuggestion, suggestFor } from "../lib/suggest";
import type { Suggestion } from "../lib/suggest";

/** ドロップダウンの最大表示件数（超過分はスクロール）。 */
const MAX = 8;

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Enter で確定（サジェストが閉じているときのみ呼ばれる）。shift は「受信トレイへ」。 */
  onSubmit: (shiftKey: boolean) => void;
  placeholder?: string;
  /** input へ渡す追加スタイル。 */
  style?: CSSProperties;
  /** 外からフォーカス制御したい場合に渡す（パレットの自動フォーカス）。 */
  inputRef?: RefObject<HTMLInputElement>;
  /** ラッパー（position:relative）へ渡す追加スタイル。 */
  wrapStyle?: CSSProperties;
  /**
   * 候補を浮かせず、入力欄の下に通常フローで並べる。
   * palette ウィンドウはカードの高さに合わせて OS ウィンドウ自体をリサイズするため
   * （PaletteApp の ResizeObserver）、浮かせるとウィンドウ外にはみ出て切れてしまう。
   */
  inline?: boolean;
}

export function TaskInput({ value, onChange, onSubmit, placeholder, style, inputRef, wrapStyle, inline }: Props) {
  const projects = useStore((s) => s.projects);
  const innerRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? innerRef;

  const [caret, setCaret] = useState(0);
  const [index, setIndex] = useState(0);
  // Esc で閉じた状態。次の入力があるまで候補を出さない。
  const [dismissed, setDismissed] = useState(false);
  // 候補確定後にカーソルを置き直すための予約（value 反映後に適用する）。
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);

  const token = dismissed ? null : activeToken(value, caret);
  const items = token ? suggestFor(token, projects).slice(0, MAX) : [];
  const open = items.length > 0;
  const active = Math.min(index, Math.max(0, items.length - 1));

  // 候補表示中の Esc は「候補だけを閉じる」。App / PaletteApp は window の keydown で
  // Esc を拾ってパレット自体を閉じるため、React の合成イベントで stopPropagation しても
  // 間に合わない。window の capture フェーズで先に捕まえて伝播を止める。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.isComposing) return;
      if (document.activeElement !== ref.current) return;
      e.preventDefault();
      e.stopPropagation();
      setDismissed(true);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, ref]);

  useEffect(() => {
    if (pendingCaret === null) return;
    const el = ref.current;
    if (el) {
      el.focus();
      try {
        el.setSelectionRange(pendingCaret, pendingCaret);
      } catch {
        /* setSelectionRange 非対応時は focus だけで十分。 */
      }
    }
    setCaret(pendingCaret);
    setPendingCaret(null);
    // value 反映後に走らせたいので value も依存に含める。
  }, [pendingCaret, value, ref]);

  /** 入力欄の現在のカーソル位置を state へ取り込む。 */
  function syncCaret(el: HTMLInputElement) {
    setCaret(el.selectionStart ?? el.value.length);
  }

  function accept(s: Suggestion) {
    if (!token) return;
    const next = applySuggestion(value, token, s.insert);
    onChange(next.text);
    setPendingCaret(next.caret);
    setIndex(0);
    setDismissed(false);
  }

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, ...wrapStyle }}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          syncCaret(e.target);
          setIndex(0);
          setDismissed(false);
        }}
        onSelect={(e) => syncCaret(e.currentTarget)}
        onClick={(e) => syncCaret(e.currentTarget)}
        // IME 確定直後もカーソル位置を取り直す（確定で初めて value が確定するため）。
        onCompositionEnd={(e) => syncCaret(e.currentTarget)}
        onKeyDown={(e) => {
          // IME 変換中（未確定）のキーは無視する。日本語入力では Enter が変換確定に
          // 使われるため、ここで拾うと「確定したつもりが追加されていた」が起きる。
          if (e.nativeEvent.isComposing) return;
          if (open) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => (i + 1) % items.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => (i - 1 + items.length) % items.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              accept(items[active]);
              return;
            }
            // Escape は上の capture リスナが先に処理する（ここには届かない）。
          }
          if (e.key === "Enter") onSubmit(e.shiftKey);
        }}
        placeholder={placeholder}
        style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#202124", ...style }}
      />

      {open && (
        <div
          // クリックで入力欄のフォーカスが外れないよう、mousedown を抑止する。
          onMouseDown={(e) => e.preventDefault()}
          style={{
            ...(inline
              ? { marginTop: 10, width: "100%" }
              : {
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  minWidth: 220,
                  maxWidth: 320,
                  boxShadow: "0 6px 20px rgba(60,64,67,0.25)",
                  zIndex: 70,
                }),
            maxHeight: 296,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #e8eaed",
            borderRadius: 10,
            padding: 4,
          }}
        >
          {items.map((s, i) => (
            <div
              key={s.insert + i}
              onClick={() => accept(s)}
              onMouseEnter={() => setIndex(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 7,
                cursor: "pointer",
                background: i === active ? "#e8f0fe" : "transparent",
                color: i === active ? "#1967d2" : "#3c4043",
                fontSize: 13,
              }}
            >
              {s.color && (
                <span style={{ width: 8, height: 8, borderRadius: 3, background: s.color, flex: "none" }} />
              )}
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.label}
              </span>
              {s.hint && <span style={{ fontSize: 12, color: "#80868b" }}>{s.hint}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
