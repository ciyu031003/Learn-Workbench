"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { todayISOInZone } from "@learn-workbench/shared/domains";

/**
 * 数据库状态 / JSON 导出导入（S6-4：从 settings/page.tsx 抽出）。
 */

export interface BackupSettingsApi {
  dbOk: boolean | null;
  msg: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  exportJson: () => Promise<void>;
  importJson: (file: File) => Promise<void>;
}

export function backupExportFileName(now: Date = new Date()): string {
  // todayISOInZone(tz, now)：tz 省略 → 项目默认时区（Asia/Shanghai）
  return `learn-workbench-backup-${todayISOInZone(undefined, now)}.json`;
}

export function importResultMessage(ok: boolean): string {
  return ok ? "导入成功，数据已恢复" : "导入失败：格式不正确";
}

/** 触发浏览器下载（抽成独立函数便于测试时替换/断言） */
export function triggerJsonDownload(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function useBackupSettings(): BackupSettingsApi {
  const [dbOk, setDbOk] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string>("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/summary")
      .then((r) => setDbOk(r.ok))
      .catch(() => setDbOk(false));
  }, []);

  const exportJson = useCallback(async () => {
    const r = await fetch("/api/export");
    const data = await r.json();
    triggerJsonDownload(data, backupExportFileName());
    setMsg("已导出备份文件");
  }, []);

  const importJson = useCallback(async (file: File) => {
    const text = await file.text();
    const r = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: text,
    });
    setMsg(importResultMessage(r.ok));
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return { dbOk, msg, fileRef, exportJson, importJson };
}
