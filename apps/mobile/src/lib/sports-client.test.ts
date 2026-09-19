import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/store/app-store", () => ({ useAppStore: { getState: vi.fn(() => ({ token: "tok-1" })) } }));
vi.mock("@/config", () => ({ getApiUrl: () => "https://api.test" }));

import {
  deleteSportsProfile,
  draftFromProfile,
  emptyBodyMetrics,
  emptySportsDraft,
  fetchBodyMetrics,
  fetchSportsProfiles,
  saveBodyMetrics,
  saveSportsProfile,
} from "./sports-client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const jsonResponse = (data: unknown, ok = true) => ({ ok, json: async () => data });

beforeEach(() => {
  fetchMock.mockReset();
});

describe("emptySportsDraft", () => {
  it("羽毛球预填「球拍 / 球鞋 / 羽毛球 / 拍线」（不含磅数行）", () => {
    const draft = emptySportsDraft("badminton");
    const labels = draft.gear.map((g) => g.label);
    expect(labels).toEqual(["球拍", "球鞋", "羽毛球", "拍线"]);
    expect(labels).not.toContain("磅数");
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
      showGearImages: true,
      shareSlug: "sp-1",
    });
    expect(draft.matchesPlayed).toBe(214);
    expect(draft.signatureMove).toBe("疾风·劈杀");
    expect(draft.shoeSize).toBe("40");
    expect(draft.tensionLbs).toBe(27.5);
    expect(draft.isPublic).toBe(true);
    expect(draft.showGearImages).toBe(true);
    // 老行的「球拍型号」归一到「球拍」，并按现模板补全其余行
    expect(draft.gear.map((g) => g.label)).toEqual(["球拍", "球鞋", "羽毛球", "拍线"]);
    expect(draft.gear[0].value).toBe("VICTOR 龙牙之刃 II");
  });

  it("老档案的「球拍型号 + 球拍类型」合并、磅数行落到四宫格", () => {
    const draft = draftFromProfile({
      id: 8,
      sportKey: "badminton",
      identity: null,
      levelText: null,
      handedness: null,
      playStyle: null,
      photoUrl: null,
      gear: [
        { label: "球拍型号", value: "YONEX 100ZZ" },
        { label: "球拍类型", value: "进攻拍" },
        { label: "磅数", value: "27.5" },
      ],
      highlights: [],
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      signatureMove: "",
      shoeSize: "",
      tensionLbs: null,
      isPublic: false,
      showGearImages: false,
      shareSlug: null,
    });
    expect(draft.gear[0]).toEqual({ label: "球拍", value: "YONEX 100ZZ · 进攻拍", imageUrl: null });
    expect(draft.gear.map((g) => g.label)).not.toContain("磅数");
    expect(draft.tensionLbs).toBe(27.5);
  });
});

describe("身体数据（图鉴四宫格身高 / 体重）", () => {
  it("GET /api/nutrition/target，取 profile 里的身高体重与性别活动量", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ profile: { weightKg: 68.5, heightCm: 175, birthYear: 2000, sex: "male", activityLevel: "moderate" } })
    );
    const metrics = await fetchBodyMetrics();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/api/nutrition/target");
    expect(metrics).toEqual({ weightKg: 68.5, heightCm: 175, birthYear: 2000, sex: "male", activityLevel: "moderate" });
  });

  it("缺字段时回落 null，非法性别不认", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ profile: { weightKg: 0, heightCm: null, sex: "x" } }));
    const metrics = await fetchBodyMetrics();
    expect(metrics).toEqual({ weightKg: null, heightCm: null, birthYear: null, sex: null, activityLevel: null });
  });

  it("PUT 整组回传（体重/身高/生日/性别/活动量一起），避免服务端清空其它字段", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await saveBodyMetrics({ ...emptyBodyMetrics(), heightCm: 175, weightKg: 68.5, sex: "male", activityLevel: "moderate" });
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe("https://api.test/api/nutrition/target");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      weightKg: 68.5,
      heightCm: 175,
      birthYear: null,
      sex: "male",
      activityLevel: "moderate",
    });
  });

  it("失败时抛服务端文案", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "参数不合法" }, false));
    await expect(saveBodyMetrics(emptyBodyMetrics())).rejects.toThrow("参数不合法");
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
