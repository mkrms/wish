// Material Symbols のアイコン。
import type { CSSProperties } from "react";

export function Icon({
  name,
  size = 20,
  color,
  className,
  style,
  onClick,
  title,
}: {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}) {
  return (
    <span
      className={"ms" + (className ? " " + className : "")}
      title={title}
      onClick={onClick}
      style={{ fontSize: size, color, ...style }}
    >
      {name}
    </span>
  );
}
