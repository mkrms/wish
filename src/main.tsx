import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import PaletteApp from "./PaletteApp";
import { isPaletteWindow } from "./tauri";
import "./index.css";

// 2ウィンドウ構成（#4）: Tauri の palette ウィンドウでは軽量な PaletteApp を、
// それ以外（main ウィンドウ / ブラウザ）では従来の App（フルUI）を描画する。
// ブラウザでは label を取得できないため必ず App になり、パレットは従来のオーバーレイで動く。
const inPalette = isPaletteWindow();
// palette ウィンドウでは <html> に印を付け、CSS で背景を透明化する（透過ウィンドウ用）。
if (inPalette) document.documentElement.classList.add("palette-window");
const Root = inPalette ? PaletteApp : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
