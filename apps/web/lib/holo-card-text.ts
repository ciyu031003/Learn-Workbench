/**
 * 运动闪光卡 · 卡面文字层（纯 canvas 绘制，无 three 依赖）。
 *
 * 来源：sports-cards 素材里的 text.png 是「印死在图里」的文字层；
 * 这里改成按档案数据实时合成，卡面才能显示我们自己的战绩与装备。
 * 版式尺寸与源图 1728×2368 对齐（同一套比例，替换文字不会错位）。
 */
import type { SportsCardModel } from "@learn-workbench/shared";

export const CARD_TEXT_WIDTH = 1728;
export const CARD_TEXT_HEIGHT = 2368;

const MARGIN_X = 116;
const RULE_TOP_Y = 374;
const RULE_BOTTOM_Y = 1974;
const PANEL_X = 144;
const PANEL_W = 1442;
const PANEL_TOP = 481;
const PANEL_PAD = 46;
const ROW_STEP = 202;
const PANEL_HEAD = 190;
const FLAG_BLOCK = 150;
const FLAG_H = 71;
const FLAG_GAP = 22;
const FLAG_FONT = 30;
const COL_LEFT_X = PANEL_X + PANEL_PAD;
const COL_RIGHT_X = PANEL_X + PANEL_PAD + 663;
const COL_LEFT_W = COL_RIGHT_X - COL_LEFT_X - 40;
const COL_RIGHT_W = PANEL_X + PANEL_W - PANEL_PAD - COL_RIGHT_X;

const GOLD = "#d9b978";
const GOLD_DEEP = "#a9863f";
const MUTED = "#c3ccd6";
const PAPER = "#ffffff";

const FONT_SANS = '\"Microsoft YaHei\", \"PingFang SC\", \"Noto Sans SC\", sans-serif';
const FONT_SERIF = '\"KaiTi\", \"STKaiti\", \"Songti SC\", serif';
const FONT_EN = 'Georgia, \"Times New Roman\", serif';

export interface HoloTextSlot {
  text: string;
  x: number;
  y: number;
  size: number;
  align: CanvasTextAlign;
  color: string;
  /** 描边色（标题 / 绝技这类空心大字） */
  stroke?: string;
  strokeWidth?: number;
  letterSpacing?: number;
  maxWidth?: number;
  serif?: boolean;
  en?: boolean;
  bold?: boolean;
}

export interface HoloCardLayout {
  width: number;
  height: number;
  panel: { x: number; y: number; w: number; h: number; radius: number };
  rules: { x1: number; y1: number; x2: number; y2: number }[];
  slots: HoloTextSlot[];
  flags: { text: string; x: number; y: number; w: number; h: number }[];
}

/** 卡面版式：同样的输入永远得到同样的几何，方便单测与「导出图片」复用 */
export function cardTextLayout(model: SportsCardModel): HoloCardLayout {
  const rows = Math.max(model.rowsLeft.length, model.rowsRight.length);
  const flags = model.flags.slice(0, 4);
  const panelH = PANEL_HEAD + rows * ROW_STEP + (flags.length > 0 ? FLAG_BLOCK : 60) + 30;

  const slots: HoloTextSlot[] = [
    { text: model.subtitle, x: MARGIN_X, y: 101, size: 28, align: "left", color: GOLD_DEEP, letterSpacing: 6, en: true },
    { text: model.title, x: MARGIN_X - 6, y: 253, size: 121, align: "left", color: PAPER, stroke: GOLD, strokeWidth: 3, serif: true },
    { text: model.collection, x: MARGIN_X, y: 324, size: 33, align: "left", color: GOLD },
    { text: model.panelTitle, x: COL_LEFT_X, y: 562, size: 38, align: "left", color: GOLD, serif: true },
  ];

  const pushRows = (list: [string, string][], x: number, maxWidth: number, offset: number) => {
    list.forEach((row, i) => {
      const labelY = PANEL_TOP + PANEL_HEAD + i * ROW_STEP;
      slots.push({ text: row[0], x, y: labelY + offset, size: 33, align: "left", color: MUTED, maxWidth });
      slots.push({ text: row[1], x, y: labelY + 63, size: 46, align: "left", color: PAPER, maxWidth, bold: true });
    });
  };
  pushRows(model.rowsLeft, COL_LEFT_X, COL_LEFT_W, 0);
  pushRows(model.rowsRight, COL_RIGHT_X, COL_RIGHT_W, 0);

  slots.push(
    { text: model.tagline, x: CARD_TEXT_WIDTH / 2, y: 2024, size: 38, align: "center", color: GOLD },
    { text: model.technique, x: CARD_TEXT_WIDTH / 2, y: 2145, size: 101, align: "center", color: PAPER, stroke: GOLD, strokeWidth: 3, serif: true },
    { text: model.edition, x: MARGIN_X, y: 2265, size: 28, align: "left", color: MUTED, letterSpacing: 3, en: true },
    { text: "HOLOGRAPHIC", x: CARD_TEXT_WIDTH - MARGIN_X, y: 2265, size: 28, align: "right", color: MUTED, letterSpacing: 3, en: true },
  );

  // 徽章（公开成绩）：先给个等宽估算，真正绘制时会按文字宽度重排
  const flagY = PANEL_TOP + PANEL_HEAD + rows * ROW_STEP + 40;
  const flagSlots = flags.map((text, i) => ({
    text,
    x: COL_LEFT_X + i * 0,
    y: flagY,
    w: 0,
    h: FLAG_H,
  }));

  return {
    width: CARD_TEXT_WIDTH,
    height: CARD_TEXT_HEIGHT,
    panel: { x: PANEL_X, y: PANEL_TOP, w: PANEL_W, h: panelH, radius: 40 },
    rules: [
      { x1: MARGIN_X, y1: RULE_TOP_Y, x2: CARD_TEXT_WIDTH - MARGIN_X, y2: RULE_TOP_Y },
      { x1: MARGIN_X, y1: RULE_BOTTOM_Y, x2: CARD_TEXT_WIDTH - MARGIN_X, y2: RULE_BOTTOM_Y },
    ],
    slots,
    flags: flagSlots,
  };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0 || ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) out = out.slice(0, -1);
  return out + "…";
}

