// プロジェクト追加ダイアログ（名前＋カラー）。
import { useStore } from "../store";
import { SWATCHES } from "../lib/seed";

export function AddProjectDialog() {
  const newProjName = useStore((s) => s.newProjName);
  const newProjColor = useStore((s) => s.newProjColor);
  const setNewProjName = useStore((s) => s.setNewProjName);
  const setNewProjColor = useStore((s) => s.setNewProjColor);
  const addProject = useStore((s) => s.addProject);
  const closeProjectDialog = useStore((s) => s.closeProjectDialog);

  return (
    <div
      onClick={closeProjectDialog}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(32,33,36,0.4)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fade 0.12s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "92vw",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(60,64,67,0.3)",
          padding: 24,
          animation: "pop 0.16s ease",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 400, marginBottom: 18 }}>新しいプロジェクト</div>
        <input
          className="input-focus"
          value={newProjName}
          onChange={(e) => setNewProjName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addProject();
          }}
          placeholder="プロジェクト名"
          autoFocus
          style={{
            width: "100%",
            border: "1px solid #dadce0",
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 15,
            outline: "none",
            marginBottom: 18,
          }}
        />
        <div style={{ fontSize: 12, color: "#5f6368", marginBottom: 10 }}>カラー</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {SWATCHES.map((c) => (
            <span
              key={c}
              onClick={() => setNewProjColor(c)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                cursor: "pointer",
                background: c,
                boxShadow: newProjColor === c ? "0 0 0 2px #fff,0 0 0 4px " + c : "none",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            className="text-btn"
            onClick={closeProjectDialog}
            style={{
              border: "none",
              background: "transparent",
              color: "#1a73e8",
              fontSize: 14,
              fontWeight: 500,
              padding: "10px 18px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            onClick={addProject}
            style={{
              border: "none",
              background: "#1a73e8",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              padding: "10px 22px",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
