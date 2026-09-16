/**
 * LiveLog（v4 P4-c）——"在背景图上自由拖贴纸"的纯数据模型。
 *
 * 存储策略（本轮零迁移、零后端改动）：**只存本机 AsyncStorage**，与「收集册 / 贴纸墙」的关系是：
 *  - 贴纸墙 / 收集册 = 对**真实饮食记录**的聚合（服务端数据，跨端一致）；
 *  - LiveLog = 用户手摆的一张**画布**（本机玩法），不参与同步，UI 上明确写"本机保存"。
 * 这样既不动 `meal_entries`/`/api/sync`，也不会让"手摆的贴纸位置"污染统计口径。
 *
 * 位置用**归一化坐标**（0..1）而不是像素：换机型/横竖屏/画布尺寸变化后贴纸仍在相对位置，
 * 否则在小屏摆放的贴纸到大屏会全部挤到左上角。
 */

export interface LiveSticker {
  id: string;
  /** 食物名（用于推导 emoji 贴纸） */
  name: string;
  /** 归一化坐标：0 = 画布左/上边，1 = 右/下边（已按贴纸半径留边） */
  x: number;
  y: number;
  /** 缩放 0.6..2 */
  scale: number;
  /** 旋转 -30..30 度 */
  rotate: number;
}

export interface LiveLogDoc {
  version: 1;
  updatedAt: string;
  bgId: string;
  stickers: LiveSticker[];
}

export const LIVE_LOG_VERSION = 1;
export const LIVE_LOG_MAX_STICKERS = 12;

/** 背景：1 张远端（Bing 每日壁纸）+ 3 个本地渐变，离线也有得选 */
export interface LiveBackground {
  id: string;
  name: string;
  kind: "remote" | "gradient";
  /** kind = gradient 时的两个颜色（上→下） */
  colors?: [string, string];
}

export const LIVE_BACKGROUNDS: LiveBackground[] = [
  { id: "bing", name: "今日壁纸", kind: "remote" },
  { id: "dawn", name: "晨光", kind: "gradient", colors: ["#FFE3B8", "#F28C28"] },
  { id: "meadow", name: "草地", kind: "gradient", colors: ["#DDF3D5", "#3DA35D"] },
  { id: "midnight", name: "深夜", kind: "gradient", colors: ["#243B55", "#141E30"] },
];

export const DEFAULT_BACKGROUND_ID = "dawn";

export function backgroundById(id: string): LiveBackground {
  return LIVE_BACKGROUNDS.find((b) => b.id === id) ?? LIVE_BACKGROUNDS[1];
}

/** 贴纸摆放的初始槽位（8 个位置，超出的循环复用并微偏移），避免新贴纸总是盖在正中 */
const SLOTS: { x: number; y: number; rotate: number }[] = [
  { x: 0.28, y: 0.3, rotate: -8 },
  { x: 0.68, y: 0.26, rotate: 7 },
  { x: 0.24, y: 0.66, rotate: 5 },
  { x: 0.72, y: 0.68, rotate: -6 },
  { x: 0.5, y: 0.46, rotate: 3 },
  { x: 0.4, y: 0.18, rotate: -4 },
  { x: 0.82, y: 0.48, rotate: 9 },
  { x: 0.18, y: 0.48, rotate: -9 },
];

