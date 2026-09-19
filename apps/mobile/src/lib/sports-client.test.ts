import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/store/app-store", () => ({ useAppStore: { getState: vi.fn(() => ({ token: "tok-1" })) } }));
vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test" }));

import {
  deleteSportsProfile,
  draftFromProfile,
  emptySportsDraft,
  fetchSportsProfiles,
  saveSportsProfile,
} from "./sports-client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const jsonResponse = (data: unknown, ok = true) => ({ ok, json: async () => data });

beforeEach(() => {
  fetchMock.mockReset();
});

describe("emptySportsDraft", () => {
  it("拍类运动预填「球拍型号 / 球拍类型 / 球鞋类型」", () => {
    const draft = emptySportsDraft("badminton");
    const labels = draft.gear.map((g) => g.label);
    expect(labels).toContain("球拍型号");
    expect(labels).toContain("球拍类型");
    expect(labels).toContain("球鞋类型");
    expect(draft.matchesPlayed).toBe(0);
  });

  it("未知运动回退到通用装备行", () => {
    expect(emptySportsDraft("curling").gear.map((g) => g.label)).toEqual(["球拍", "球鞋", "球线", "手胶"]);
  });
});

describe("draftFromProfile", () => {
  it("把服务端档案折回草稿（含战绩与绝技）", () => {
    const draft = draftFromProfile({
      id: 7,
      sportKey: "badminton",
      identity: "双打搭子",
      levelText: "业余 6 级",
      handedness: "right",
      playStyle: "混双",
      photoUrl: null,
      gear: [{ label: "球拍型号", value: "VICTOR 龙牙之刃 II" }],
      highlights: [{ label: "城市联赛", value: "八强" }],
      matchesPlayed: 214,
      wins: 178,
      losses: 36,
      signatureMove: "疾风·劈杀",
      shoeSize: "40",
      tensionLbs: 27.5,
      isPublic: true,
      shareSlug: "sp-1",
    });
    expect(draft.matchesPlayed).toBe(214);
    expect(draft.signatureMove).toBe("疾风·劈杀");
    expect(draft.shoeSize).toBe("40");
    expect(draft.tensionLbs).toBe(27.5);
    expect(draft.isPublic).toBe(true);
    expect(draft.gear).toHaveLength(1);
  });
});

describe("fetchSportsProfiles / saveSportsProfile / deleteSportsProfile", () => {
  it("GET 带 Bearer 头并返回列表", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ profiles: [{ id: 1 }] }));
    const list = await fetchSportsProfiles();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/sports/profiles");
    expect((fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers.Authorization).toBe("Bearer tok-1");
    expect(list).toHaveLength(1);
  });

  it("没有 id 时 POST，有 id 时 PATCH", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ profile: { id: 3 } }));
    await saveSportsProfile(emptySportsDraft("tennis"), null);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/sports/profiles");
    expect((fetchMock.mock.calls[0][1] as { method: string }).method).toBe("POST");
    await saveSportsProfile(emptySportsDraft("tennis"), 3);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.test/api/sports/profiles/3");
    expect((fetchMock.mock.calls[1][1] as { method: string }).method).toBe("PATCH");
  });

  it("失败时抛出服务端错误文案", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "请先登录" }, false));
    await expect(saveSportsProfile(emptySportsDraft(), null)).rejects.toThrow("请先登录");
  });

  it("删除走 DELETE", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await deleteSportsProfile(9);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/sports/profiles/9");
    expect((fetchMock.mock.calls[0][1] as { method: string }).method).toBe("DELETE");
  });
});
