import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { sportGearTemplate, type SportsProfile } from "@learn-workbench/shared";

/** 运动档案客户端（对齐 Web /api/sports/profiles，字段已是 camelCase） */
function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = useAppStore.getState().token;
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

/** 装备行：`imageUrl` 为装备图片（用户上传或装备图库商品图） */
export interface SportsGearPair {
  label: string;
  value: string;
  imageUrl?: string | null;
}

export interface SportsProfileDraft {
  sportKey: string;
  identity: string;
  levelText: string;
  handedness: "left" | "right" | null;
  playStyle: string;
  photoUrl: string;
  gear: SportsGearPair[];
  highlights: SportsGearPair[];
  matchesPlayed: number;
  wins: number;
  losses: number;
  signatureMove: string;
  /** 档案图鉴四宫格（迁移 050） */
  shoeSize: string;
  tensionLbs: number | null;
  isPublic: boolean;
}

/** 新建草稿：装备行按运动项目模板预填（拍类区分球拍型号 / 球拍类型 / 球鞋类型） */
export function emptySportsDraft(sportKey = "badminton"): SportsProfileDraft {
  return {
    sportKey,
    identity: "",
    levelText: "",
    handedness: null,
    playStyle: "",
    photoUrl: "",
    gear: sportGearTemplate(sportKey).map((label) => ({ label, value: "" })),
    highlights: [],
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    signatureMove: "",
    shoeSize: "",
    tensionLbs: null,
    isPublic: false,
  };
}

export function draftFromProfile(p: SportsProfile): SportsProfileDraft {
  return {
    sportKey: p.sportKey,
    identity: p.identity ?? "",
    levelText: p.levelText ?? "",
    handedness: p.handedness,
    playStyle: p.playStyle ?? "",
    photoUrl: p.photoUrl ?? "",
    gear:
      (p.gear ?? []).length > 0
        ? p.gear.map((g) => ({ label: g.label, value: g.value, imageUrl: g.imageUrl ?? null }))
        : sportGearTemplate(p.sportKey).map((label) => ({ label, value: "", imageUrl: null })),
    highlights: (p.highlights ?? []).map((g) => ({ label: g.label, value: g.value })),
    matchesPlayed: p.matchesPlayed ?? 0,
    wins: p.wins ?? 0,
    losses: p.losses ?? 0,
    signatureMove: p.signatureMove ?? "",
    shoeSize: p.shoeSize ?? "",
    tensionLbs: p.tensionLbs ?? null,
    isPublic: p.isPublic,
  };
}

export async function fetchSportsProfiles(): Promise<SportsProfile[]> {
  const r = await fetch(getApiUrl() + "/api/sports/profiles", { headers: authHeaders() });
  if (!r.ok) throw new Error("加载运动档案失败");
  const d = await r.json();
  return Array.isArray(d.profiles) ? (d.profiles as SportsProfile[]) : [];
}

export async function saveSportsProfile(draft: SportsProfileDraft, id: number | null): Promise<SportsProfile> {
  const base = getApiUrl() + "/api/sports/profiles";
  const r = await fetch(id ? base + "/" + id : base, {
    method: id ? "PATCH" : "POST",
    headers: authHeaders(true),
    body: JSON.stringify(draft),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    throw new Error(typeof d?.error === "string" ? d.error : "保存失败");
  }
  const d = await r.json();
  return d.profile as SportsProfile;
}

/** 局部更新（换照片 / 换装备图这类单字段改动） */
export async function patchSportsProfile(id: number, patch: Record<string, unknown>): Promise<void> {
  const r = await fetch(getApiUrl() + "/api/sports/profiles/" + id, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    throw new Error(typeof d?.error === "string" ? d.error : "更新失败");
  }
}

export async function deleteSportsProfile(id: number): Promise<void> {
  const r = await fetch(getApiUrl() + "/api/sports/profiles/" + id, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error("删除失败");
}
