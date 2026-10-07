import { describe, it, expect } from "vitest";
import {
  CRUMB_LIMIT,
  HEARTBEAT_STALE_MS,
  buildReportJson,
  buildReportText,
  clampTail,
  clampText,
  pickCrashSnapshot,
  exitReasonName,
  formatCrumbs,
  isCrashExit,
  isLikelyUnclean,
  pushCrumb,
  redactDeep,
  redactSecrets,
  reportFileName,
  type Crumb,
  type DiagnosticInput,
} from "./crash-report";

const baseInput = (over: Partial<DiagnosticInput> = {}): DiagnosticInput => ({
  generatedAt: Date.UTC(2026, 8, 29, 12, 0, 0),
  installId: "install-1234",
  app: { version: "1.32.0", build: "51", platform: "android", osVersion: "14", model: "PJZ110", isDevice: true },
  captureEnabled: true,
  lastExit: null,
  lastHeartbeatAt: null,
  lastScreen: "/jobs",
  crumbs: [],
  jsErrors: [],
  logcat: "",
  ...over,
});

describe("redactSecrets", () => {
  it("抹掉 Bearer 令牌", () => {
    expect(redactSecrets("Authorization: Bearer abcdefghijklmnop1234")).not.toContain("abcdefghijklmnop1234");
    expect(redactSecrets("authorization: Bearer abcdefghijklmnop1234")).toContain("<redacted>");
  });

  it("抹掉 cookie / token 键值对", () => {
    expect(redactSecrets('cookie=lwb_session=deadbeefdeadbeefdeadbeef; x=1')).toContain("<redacted>");
    expect(redactSecrets("token: 9f8e7d6c5b4a")).not.toContain("9f8e7d6c5b4a");
  });

  it("抹掉邮箱与手机号，但不动普通数字", () => {
    expect(redactSecrets("联系 me@example.com")).toBe("联系 <email>");
    expect(redactSecrets("电话 13800138000")).toBe("电话 <phone>");
    expect(redactSecrets("版本 1.32.0 柱数 10")).toBe("版本 1.32.0 柱数 10");
  });

  it("抹掉长随机串（会话 token / 签名）", () => {
    const tok = "a".repeat(40);
    expect(redactSecrets("session " + tok)).toContain("<redacted-token>");
  });

  it("null / undefined 不炸", () => {
    expect(redactSecrets(undefined as unknown as string)).toBe("");
    expect(redactSecrets(null as unknown as string)).toBe("");
  });
});

describe("脱敏性能护栏（2026-10-07 评审：邮箱正则曾退化成 O(N²)）", () => {
  it("200k 连续字符必须在 250ms 内跑完（Hermes 上也留足余量）", () => {
    const t0 = Date.now();
    const out = redactSecrets("x".repeat(200000));
    const ms = Date.now() - t0;
    expect(out).toContain("<redacted-token>");
    expect(ms).toBeLessThan(250);
  });

  it("长邮箱样式串（有 @ 无点）同样不能退化", () => {
    const t0 = Date.now();
    redactSecrets("a".repeat(60000) + "@" + "b".repeat(60000));
    expect(Date.now() - t0).toBeLessThan(250);
  });

  it("长 local part 的邮箱：local 被当作长串抹掉，域名不再被当成完整邮箱", () => {
    const out = redactSecrets("x".repeat(40) + "@example.com");
    expect(out).not.toContain("x".repeat(40));
  });
});

describe("redactDeep / buildReportJson 整包脱敏", () => {
  it("递归抹掉对象与数组里的长串", () => {
    const out = redactDeep({ a: "t" + "k".repeat(40), b: ["z".repeat(48)], c: 7 }) as {
      a: string;
      b: string[];
      c: number;
    };
    expect(out.a).toBe("<redacted-token>");
    expect(out.b[0]).toBe("<redacted-token>");
    expect(out.c).toBe(7);
  });

  it("结构化字段（crumbs / jsErrors / lastExit.trace）不再原样上传", () => {
    const json = buildReportJson(
      baseInput({
        crumbs: [{ t: 1, kind: "fetch", data: { token: "Bearer " + "A".repeat(40) } }],
        jsErrors: [{ t: 1, message: "boom", stack: "at x " + "B".repeat(40), fatal: true }],
        lastExit: { reason: "CRASH", reasonCode: 4, timestamp: 1, description: "", trace: "mem " + "C".repeat(40) },
        note: "联系 zzz@example.com",
      })
    );
    const body = JSON.stringify(json);
    expect(body).not.toContain("A".repeat(40));
    expect(body).not.toContain("B".repeat(40));
    expect(body).not.toContain("C".repeat(40));
    expect(body).not.toContain("zzz@example.com");
    expect(body).toContain("<redacted");
  });
});