let seq = 0;
function nextId(): string {
  seq += 1;
  return `ls_${Date.now().toString(36)}_${seq}`;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** 坐标夹在 [0.08, 0.92]：留出贴纸半径，保证整张贴纸都在画布内 */
export function clampSticker(s: LiveSticker): LiveSticker {
  return {
    ...s,
    x: clamp(Number.isFinite(s.x) ? s.x : 0.5, 0.08, 0.92),
    y: clamp(Number.isFinite(s.y) ? s.y : 0.5, 0.08, 0.92),
    scale: clamp(Number.isFinite(s.scale) ? s.scale : 1, 0.6, 2),
    rotate: clamp(Number.isFinite(s.rotate) ? s.rotate : 0, -30, 30),
  };
}

export function initialPlacement(index: number): { x: number; y: number; rotate: number } {
  const slot = SLOTS[index % SLOTS.length];
  const cycle = Math.floor(index / SLOTS.length);
  if (cycle === 0) return { ...slot };
  // 第二轮起整体微偏移，避免与第一轮完全重合（仍然夹在安全区内）
  return {
    x: clamp(slot.x + 0.05 * cycle, 0.08, 0.92),
    y: clamp(slot.y - 0.04 * cycle, 0.08, 0.92),
    rotate: slot.rotate,
  };
}

export function createLiveLog(bgId: string = DEFAULT_BACKGROUND_ID): LiveLogDoc {
  return { version: LIVE_LOG_VERSION, updatedAt: new Date().toISOString(), bgId, stickers: [] };
}

/** 加一张贴纸；到上限后返回原文档（调用方据此提示"最多 12 张"） */
export function addSticker(doc: LiveLogDoc, name: string): LiveLogDoc {
  const clean = name.trim();
  if (!clean || doc.stickers.length >= LIVE_LOG_MAX_STICKERS) return doc;
  const place = initialPlacement(doc.stickers.length);
  const sticker: LiveSticker = clampSticker({
    id: nextId(),
    name: clean,
    x: place.x,
    y: place.y,
    scale: 1,
    rotate: place.rotate,
  });
  return { ...doc, stickers: [...doc.stickers, sticker], updatedAt: new Date().toISOString() };
}

export function moveSticker(
  doc: LiveLogDoc,
  id: string,
  patch: Partial<Pick<LiveSticker, "x" | "y" | "scale" | "rotate">>
): LiveLogDoc {
  let changed = false;
  const stickers = doc.stickers.map((s) => {
    if (s.id !== id) return s;
    changed = true;
    return clampSticker({ ...s, ...patch });
  });
  if (!changed) return doc;
  return { ...doc, stickers, updatedAt: new Date().toISOString() };
}

export function removeSticker(doc: LiveLogDoc, id: string): LiveLogDoc {
  const stickers = doc.stickers.filter((s) => s.id !== id);
  if (stickers.length === doc.stickers.length) return doc;
  return { ...doc, stickers, updatedAt: new Date().toISOString() };
}

export function clearStickers(doc: LiveLogDoc): LiveLogDoc {
  if (doc.stickers.length === 0) return doc;
  return { ...doc, stickers: [], updatedAt: new Date().toISOString() };
}

/** 循环切背景（dir=1 下一个 / -1 上一个；`skip` 用于"今日壁纸拉不到图"时跳过它） */
export function cycleBackground(doc: LiveLogDoc, dir = 1, skip: string[] = []): LiveLogDoc {
  const usable = LIVE_BACKGROUNDS.filter((b) => !skip.includes(b.id));
  if (usable.length === 0) return doc;
  const current = usable.findIndex((b) => b.id === doc.bgId);
  const base = current < 0 ? 0 : current;
  const next = usable[(base + dir + usable.length) % usable.length];
  return { ...doc, bgId: next.id, updatedAt: new Date().toISOString() };
}

/** 本机存储容错解析：损坏/旧版本/缺字段一律回落 null（调用方新建一份空的） */
export function parseLiveLog(raw: unknown): LiveLogDoc | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const doc = data as Partial<LiveLogDoc>;
  if (doc.version !== LIVE_LOG_VERSION || !Array.isArray(doc.stickers)) return null;
  const stickers: LiveSticker[] = [];
  for (const item of doc.stickers) {
    if (!item || typeof item !== "object") continue;
    const s = item as Partial<LiveSticker>;
    if (typeof s.name !== "string" || !s.name.trim()) continue;
    stickers.push(
      clampSticker({
        id: typeof s.id === "string" && s.id ? s.id : nextId(),
        name: s.name,
        x: Number(s.x),
        y: Number(s.y),
        scale: Number(s.scale),
        rotate: Number(s.rotate),
      })
    );
    if (stickers.length >= LIVE_LOG_MAX_STICKERS) break;
  }
  return {
    version: LIVE_LOG_VERSION,
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : new Date().toISOString(),
    bgId: LIVE_BACKGROUNDS.some((b) => b.id === doc.bgId) ? (doc.bgId as string) : DEFAULT_BACKGROUND_ID,
    stickers,
  };
}
