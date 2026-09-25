import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { mergeGearWithTemplate, sportGearTemplate, type SportsProfile } from "@learn-workbench/shared";

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
  /** 公开分享页是否展示装备图（迁移 053） */
  showGearImages: boolean;
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
    showGearImages: false,
  };
}

export function draftFromProfile(p: SportsProfile): SportsProfileDraft {
  // 老档案的「球拍型号 / 球拍类型」合并成一行「球拍」，「磅数」行落到图鉴四宫格
  const normalized = mergeGearWithTemplate(p.sportKey, p.gear ?? []);
  return {
    sportKey: p.sportKey,
    identity: p.identity ?? "",
    levelText: p.levelText ?? "",
    handedness: p.handedness,
    playStyle: p.playStyle ?? "",
    photoUrl: p.photoUrl ?? "",
    gear: normalized.gear.map((g) => ({ label: g.label, value: g.value, imageUrl: g.imageUrl ?? null })),
    highlights: (p.highlights ?? []).map((g) => ({ label: g.label, value: g.value })),
    matchesPlayed: p.matchesPlayed ?? 0,
    wins: p.wins ?? 0,
    losses: p.losses ?? 0,
    signatureMove: p.signatureMove ?? "",
    shoeSize: p.shoeSize ?? "",
    tensionLbs: p.tensionLbs ?? normalized.tensionLbs,
    isPublic: p.isPublic,
    showGearImages: p.showGearImages === true,
  };
}

/** 身体数据（档案图鉴四宫格的身高/体重来自营养目标里的资料） */
export interface BodyMetrics {
  heightCm: number | null;
  weightKg: number | null;
  birthYear: number | null;
  sex: "male" | "female" | null;
  activityLevel: string | null;
}

export function emptyBodyMetrics(): BodyMetrics {
  return { heightCm: null, weightKg: null, birthYear: null, sex: null, activityLevel: null };
}

export async function fetchBodyMetrics(): Promise<BodyMetrics> {
  const r = await fetch(getApiUrl() + "/api/nutrition/target", { headers: authHeaders() });
  if (!r.ok) throw new Error("加载身体数据失败");
  const d = await r.json();
  const p = d.profile ?? d;
  const n = (v: unknown) => {
    const value = Number(v);
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  return {
    heightCm: n(p.heightCm ?? d.heightCm),
    weightKg: n(p.weightKg ?? d.weightKg),
    birthYear: n(p.birthYear ?? d.birthYear),
    sex: p.sex === "male" || p.sex === "female" ? p.sex : null,
    activityLevel: typeof p.activityLevel === "string" ? p.activityLevel : null,
  };
}

/**
 * 保存身高 / 体重（档案图鉴四宫格）。
 *
 * 服务端 PUT 是「整组覆盖」语义：没带的字段会被清空（体重还会回落 60），
 * 所以这里必须把 sex / activityLevel / birthYear 一起回传。
 */
export async function saveBodyMetrics(metrics: BodyMetrics): Promise<void> {
  const r = await fetch(getApiUrl() + "/api/nutrition/target", {
    method: "PUT",
    headers: authHeaders(true),
    body: JSON.stringify({
      weightKg: metrics.weightKg,
      heightCm: metrics.heightCm,
      birthYear: metrics.birthYear,
      sex: metrics.sex,
      activityLevel: metrics.activityLevel,
    }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => null);
    throw new Error(typeof d?.error === "string" ? d.error : "身体数据保存失败");
  }
}

export async function fetchSportsProfiles(): Promise<SportsProfile[]> {
  const r = await fetch(getApiUrl() + "/api/sports/profiles", { headers: authHeaders() });
  if (!r.ok) throw new Error("加载运动档案失败");
  const d = await r.json();
  return Array.isArray(d.profiles) ? (d.profiles as SportsProfile[]) : [];
}

/**
 * 把失败响应变成**能定位问题**的文案。
 * 之前接口 500（返回 HTML 而非 JSON）时只会弹兜底文案「保存失败」，
 * 排查时拿不到任何信息 —— 现在带上 HTTP 状态与响应片段。
 */
async function describeFailure(r: Response, fallback: string): Promise<string> {
  const text = await r.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    // 非 JSON（多半是 500 的错误页）：下面把状态与片段带出去
  }
  const snippet = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  return fallback + "（HTTP " + r.status + (snippet ? " · " + snippet : "") + "）";
}

export async function saveSportsProfile(draft: SportsProfileDraft, id: number | null): Promise<SportsProfile> {
  const base = getApiUrl() + "/api/sports/profiles";
  const r = await fetch(id ? base + "/" + id : base, {
    method: id ? "PATCH" : "POST",
    headers: authHeaders(true),
    body: JSON.stringify(draft),
  });
  if (!r.ok) throw new Error(await describeFailure(r, id ? "更新失败" : "保存失败"));
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
  if (!r.ok) throw new Error(await describeFailure(r, "更新失败"));
}

export async function deleteSportsProfile(id: number): Promise<void> {
  const r = await fetch(getApiUrl() + "/api/sports/profiles/" + id, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error("删除失败");
}
