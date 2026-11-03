/**
 * 图表数学（v2.1 数据面板组件库 · 纯函数层）
 *
 * 为什么独立成 lib 而不是写进组件：
 * - apps/mobile 的 vitest 只跑 `**\/*.test.ts`（environment: node），RN 组件渲染不了；
 *   归一 / 极坐标 / 弧路径 / 热力分档 / 月历网格这些**边界最多**的地方必须能直接单测
 *   （看板踩坑 48：纯逻辑要从 react-native 里摘出来）。
 * - 8 个图表共用同一套口径，组件只负责布局与 token 取色。
 *
 * 约定：
 * - 角度以 **3 点钟方向为 0°、顺时针为正**（屏幕坐标系 y 向下），-90° 即 12 点钟；
 * - 路径字符串里的坐标保留 2 位小数，避免浮点抖动让断言不稳；
 * - 所有函数对 NaN / 负数 / 空数组都返回**可渲染**的结果，绝不抛异常
 *   （图表的脏数据不该让整页白屏）。
 */

export interface Point {
  x: number;
  y: number;
}

/** 统一保留 2 位小数（路径/属性字符串用） */
function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** 有限数兜底：非有限值 → fallback */
function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/* ------------------------------------------------------------------ *
 * 归一
 * ------------------------------------------------------------------ */

/** 夹到 0..1；NaN/Infinity → 0 */
export function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}

