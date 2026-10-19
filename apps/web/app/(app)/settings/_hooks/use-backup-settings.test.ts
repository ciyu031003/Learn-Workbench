import { describe, expect, it } from "vitest";
import { backupExportFileName, importResultMessage } from "./use-backup-settings";

describe("useBackupSettings 的纯函数（S6-4）", () => {
  it("导出文件名带 Asia/Shanghai 当天日期", () => {
    // 2026-10-19T20:30:00+08:00
    const name = backupExportFileName(new Date("2026-10-19T12:30:00.000Z"));
    expect(name).toBe("learn-workbench-backup-2026-10-19.json");
  });

  it("跨零点按上海时区取日期（UTC 仍是前一天）", () => {
    const name = backupExportFileName(new Date("2026-10-19T20:30:00.000Z"));
    expect(name).toBe("learn-workbench-backup-2026-10-20.json");
  });

  it("导入结果文案固定可读", () => {
    expect(importResultMessage(true)).toBe("导入成功，数据已恢复");
    expect(importResultMessage(false)).toBe("导入失败：格式不正确");
  });
});