describe("pushCrumb", () => {
  it("超过上限时丢最旧的、保留最新", () => {
    let list: Crumb[] = [];
    for (let i = 0; i < CRUMB_LIMIT + 5; i++) list = pushCrumb(list, { t: i, kind: "scroll", data: { i } });
    expect(list).toHaveLength(CRUMB_LIMIT);
    expect(list[0].t).toBe(5);
    expect(list[list.length - 1].t).toBe(CRUMB_LIMIT + 4);
  });

  it("可指定更小上限", () => {
    let list: Crumb[] = [];
    for (let i = 0; i < 4; i++) list = pushCrumb(list, { t: i, kind: "x" }, 2);
    expect(list.map((c) => c.t)).toEqual([2, 3]);
  });
});

describe("clampText", () => {
  it("短文本原样", () => expect(clampText("abc", 10)).toBe("abc"));
  it("超长截断并标注原始长度", () => {
    const out = clampText("a".repeat(100), 10);
    expect(out.startsWith("a".repeat(10))).toBe(true);
    expect(out).toContain("原始 100 字符");
  });
});

describe("退出原因", () => {
  it("映射系统常量名", () => {
    expect(exitReasonName(5)).toBe("CRASH_NATIVE");
    expect(exitReasonName(6)).toBe("ANR");
    expect(exitReasonName(999)).toBe("REASON_999");
  });

  it("只有真正的异常才提示上传", () => {
    expect(isCrashExit(5)).toBe(true);
    expect(isCrashExit(6)).toBe(true);
    expect(isCrashExit(4)).toBe(true);
    expect(isCrashExit(2)).toBe(true);
    expect(isCrashExit(10)).toBe(false); // USER_REQUESTED
    expect(isCrashExit(13)).toBe(false); // OTHER（退到后台/正常关闭也会是它）
    expect(isCrashExit(null)).toBe(false);
    expect(isCrashExit(undefined)).toBe(false);
  });

  it("心跳过期才算非正常退出", () => {
    const now = Date.UTC(2026, 8, 29);
    expect(isLikelyUnclean(now - 10_000, now)).toBe(false);
    expect(isLikelyUnclean(now - HEARTBEAT_STALE_MS - 1, now)).toBe(true);
    expect(isLikelyUnclean(null, now)).toBe(false);
  });
});

describe("reportFileName", () => {
  it("时间前缀 + 随机后缀", () => {
    expect(reportFileName(Date.UTC(2026, 8, 29, 4, 5, 6), "abcdef1234")).toMatch(/^crash-\d{8}-\d{6}-abcdef12\.json$/);
  });
});

describe("formatCrumbs", () => {
  it("逐行带类型与数据", () => {
    const out = formatCrumbs([{ t: Date.UTC(2026, 8, 29, 4, 5, 6), kind: "scroll", data: { first: 3 } }]);
    expect(out).toContain("[scroll]");
    expect(out).toContain('"first":3');
  });
});