function fontOf(slot: HoloTextSlot): string {
  const family = slot.en ? FONT_EN : slot.serif ? FONT_SERIF : FONT_SANS;
  const weight = slot.bold ? "600 " : "400 ";
  return weight + slot.size + "px " + family;
}

/** 把卡面文字层画进 2D 画布（离屏画布由调用方创建） */
export function drawCardTextLayer(ctx: CanvasRenderingContext2D, model: SportsCardModel, layout?: HoloCardLayout): void {
  const l = layout ?? cardTextLayout(model);
  ctx.clearRect(0, 0, l.width, l.height);

  // 信息面板
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(l.panel.x, l.panel.y, l.panel.w, l.panel.h, l.panel.radius);
  ctx.fillStyle = "rgba(38, 46, 58, 0.94)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(217, 185, 120, 0.55)";
  ctx.stroke();
  ctx.restore();

  // 分隔线
  ctx.save();
  ctx.strokeStyle = "rgba(169, 134, 63, 0.85)";
  ctx.lineWidth = 2;
  for (const r of l.rules) {
    ctx.beginPath();
    ctx.moveTo(r.x1, r.y1);
    ctx.lineTo(r.x2, r.y2);
    ctx.stroke();
  }
  ctx.restore();

  // 文字
  for (const slot of l.slots) {
    ctx.save();
    ctx.font = fontOf(slot);
    ctx.textAlign = slot.align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = slot.color;
    if (slot.letterSpacing && "letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = slot.letterSpacing + "px";
    }
    const text = fitText(ctx, slot.text, slot.maxWidth ?? 0);
    if (slot.stroke) {
      ctx.lineWidth = slot.strokeWidth ?? 2;
      ctx.strokeStyle = slot.stroke;
      ctx.strokeText(text, slot.x, slot.y);
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    }
    ctx.fillText(text, slot.x, slot.y);
    ctx.restore();
  }

  // 徽章
  if (l.flags.length > 0) {
    ctx.save();
    ctx.font = "400 " + FLAG_FONT + "px " + FONT_SANS;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let x = COL_LEFT_X;
    for (const flag of l.flags) {
      const w = ctx.measureText(flag.text).width + 52;
      if (x + w > PANEL_X + PANEL_W - PANEL_PAD) break;
      ctx.beginPath();
      ctx.roundRect(x, flag.y, w, flag.h, flag.h / 2);
      ctx.fillStyle = "rgba(217, 185, 120, 0.10)";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(217, 185, 120, 0.55)";
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.fillText(flag.text, x + 26, flag.y + flag.h / 2 + 1);
      x += w + FLAG_GAP;
    }
    ctx.restore();
  }
}

/** 生成卡面文字层画布（浏览器环境；供 three 当贴图或降级方案直接显示） */
export function createCardTextCanvas(model: SportsCardModel): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_TEXT_WIDTH;
  canvas.height = CARD_TEXT_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) drawCardTextLayer(ctx, model);
  return canvas;
}

/** 卡片素材路径（Web 端 public/holo/<sportKey>/<layer>.webp） */
export const HOLO_LAYERS = ["subject", "background", "lineart"] as const;
export type HoloLayer = (typeof HOLO_LAYERS)[number];

/** 有闪光卡素材的运动项目（其余项目只显示普通档案卡） */
export const HOLO_SPORTS = ["badminton", "tennis", "basketball", "volleyball", "table-tennis", "soccer", "baseball"] as const;

export function hasHoloArt(sportKey: string): boolean {
  return (HOLO_SPORTS as readonly string[]).includes(sportKey);
}

export function holoAssetUrl(sportKey: string, layer: HoloLayer | "card.glb", base = "/holo"): string {
  return layer === "card.glb" ? base + "/card.glb" : base + "/" + sportKey + "/" + layer + ".webp";
}
