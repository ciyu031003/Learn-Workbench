import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createState, verifyState, isWechatEnabled } from "./wechat";

function setWechatConfig(appid = "wx-app", secret = "wx-secret") {
  vi.stubEnv("WECHAT_WEB_APPID", appid);
  vi.stubEnv("WECHAT_WEB_SECRET", secret);
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("wechat state signing", () => {
  it("round-trips a state token in non-production", () => {
    setWechatConfig();
    const state = createState();
    expect(state).not.toBe("");
    expect(verifyState(state)).toBe(true);
  });

  it("rejects tampered or foreign states", () => {
    setWechatConfig();
    const state = createState();
    const [exp, nonce] = state.split(".");
    expect(verifyState(`${exp}.${nonce}.deadbeef`)).toBe(false);
    expect(verifyState("1700000000000.abc.deadbeef")).toBe(false);
    expect(verifyState(null)).toBe(false);
  });

  it("disables wechat login in production when WECHAT_STATE_SECRET is missing", () => {
    setWechatConfig();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PGPASSWORD", "db-pass"); // 旧回退链不再生效
    expect(isWechatEnabled()).toBe(false);
    expect(createState()).toBe("");
    expect(verifyState(createState())).toBe(false);
  });

  it("works in production with an explicit WECHAT_STATE_SECRET", () => {
    setWechatConfig();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WECHAT_STATE_SECRET", "s3cret");
    expect(isWechatEnabled()).toBe(true);
    expect(verifyState(createState())).toBe(true);
  });
});