describe("buildReportText", () => {
  it("含各分区、退出原因与页面", () => {
    const text = buildReportText(
      baseInput({
        lastExit: { reason: "CRASH_NATIVE", reasonCode: 5, timestamp: Date.UTC(2026, 8, 29, 3, 59, 0), description: "native crash", trace: "backtrace:\n#00 pc 00000000 libreanimated.so" },
        lastHeartbeatAt: Date.UTC(2026, 8, 29, 3, 58, 0),
        crumbs: [{ t: Date.UTC(2026, 8, 29, 3, 59, 0), kind: "scroll", data: { first: 8, last: 12 } }],
      })
    );
    expect(text).toContain("=== Learn-Workbench 诊断包 ===");
    expect(text).toContain("CRASH_NATIVE (5)");
    expect(text).toContain("libreanimated.so");
    expect(text).toContain("最后页面: /jobs");
    expect(text).toContain("[scroll]");
    expect(text).toContain("疑似非正常退出");
  });

  it("没有原生记录时给出可解释的占位", () => {
    const text = buildReportText(baseInput());
    expect(text).toContain("(无记录：Android < 11，或原生模块不可用)");
    expect(text).toContain("--- 崩溃栈（native / java / ANR traces）---");
  });

  it("正文整体脱敏（崩溃栈里混进 token 也不会带走）", () => {
    const text = buildReportText(
      baseInput({ lastExit: { reason: "CRASH", reasonCode: 4, timestamp: 1, description: "", trace: "Authorization: Bearer supersecrettoken123456" } })
    );
    expect(text).not.toContain("supersecrettoken123456");
  });
});

describe("buildReportJson", () => {
  it("带 report 正文、schema 与脱敏后的 logcat", () => {
    const json = buildReportJson(baseInput({ logcat: "Bearer abcdefghijklmnopqrstuvwxyz0123456789" })) as Record<string, unknown>;
    expect(json.schema).toBe(1);
    expect(typeof json.report).toBe("string");
    expect(String(json.logcat)).not.toContain("abcdefghijklmnopqrstuvwxyz0123456789");
  });
});

describe("clampTail（logcat 取尾）", () => {
  it("短文本原样", () => expect(clampTail("abc", 10)).toBe("abc"));

  it("保留尾部、丢掉头部并标注原始长度", () => {
    const out = clampTail("HEAD" + "x".repeat(100) + "TAILY", 20);
    expect(out.endsWith("TAILY")).toBe(true);
    expect(out).not.toContain("HEAD");
    expect(out).toContain("原始 109 字符");
  });

  it("报告正文里的 logcat 段也走取尾（首版上报把 FATAL 截掉了，这里守住）", () => {
    // 注意：两头用换行隔开 —— 否则超长 x 串会和标记连成一个 token 被脱敏规则一起抹掉，测不出截断行为
    const text = buildReportText(baseInput({ logcat: "HEAD-MARKER\n" + "x".repeat(200000) + "\nTAIL-MARKER" }));
    expect(text).toContain("TAIL-MARKER");
    expect(text).not.toContain("HEAD-MARKER");
  });
});

describe("pickCrashSnapshot（崩溃现场选择）", () => {
  const snap = (updatedAt: number, path: string) => ({
    updatedAt,
    crumbs: [{ t: updatedAt, kind: "screen", data: { path } }],
    lastScreen: path,
  });

  it("上一份快照早于崩溃 → 用崩溃现场", () => {
    const r = pickCrashSnapshot(snap(2000, "/current"), snap(1000, "/jobs"), { timestamp: 1500 });
    expect(r.source).toBe("crash");
    expect(r.lastScreen).toBe("/jobs");
  });

  it("上一份快照晚于崩溃（不是那次崩溃的现场）→ 用当前会话", () => {
    const r = pickCrashSnapshot(snap(9000, "/current"), snap(8000, "/jobs"), { timestamp: 1000 });
    expect(r.source).toBe("current");
    expect(r.lastScreen).toBe("/current");
  });

  it("没有原生崩溃记录 → 用当前会话", () => {
    const r = pickCrashSnapshot(snap(2000, "/current"), snap(1000, "/jobs"), null);
    expect(r.source).toBe("current");
  });

  it("当前会话为空但存在上一份 → 仍用上一份", () => {
    const r = pickCrashSnapshot(null, snap(1000, "/jobs"), null);
    expect(r.source).toBe("crash");
  });

  it("两份都没有 → 空结果", () => {
    const r = pickCrashSnapshot(null, null, { timestamp: 1 });
    expect(r.crumbs).toEqual([]);
    expect(r.lastScreen).toBeNull();
  });
});
