import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  FILE_TICKET_TTL_SECONDS,
  FileTicketConfigError,
  isFileTicketConfigured,
  issueFileTicket,
  verifyFileTicket,
} from "./file-ticket";

const SECRET = "test-ticket-secret-0123456789";

/** 解出 payload（仅测试用；生产代码不解析未验签的内容） */
function decodePayload(sig: string): Record<string, unknown> {
  const body = sig.slice(0, sig.indexOf("."));
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("FILE_TICKET_SECRET", SECRET);
  vi.stubEnv("CRON_SECRET", "");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("issueFileTicket / verifyFileTicket", () => {
  it("签发后能原样验回 fileId + uid（往返）", () => {
    const sig = issueFileTicket(42, "u-1");
    expect(typeof sig).toBe("string");
    expect(sig.split(".")).toHaveLength(2);
    expect(verifyFileTicket(sig)).toEqual({ fileId: 42, uid: "u-1" });
  });

  it("payload 带 5 分钟有效期 + 随机 nonce；uid 去空格 / fileId 字符串归一化", () => {
    const before = Math.floor(Date.now() / 1000);
    const sig = issueFileTicket("7", "  u-2  ");
    const payload = decodePayload(sig);
    expect(payload.fileId).toBe(7);
    expect(payload.uid).toBe("u-2");
    expect(Number(payload.exp)).toBeGreaterThanOrEqual(before + FILE_TICKET_TTL_SECONDS);
    expect(Number(payload.exp)).toBeLessThanOrEqual(before + FILE_TICKET_TTL_SECONDS + 2);
    expect(typeof payload.nonce).toBe("string");
    expect(String(payload.nonce).length).toBeGreaterThan(8);
    // 同一文件两次签发 nonce 不同（票据不幂等）
    expect(issueFileTicket(7, "u-2")).not.toBe(sig);
  });

  it("过期返回 null（5 分钟边界）", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const sig = issueFileTicket(1, "u-1");
    vi.setSystemTime(new Date("2026-01-01T00:04:59Z"));
    expect(verifyFileTicket(sig)).toEqual({ fileId: 1, uid: "u-1" });
    vi.setSystemTime(new Date("2026-01-01T00:05:01Z"));
    expect(verifyFileTicket(sig)).toBeNull();
  });

  it("自定义 ttl 生效", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const sig = issueFileTicket(1, "u-1", 1);
    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
    expect(verifyFileTicket(sig)).toBeNull();
  });

  it("篡改签名字符 → null", () => {
    const sig = issueFileTicket(1, "u-1");
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifyFileTicket(flipped)).toBeNull();
  });

  it("篡改 payload（改 fileId 但不重签）→ null", () => {
    const sig = issueFileTicket(1, "u-1");
    const dot = sig.indexOf(".");
    const payload = decodePayload(sig);
    payload.fileId = 999;
    const forgedBody = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    expect(verifyFileTicket(forgedBody + sig.slice(dot))).toBeNull();
  });

  it("换密钥后旧票据失效", () => {
    const sig = issueFileTicket(1, "u-1");
    vi.stubEnv("FILE_TICKET_SECRET", SECRET + "-rotated");
    expect(verifyFileTicket(sig)).toBeNull();
  });

  it("CRON_SECRET 可作为回退密钥", () => {
    vi.stubEnv("FILE_TICKET_SECRET", "");
    vi.stubEnv("CRON_SECRET", SECRET);
    const sig = issueFileTicket(1, "u-1");
    expect(verifyFileTicket(sig)).toEqual({ fileId: 1, uid: "u-1" });
  });

  it("格式非法 / 空值一律 null，不抛错", () => {
    for (const bad of [null, undefined, "", "   ", "abc", "a.b", ".x", "x.", "a.b.c", Buffer.from("{}").toString("base64url") + ".zzz"]) {
      expect(verifyFileTicket(bad)).toBeNull();
    }
  });

  it("签发参数非法时抛错（fileId 非正整数 / uid 为空）", () => {
    for (const badId of [0, -1, 1.5, "abc", Number.NaN]) {
      expect(() => issueFileTicket(badId as never, "u-1")).toThrow("fileId 无效");
    }
    expect(() => issueFileTicket(1, "")).toThrow("uid 为空");
    expect(() => issueFileTicket(1, "   ")).toThrow("uid 为空");
  });
});

describe("密钥配置", () => {
  it("生产环境未配密钥：签发抛 FileTicketConfigError、校验 null（fail-closed）", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FILE_TICKET_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(isFileTicketConfigured()).toBe(false);
    expect(() => issueFileTicket(1, "u-1")).toThrow(FileTicketConfigError);
    expect(verifyFileTicket("anything.anything")).toBeNull();
  });

  it("本地开发未配密钥：用进程内随机密钥兜底（预览仍可用）", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("FILE_TICKET_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    expect(isFileTicketConfigured()).toBe(true);
    const sig = issueFileTicket(1, "u-1");
    expect(verifyFileTicket(sig)).toEqual({ fileId: 1, uid: "u-1" });
  });
});
