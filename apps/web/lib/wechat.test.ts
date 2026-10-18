import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  WECHAT_STATE_COOKIE,
  consumeState,
  createState,
  createStateWithNonce,
  isWechatEnabled,
  readStateNonceCookie,
  resetConsumedStateNonces,
  verifyState,
} from "./wechat";

function setWechatConfig(appid = "wx-app", secret = "wx-secret") {
  vi.stubEnv("WECHAT_WEB_APPID", appid);
  vi.stubEnv("WECHAT_WEB_SECRET", secret);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  resetConsumedStateNonces();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetConsumedStateNonces();
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
    expect(createStateWithNonce()).toBeNull();
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

describe("one-time state nonce (S2-5)", () => {
  it("embeds the nonce inside the signed state", () => {
    setWechatConfig();
    const created = createStateWithNonce();
    expect(created).not.toBeNull();
    const [exp, nonce, sig] = created!.state.split(".");
    expect(Number(exp)).toBeGreaterThan(Date.now());
    expect(nonce).toBe(created!.nonce);
    expect(sig).toHaveLength(32);
    expect(verifyState(created!.state)).toBe(true);
  });

  it("consumes a state exactly once (replay rejected)", () => {
    setWechatConfig();
    const { state, nonce } = createStateWithNonce()!;
    expect(consumeState(state, nonce)).toBe(true);
    expect(consumeState(state, nonce)).toBe(false);
    // 重放被拒后，即使换回正确 cookie 也不能再用
    expect(consumeState(state, nonce)).toBe(false);
  });

  it("rejects a callback without the state cookie", () => {
    setWechatConfig();
    const { state } = createStateWithNonce()!;
    expect(consumeState(state, null)).toBe(false);
    expect(consumeState(state, undefined)).toBe(false);
    expect(consumeState(state, "")).toBe(false);
  });

  it("rejects a cookie nonce that belongs to another state", () => {
    setWechatConfig();
    const a = createStateWithNonce()!;
    const b = createStateWithNonce()!;
    expect(consumeState(a.state, b.nonce)).toBe(false);
    // 错误的 cookie 不能把正确的 state 消费掉
    expect(consumeState(a.state, a.nonce)).toBe(true);
  });

  it("rejects tampered states even with a matching nonce", () => {
    setWechatConfig();
    const { state, nonce } = createStateWithNonce()!;
    const [exp, stateNonce] = state.split(".");
    expect(consumeState(`${exp}.${stateNonce}.deadbeef`, nonce)).toBe(false);
    expect(consumeState("not-a-state", nonce)).toBe(false);
  });

  it("rejects states past their 10-minute lifetime", () => {
    vi.useFakeTimers();
    try {
      setWechatConfig();
      const { state, nonce } = createStateWithNonce()!;
      vi.advanceTimersByTime(10 * 60 * 1000 + 1);
      expect(consumeState(state, nonce)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("readStateNonceCookie", () => {
  it("extracts the nonce from a multi-cookie header", () => {
    const req = new Request("https://learn.yuanabd.cn/api/auth/wechat/callback", {
      headers: { cookie: `lwb_session=abc; ${WECHAT_STATE_COOKIE}=deadbeef; theme=dark` },
    });
    expect(readStateNonceCookie(req)).toBe("deadbeef");
  });

  it("returns null when the cookie is absent or empty", () => {
    expect(readStateNonceCookie(new Request("https://x.cn"))).toBeNull();
    expect(
      readStateNonceCookie(
        new Request("https://x.cn", { headers: { cookie: "lwb_session=abc" } })
      )
    ).toBeNull();
    expect(
      readStateNonceCookie(
        new Request("https://x.cn", { headers: { cookie: `${WECHAT_STATE_COOKIE}=` } })
      )
    ).toBeNull();
  });
});
