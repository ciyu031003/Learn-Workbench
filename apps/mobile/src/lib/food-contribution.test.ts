import { afterEach, describe, expect, it, vi } from "vitest";
import { contributeFoodItem } from "./food-contribution";

vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test" }));

const input = {
  name: "自制燕麦酸奶",
  unit: "份",
  kcal: 220,
  proteinG: 12,
  carbsG: 28,
  fatG: 6,
  meal: "breakfast",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("contributeFoodItem", () => {
  it("POST 到公共食物库接口并带登录头", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(contributeFoodItem(input, { Authorization: "Bearer token" })).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/foods/contribute");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    });
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it("服务端拒绝或网络失败时返回 false，不抛错", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    await expect(contributeFoodItem(input, {})).resolves.toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(contributeFoodItem(input, {})).resolves.toBe(false);
  });
});