/** 线性归一 (value - min) / (max - min)；区间非法（max ≤ min）→ 0 */
export function normalizeMinMax(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

/**
 * 一维序列按**序列最大值**归一（柱图/排行条用）。
 * 空数组 / 全零 / 全脏数据 → 与输入等长的全 0；负值按 0 处理（没有"负柱"）。
 */
export function normalizeByMax(values: readonly number[]): number[] {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const max = safe.reduce((acc, v) => Math.max(acc, v), 0);
  if (max <= 0) return safe.map(() => 0);
  return safe.map((v) => v / max);
}

/** 柱高像素：0..1 归一 + 最小可见高度（零值也留一根短柱，避免"整行空掉"） */
export function barHeight(value01: number, maxHeight: number, minVisible = 3): number {
  const limit = Math.max(0, finiteOr(maxHeight, 0));
  const min = Math.min(Math.max(0, finiteOr(minVisible, 0)), limit);
  return Math.max(min, clamp01(value01) * limit);
}

/** 占比：value / total（total ≤ 0 或脏数据 → 0），不夹上界（>100% 的超额要能显示） */
export function shareOf(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return value / total;
}

/**
 * 排行条的宽度比例（0..1）：按 `max` 归一，省略 `max` 时取序列最大值。
 * 与 `normalizeByMax` 的区别只在于「可显式指定上界」（同一个上界锁住多屏对比）。
 */
export function barShares(values: readonly number[], max?: number): number[] {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const explicit = typeof max === "number" && Number.isFinite(max) && max > 0 ? max : null;
  const upper = explicit ?? safe.reduce((acc, v) => Math.max(acc, v), 0);
  if (upper <= 0) return safe.map(() => 0);
  return safe.map((v) => clamp01(v / upper));
}

/* ------------------------------------------------------------------ *
 * 极坐标 / 弧
 * ------------------------------------------------------------------ */

/**
 * 极坐标 → 直角坐标（屏幕坐标系：y 向下）。
 * `deg` 以 3 点钟方向为 0°、顺时针为正；-90 = 12 点钟，90 = 6 点钟。
 */
export function polarPoint(cx: number, cy: number, r: number, deg: number): Point {
  const rad = (finiteOr(deg, 0) * Math.PI) / 180;
  const radius = Math.max(0, finiteOr(r, 0));
  return {
    x: finiteOr(cx, 0) + radius * Math.cos(rad),
    y: finiteOr(cy, 0) + radius * Math.sin(rad),
  };
}

/**
 * 弧线路径（只描边）：从 `startDeg` 顺时针画到 `endDeg`。
 * 跨度 ≤ 0 / 半径 ≤ 0 → `null`（组件据此跳过该段，而不是画出一条错的线）；
 * 跨度 > 360 时按 359.99° 封顶（真圆请用 <Circle>，单条 A 命令画不出整圈）。
 */
export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string | null {
  const radius = finiteOr(r, 0);
  const start = finiteOr(startDeg, 0);
  const sweep = Math.min(359.99, finiteOr(endDeg, 0) - start);
  if (radius <= 0 || !(sweep > 0.01)) return null;
  const from = polarPoint(cx, cy, radius, start);
  const to = polarPoint(cx, cy, radius, start + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${round2(from.x)} ${round2(from.y)} A ${round2(radius)} ${round2(radius)} 0 ${largeArc} 1 ${round2(to.x)} ${round2(to.y)}`;
}

/** 分段环的一段（角度区间 + 占全部数值的比例） */
export interface SegmentArc {
  start: number;
  end: number;
  /** 该段占全部数值的比例（0..1） */
  ratio: number;
}

/**
 * 分段评分环的角度分配：把 360° 按数值比例切成 n 段，段与段之间留 `gapDeg` 空隙，
 * 整体从 `startDeg`（默认 -90 = 12 点钟）顺时针铺开。
 *
 * - 值为 0 / 负数 / NaN 的段 → 角度 0（组件跳过，但图例仍保留该行 —— 图例是"分类说明"，
 *   不能因为今天没数据就消失）；
 * - 总和为 0 → 返回空数组（组件画一圈空轨道）；
 * - 空隙总量最多占 180°（段数很多时不至于把环挤没）。
 */
export function segmentArcs(values: readonly number[], gapDeg = 8, startDeg = -90): SegmentArc[] {
  const safe = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = safe.reduce((acc, v) => acc + v, 0);
  if (total <= 0) return [];
  const gap = Math.min(180 / safe.length, Math.max(0, finiteOr(gapDeg, 0)));
  const usable = 360 - gap * safe.length;
  let cursor = finiteOr(startDeg, -90);
  return safe.map((value) => {
    const sweep = (value / total) * usable;
    const start = cursor;
    const end = start + sweep;
    cursor = end + gap;
    return { start, end, ratio: value / total };
  });
}

/** 环形进度 → strokeDasharray / strokeDashoffset（周长制，配合 rotate(-90) 从 12 点钟起画） */
export function ringDash(circumference: number, progress: number): { dasharray: string; dashoffset: number } {
  const c = Math.max(0, finiteOr(circumference, 0));
  const p = clamp01(progress);
  return { dasharray: `${round2(c)} ${round2(c)}`, dashoffset: round2(c * (1 - p)) };
}

/** 同心环的单环几何 */
export interface RingLayout {
  /** 中心线半径（描边以它为中心） */
  radius: number;
  strokeWidth: number;
  circumference: number;
}

/**
 * 同心环几何（ActivityRings）：由外到内 n 条环，相邻环**描边之间**留 `gap`。
 * 外缘留 `inset` 防止粗描边被 viewBox 裁掉；半径收不进厚度时提前停止（宁少画不重叠）。
 */
export function activityRingLayout(size: number, count: number, thickness = 12, gap = 6, inset = 2): RingLayout[] {
  const side = Math.max(0, finiteOr(size, 0));
  const stroke = Math.max(0, finiteOr(thickness, 0));
  const gapPx = Math.max(0, finiteOr(gap, 0));
  const insetPx = Math.max(0, finiteOr(inset, 0));
  const n = Math.max(0, Math.floor(finiteOr(count, 0)));
  const rings: RingLayout[] = [];
  const outerCenter = side / 2 - insetPx - stroke / 2;
  if (!(outerCenter > 0) || stroke <= 0) return rings;
  for (let i = 0; i < n; i += 1) {
    const radius = outerCenter - i * (stroke + gapPx);
    // 内圈至少要保住「半径 ≥ 半根描边」，否则环会糊在一起
    if (radius < stroke / 2) break;
    rings.push({ radius: round2(radius), strokeWidth: stroke, circumference: 2 * Math.PI * radius });
  }
  return rings;
}

/** 取色板循环（多序列/多环按序取色；索引越界自动回绕，负数安全） */
export function pickSeriesColor(palette: readonly string[], index: number): string {
  if (!Array.isArray(palette) || palette.length === 0) return "transparent";
  if (!Number.isFinite(index)) return palette[0];
  const i = ((Math.floor(index) % palette.length) + palette.length) % palette.length;
  return palette[i];
}

/**
 * 给 token 色加/覆盖透明度，统一输出 `rgba(r,g,b,a)`。
 * 支持 `#rgb` / `#rrggbb` / `rgb()` / `rgba()`；认不出的写法（如 `transparent`）原样返回，
 * 这样调用方永远拿到一个**能用**的颜色，不需要 try/catch。
 * 为什么不用 `color + "1A"` 拼十六进制：主题里不少 token 本身是 rgba()，拼接会拼出非法色值。
 */
export function withAlpha(color: string, alpha: number): string {
  const value = String(color ?? "").trim();
  if (!value) return value;
  const a = Math.min(1, Math.max(0, finiteOr(alpha, 1)));
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const raw = hex[1];
    const full = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${round2(a)})`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+\s*)?\)$/i.exec(value);
  if (rgb) {
    const r = Math.round(Number(rgb[1]));
    const g = Math.round(Number(rgb[2]));
    const b = Math.round(Number(rgb[3]));
    return `rgba(${r}, ${g}, ${b}, ${round2(a)})`;
  }
  return value;
}

/* ------------------------------------------------------------------ *
 * 热力（月历格）
 * ------------------------------------------------------------------ */

/**
 * 热力强度分档：无数据/0/负数 → 0 档；其余按 ratio 均分 `steps` 档（1..steps），
 * **任何非零值至少 1 档**（否则有记录却和空白一样浅，用户以为没记上）。
 */
export function heatLevel(value: number, max: number, steps = 4): number {
  const n = Math.max(1, Math.floor(finiteOr(steps, 4)));
  if (!Number.isFinite(value) || value <= 0) return 0;
  const upper = Number.isFinite(max) && max > 0 ? max : 1;
  const ratio = value / upper;
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(n, Math.max(1, Math.ceil(ratio * n)));
}

/** 热力档位 → 主色透明度（0 档 = 0，最高档 = 1；中间档线性均分） */
export function heatAlpha(level: number, steps = 4): number {
  const n = Math.max(1, Math.floor(finiteOr(steps, 4)));
  const lv = Math.max(0, Math.min(n, Math.floor(finiteOr(level, 0))));
  if (lv <= 0) return 0;
  if (n === 1) return 1;
  return round2(0.16 + ((lv - 1) / (n - 1)) * 0.84);
}

/** 月历热力格 */
export interface HeatmapCell {
  /** 本地日 YYYY-MM-DD */
  key: string;
  /** 1..31 */
  day: number;
  /** 0 = 周一 … 6 = 周日（与 weekStartsOn 对齐后的列序） */
  weekday: number;
  /** 0..steps 的强度档 */
  level: number;
}

export interface HeatmapMonth {
  /** 长度恒为 7 的倍数；补位为 null */
  cells: (HeatmapCell | null)[];
  weeks: number;
  /** 本月参与着色的最大值（无数据为 0） */
  max: number;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function dateKeyOf(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function daysInMonthOf(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function normalizeWeekday(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return ((Math.floor(value) % 7) + 7) % 7;
}

/**
 * 月历热力网格（**周一起**，与 GitHub 贡献格一致；旧 `month-grid.ts` 是周日首列，
 * 餐饮月历沿用旧口径，这里不复用，避免改坏已上线的日历）。
 *
 * `month` 为 0 基（与 `new Date` 一致）。返回的 cells 已补 null 到 7 的倍数，
 * 可直接按 `weeks` 行 7 列渲染。
 */
export function buildHeatmapMonth(options: {
  year: number;
  month: number;
  /** dateKey → 数值；缺省 = 无数据 */
  values?: Record<string, number> | null;
  /** 着色上界；缺省取本月最大值 */
  max?: number;
  steps?: number;
  /** 每周首日：1 = 周一（默认），0 = 周日 */
  weekStartsOn?: number;
}): HeatmapMonth {
  const { year, month, values } = options;
  const steps = options.steps ?? 4;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) {
    return { cells: [], weeks: 0, max: 0 };
  }
  const weekStartsOn = normalizeWeekday(options.weekStartsOn ?? 1);
  const total = daysInMonthOf(year, month);
  const firstWeekday = new Date(year, month, 1).getDay();
  const lead = (firstWeekday - weekStartsOn + 7) % 7;
  const source = values ?? {};

  let monthMax = 0;
  for (let day = 1; day <= total; day += 1) {
    const raw = source[dateKeyOf(year, month, day)];
    if (Number.isFinite(raw) && raw > monthMax) monthMax = raw;
  }
  const maxOption = options.max;
  const upper =
    typeof maxOption === "number" && Number.isFinite(maxOption) && maxOption > 0
      ? maxOption
      : monthMax > 0
        ? monthMax
        : 1;

  const cells: (HeatmapCell | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let day = 1; day <= total; day += 1) {
    const key = dateKeyOf(year, month, day);
    cells.push({
      key,
      day,
      weekday: (new Date(year, month, day).getDay() - weekStartsOn + 7) % 7,
      level: heatLevel(source[key] ?? 0, upper, steps),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, weeks: cells.length / 7, max: monthMax };
}

/* ------------------------------------------------------------------ *
 * 折线 / 面积
 * ------------------------------------------------------------------ */

/** 绘图区：宽度/高度 + 可选内边距 */
export interface PlotRect {
  width: number;
  height: number;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}

export interface SeriesPoint extends Point {
  index: number;
  /** 原始值（未归一） */
  value: number;
  /** 归一值 0..1 */
  ratio: number;
}

function innerRect(rect: PlotRect) {
  const width = Math.max(0, finiteOr(rect.width, 0));
  const height = Math.max(0, finiteOr(rect.height, 0));
  const pad = rect.padding ?? {};
  const top = Math.max(0, finiteOr(pad.top ?? 0, 0));
  const right = Math.max(0, finiteOr(pad.right ?? 0, 0));
  const bottom = Math.max(0, finiteOr(pad.bottom ?? 0, 0));
  const left = Math.max(0, finiteOr(pad.left ?? 0, 0));
  return {
    top,
    left,
    width: Math.max(0, width - left - right),
    height: Math.max(0, height - top - bottom),
  };
}

/**
 * 把一维数值映射成绘图区内的点（y 向下，值越大越靠上）。
 * 单点时放在水平中央（否则会被画在左边缘，视觉上像"漏了一个点"）。
 * domain 省略时用 [0, 序列最大值]；最大值与最小值相同时抬高一格避免除零。
 */
export function mapSeriesPoints(
  values: readonly number[],
  rect: PlotRect,
  domain: { min?: number; max?: number } = {}
): SeriesPoint[] {
  const box = innerRect(rect);
  const safe = values.map((v) => finiteOr(v, 0));
  const min = Number.isFinite(domain.min) ? (domain.min as number) : 0;
  const autoMax = safe.reduce((acc, v) => Math.max(acc, v), min);
  const maxOption = domain.max;
  const max = typeof maxOption === "number" && Number.isFinite(maxOption) ? maxOption : autoMax;
  const upper = max > min ? max : min + 1;
  const count = safe.length;
  return safe.map((value, index) => {
    const ratio = normalizeMinMax(value, min, upper);
    const x = count <= 1 ? box.left + box.width / 2 : box.left + (index / (count - 1)) * box.width;
    const y = box.top + box.height * (1 - ratio);
    return { x, y, value, ratio, index };
  });
}

/**
 * 折线路径。
 * `curve = false` → 直线段（M/L）；`true` → Catmull-Rom 转三次贝塞尔（平滑，节点仍过采样点）。
 * 空数组 → 空字符串（SVG 对空 d 不渲染，不会报错）。
 */
export function linePath(points: readonly Point[], curve = false, tension = 0.2): string {
  if (!Array.isArray(points) || points.length === 0) return "";
  const first = points[0];
  if (points.length === 1) return `M ${round2(first.x)} ${round2(first.y)}`;
  const parts = [`M ${round2(first.x)} ${round2(first.y)}`];
  if (!curve) {
    for (let i = 1; i < points.length; i += 1) {
      parts.push(`L ${round2(points[i].x)} ${round2(points[i].y)}`);
    }
    return parts.join(" ");
  }
  const t = Math.min(0.5, Math.max(0, finiteOr(tension, 0.2)));
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    parts.push(
      `C ${round2(c1x)} ${round2(c1y)} ${round2(c2x)} ${round2(c2y)} ${round2(p2.x)} ${round2(p2.y)}`
    );
  }
  return parts.join(" ");
}

/**
 * 面积路径：折线 + 落到 `baseY` 的闭合（渐变填充用）。
 * 少于 2 个点 → 空字符串（一个点没有面积可言）。
 */
export function areaPath(points: readonly Point[], baseY: number, curve = false, tension = 0.2): string {
  if (!Array.isArray(points) || points.length < 2) return "";
  const line = linePath(points, curve, tension);
  if (!line) return "";
  const last = points[points.length - 1];
  const first = points[0];
  const base = round2(finiteOr(baseY, 0));
  return `${line} L ${round2(last.x)} ${base} L ${round2(first.x)} ${base} Z`;
}

/* ------------------------------------------------------------------ *
 * 雷达
 * ------------------------------------------------------------------ */

/** 雷达轴角度：n 维从 12 点钟（-90°）开始顺时针均分 */
export function radarAxisAngles(count: number, startDeg = -90): number[] {
  const n = Math.max(1, Math.floor(finiteOr(count, 0)));
  const start = finiteOr(startDeg, -90);
  return Array.from({ length: n }, (_, i) => start + (360 / n) * i);
}

/** 雷达多边形顶点：values 为每维 0..1 的完成度（缺省维按 0） */
export function radarPoints(
  values: readonly number[],
  cx: number,
  cy: number,
  radius: number,
  startDeg = -90
): Point[] {
  const list = values.length > 0 ? values : [0];
  return radarAxisAngles(list.length, startDeg).map((deg, i) =>
    polarPoint(cx, cy, Math.max(0, finiteOr(radius, 0)) * clamp01(list[i] ?? 0), deg)
  );
}

/** SVG `<Polygon points>` 属性：`"x,y x,y …"` */
export function polygonPoints(points: readonly Point[]): string {
  if (!Array.isArray(points) || points.length === 0) return "";
  return points.map((p) => `${round2(p.x)},${round2(p.y)}`).join(" ");
}

/** 轴标签的 textAnchor：按 cos 分量决定左/中/右，避免标签压到多边形上 */
export function radarLabelAnchor(deg: number): "start" | "middle" | "end" {
  const cos = Math.cos((finiteOr(deg, 0) * Math.PI) / 180);
  if (cos > 0.2) return "start";
  if (cos < -0.2) return "end";
  return "middle";
}

/* ------------------------------------------------------------------ *
 * 文案（统计口径统一，避免各页面各写一套）
 * ------------------------------------------------------------------ */

export type DeltaDirection = "up" | "down" | "flat";

/** 升降方向：0（含浮点误差）算持平 */
export function deltaDirection(delta: number): DeltaDirection {
  if (!Number.isFinite(delta) || Math.abs(delta) < 1e-9) return "flat";
  return delta > 0 ? "up" : "down";
}

/**
 * 变动胶囊的色调：默认"涨=好"；`invert` 用于**反向指标**（体脂率、耗时、错误率 —— 降才是好）。
 * 返回语义名而不是色值，组件再用 useTheme() 映射成 token。
 */
export function deltaTone(delta: number, invert = false): "success" | "danger" | "muted" {
  const direction = deltaDirection(delta);
  if (direction === "flat") return "muted";
  const good = invert ? direction === "down" : direction === "up";
  return good ? "success" : "danger";
}

/** 带符号的变动文案：`12 → "+12%"`、`-3.2 → "-3.2%"`、`0 → "0%"`；脏数据 → "—" */
export function formatDelta(delta: number, suffix = "%", digits = 0): string {
  if (!Number.isFinite(delta)) return "—";
  const rounded = Number(delta.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "";
  return `${sign}${Math.abs(rounded).toFixed(digits)}${suffix}`;
}

/** 比例 → 百分比文案：`0.864 → "86%"`；脏数据 → "—" */
export function formatPercent(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** "2026-06-29" + "2026-07-05" → "6/29-7/5"（周切换头部标注；跨年也照样省略年份） */
export function formatMonthDayRange(startKey: string, endKey: string): string {
  const parse = (key: string): { month: number; day: number } | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key ?? "").trim());
    if (!match) return null;
    return { month: Number(match[2]), day: Number(match[3]) };
  };
  const from = parse(startKey);
  const to = parse(endKey);
  if (!from || !to) return "";
  return `${from.month}/${from.day}-${to.month}/${to.day}`;
}
