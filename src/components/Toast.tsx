// トースト通知。
import { useStore } from "../store";
import { Icon } from "./Icon";

export function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        transform: "translateX(-50%)",
        background: "#323539",
        color: "#fff",
        fontSize: 14,
        padding: "13px 20px",
        borderRadius: 8,
        boxShadow: "0 6px 20px rgba(60,64,67,0.3)",
        zIndex: 60,
        animation: "pop 0.16s ease",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Icon name="check_circle" size={18} color="#8ab4f8" />
      {toast}
    </div>
  );
}
