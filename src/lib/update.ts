// アプリ内自動更新（D-030 / spec/infra/auto-update.md）。
// Tauri updater プラグインの薄いラッパ。ブラウザ（Tauri 非環境）では常に「更新なし」を返す。
//
// 配信元は GitHub Releases の publish 済み最新リリースに添付された latest.json
// （エンドポイントと minisign 公開鍵は src-tauri/tauri.conf.json の plugins.updater）。
// プラグインの import はすべて動的にして、ブラウザビルドに実体を持ち込まない。

import type { Update } from "@tauri-apps/plugin-updater";

/** 検出した更新の要約（UI 表示用）。 */
export interface UpdateInfo {
  /** 新バージョン（例 "0.3.0"）。 */
  version: string;
  /** リリースノート本文。無ければ空文字。 */
  notes: string;
  /** 公開日時の ISO 相当文字列。無ければ null。 */
  date: string | null;
}

/** ダウンロード進捗（0–100）。総サイズ不明のときは null。 */
export type ProgressHandler = (percent: number | null) => void;

/**
 * 直近の checkUpdate() が見つけた更新。installUpdate() で使う。
 * プラグインの Update はダウンロード用のハンドルを内包するため、
 * 「確認 → 承諾 → インストール」の間モジュールスコープで保持する。
 */
let pending: Update | null = null;

/** Tauri ランタイム上か（tauri.ts と同義。循環 import を避けるため個別に持つ）。 */
function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

/** アプリ内更新が使える環境か（＝更新 UI を出してよいか）。 */
export function canUpdate(): boolean {
  return isTauriRuntime();
}

/**
 * 実行中アプリのバージョン。Tauri 非環境では null（＝バージョン行を出さない）。
 * 値の出所は tauri.conf.json の version。
 */
export async function currentVersion(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

/**
 * 更新の有無を確認する。更新があれば要約を、無ければ null を返す。
 * 通信・検証の失敗は throw する（呼び出し側で「手動なら表示・自動なら握る」を切り分ける）。
 */
export async function checkUpdate(): Promise<UpdateInfo | null> {
  if (!isTauriRuntime()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  pending = update ?? null;
  if (!update) return null;
  return { version: update.version, notes: update.body ?? "", date: update.date ?? null };
}

/**
 * 直前に見つかった更新をダウンロード＋インストールし、アプリを再起動する。
 * 署名検証はプラグイン側が公開鍵で行う（検証に失敗すれば throw）。
 * 正常時はこの関数から戻らない（relaunch でプロセスが入れ替わる）。
 */
export async function installUpdate(onProgress?: ProgressHandler): Promise<void> {
  if (!pending) throw new Error("no pending update");
  let total = 0;
  let received = 0;

  await pending.downloadAndInstall((ev) => {
    switch (ev.event) {
      case "Started":
        total = ev.data.contentLength ?? 0;
        onProgress?.(0);
        break;
      case "Progress":
        received += ev.data.chunkLength;
        // Content-Length が無い配信もあるため、総サイズ不明時は null（％を出さない）。
        onProgress?.(total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null);
        break;
      case "Finished":
        onProgress?.(100);
        break;
    }
  });

  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
