/**
 * 其余领域纯函数（营养 / 运动 / 习惯 / 求职 / 就绪度等）。
 *
 * 由原 src/index.ts 拆出（S3-2 subpath exports）；index.ts 仍以 barrel 形式保留兼容。
 */
import type { Habit, HabitStats, JobCrawlerConfig, MealEntry, SportsProfile, SportsShare, Workout, WorkoutItem } from "./schemas";
import type { BodyProfile, CalorieTargetResult, DailyReadiness, DailyReadinessInput, EquipmentCategoryMeta, ExerciseCatalogItem, ExerciseFilterable, FoodItemHit, HabitLogLike, JobFreshness, MacroStatus, NormalizedSportGear, NutritionRange, NutritionTargetView, NutritionTotals, ResumeTemplate, SportGearKind, SportGearRow, SportItem, SportsCardModel, SportsRecord, TrainingLoadDay, TrainingLoadMetric, TrainingLoadSeries } from "./types";
import { ACTIVITY_FACTORS, COMMON_WEAK_PASSWORDS, DAILY_READINESS_WEIGHTS, DEFAULT_NUTRITION_TARGETS, DEFAULT_SPORT_GEAR_LABELS, EQUIPMENT_CATEGORIES, EXERCISE_CATALOG, KCAL_TARGET_MAX, KCAL_TARGET_MIN, LEGACY_GEAR_LABEL_ALIASES, RESUME_TEMPLATES, SPORTS_CARD_PANEL_TITLE, SPORT_ARCHIVE_EN, SPORT_CATALOG, SPORT_GEAR_TEMPLATES, TRAINING_LOAD_MIN_HEIGHT, allJobCategories, defaultCrawlerPlatforms, jobSourceLabels } from "./labels";
import { isScheduled, toDateKey } from "./dates";

/** 证书有效期提醒（V3）：按到期天数分档，供 UI 显示「30 天后到期」等徽标 */
export function certificateExpiryInfo(
  expiryDate: string | null | undefined,
  now: Date = new Date()
): { level: "none" | "expired" | "soon" | "ok"; days: number | null; label: string } {
  if (!expiryDate) return { level: "none", days: null, label: "" };
  const end = Date.parse(expiryDate);
  if (!Number.isFinite(end)) return { level: "none", days: null, label: "" };
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.parse(`${expiryDate.slice(0, 10)}T00:00:00Z`);
  const days = Math.round((target - today) / 86_400_000);
  if (days < 0) return { level: "expired", days, label: `已过期 ${Math.abs(days)} 天` };
  if (days <= 30) return { level: "soon", days, label: `${days} 天后到期` };
  return { level: "ok", days, label: `有效至 ${expiryDate.slice(0, 10)}` };
}

export function getResumeTemplate(key: string | null | undefined): ResumeTemplate {
  return RESUME_TEMPLATES.find((t) => t.key === key) ?? RESUME_TEMPLATES[0];
}

export function sportItemByKey(key: string): SportItem | undefined {
  return SPORT_CATALOG.find((s) => s.key === key);
}

export function exerciseByKey(key: string): ExerciseCatalogItem | undefined {
  return EXERCISE_CATALOG.find((e) => e.key === key);
}

/**
 * 动作检索（纯函数，Web 路由与移动端面板共用）：
 * - `q`：匹配中文名 / key / 器械 / 部位（输入「胸」「杠铃」也能筛）
 * - `category`：按分类精确过滤（大小写不敏感，`ALL`/空 = 不过滤）
 * - `limit`：截断条数（**钳位由调用方用 readIntParam 完成**，这里只做 0..n 的安全截断）
 *
 * 泛型是为了让调用方的额外字段（例如 API 返回的 `id`）原样保留。
 */
export function filterExercises<T extends ExerciseFilterable>(
  items: T[],
  opts: { q?: string | null; category?: string | null; limit?: number } = {}
): T[] {
  const q = (opts.q ?? "").trim().toLowerCase();
  const category = (opts.category ?? "").trim().toUpperCase();
  let out = items;
  if (category && category !== "ALL") {
    out = out.filter((i) => i.category === category);
  }
  if (q) {
    out = out.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.key.includes(q) ||
        (i.equipment ?? "").includes(q) ||
        i.muscleGroup.includes(q)
    );
  }
  if (typeof opts.limit === "number" && Number.isFinite(opts.limit)) {
    out = out.slice(0, Math.max(0, Math.floor(opts.limit)));
  }
  return out;
}

/**
 * 卡路里估算（MET 模型）：kcal = MET × 体重kg × 时长小时。
 * met 取自运动注册表（sport_items.met）；customMet 用于无注册表匹配时的按大类兜底。
 */
export function sportCalories(met: number, weightKg: number, durationSeconds: number): number {
  if (!(met > 0) || !(weightKg > 0) || !(durationSeconds > 0)) return 0;
  return Math.round((met * weightKg * (durationSeconds / 3600)) * 10) / 10;
}

export function jobSourceLabel(source: string): string {
  return jobSourceLabels[source] ?? source;
}

export const defaultCrawlerConfig: JobCrawlerConfig = {
  keywords: [],
  industries: [],
  cities: [],
  platforms: defaultCrawlerPlatforms,
  categories: allJobCategories,
  provinces: [],
  sources: [],
  scheduleTime: "08:00",
  enabled: true,
  maxPages: 3,
  lastRunAt: null,
};

/**
 * 职位新鲜度（规则版，按渠道区分）
 * - job 渠道：基于 published_at（缺失时用 fetched_at）
 *   🟢 <1天 刚发布 · 🔵 3天内 · 🟡 7天内 · ⚪ 14天内 · 🔴 >30天 可能已失效
 * - announcement/event 渠道：基于 deadline_at 倒计时（deadline 等级）
 */
export function jobFreshness(
  publishedAt: string | null,
  fetchedAt: string,
  deadlineAt: string | null,
  channel: "job" | "announcement" | "event" = "job"
): JobFreshness {
  if (channel !== "job" && deadlineAt) {
    const t = new Date(deadlineAt).getTime();
    if (!Number.isNaN(t)) {
      const days = Math.ceil((t - Date.now()) / 86400000);
      if (days < 0) return { level: "stale", label: "已截止", emoji: "🔴", badgeClass: "bg-rose-500/15 text-rose-500 dark:text-rose-300" };
      if (days === 0) return { level: "deadline", label: "今日截止", emoji: "⏰", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
      if (days <= 3) return { level: "deadline", label: `${days} 天后截止`, emoji: "⏰", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
      if (days <= 7) return { level: "deadline", label: `${days} 天后截止`, emoji: "🗓", badgeClass: "bg-indigo-500/15 text-indigo-500 dark:text-indigo-300" };
      return { level: "deadline", label: `${days} 天后截止`, emoji: "🗓", badgeClass: "bg-white/10 text-muted-foreground" };
    }
  }
  const base = publishedAt || fetchedAt;
  const t = new Date(base).getTime();
  if (Number.isNaN(t)) return { level: "within14", label: "时间未知", emoji: "⚪", badgeClass: "bg-white/10 text-muted-foreground" };
  const hours = (Date.now() - t) / 3600000;
  if (hours < 24) return { level: "just", label: "刚发布", emoji: "🟢", badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" };
  const days = hours / 24;
  if (days < 3) return { level: "within3", label: "3 天内", emoji: "🔵", badgeClass: "bg-sky-500/15 text-sky-600 dark:text-sky-300" };
  if (days < 7) return { level: "within7", label: "7 天内", emoji: "🟡", badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300" };
  if (days < 14) return { level: "within14", label: "14 天内", emoji: "⚪", badgeClass: "bg-white/10 text-muted-foreground" };
  if (days < 30) return { level: "within14", label: "超 14 天", emoji: "⚪", badgeClass: "bg-white/10 text-muted-foreground" };
  return { level: "stale", label: "可能已失效", emoji: "🔴", badgeClass: "bg-rose-500/15 text-rose-500 dark:text-rose-300" };
}

/** 职位文本规范化（去重键）：小写、去空白、去括号内容、去公司常见后缀 */
export function normalizeJobText(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[（(].*?[)）]/g, "")   // 去括号内容
    .replace(/[\s\u3000\-—_·.]+/g, "")   // 去空白/连字符
    .replace(/有限公司|股份有限公司|集团|公司|科技|技术|有限/g, "")
    .trim();
}

/** 职位去重键：规范化标题 + 公司 + 城市 */
export function jobDedupKey(title: string, company: string, city: string): string {
  return [normalizeJobText(title), normalizeJobText(company), (city ?? "").trim()].join("|");
}

/** HH:MM（00:00–23:59），空串/null 视为「不限定」 */
export const HABIT_TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** 归一化时间段输入：非法或空 → null */
export function normalizeHabitTime(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return HABIT_TIME_RE.test(v) ? v : null;
}

/** 时间段展示文案（如 07:00–08:00）；两端都空 → null */
export function habitTimeLabel(habit: Pick<Habit, "remindStart" | "remindEnd">): string | null {
  const s = normalizeHabitTime(habit.remindStart);
  const e = normalizeHabitTime(habit.remindEnd);
  if (!s || !e) return null;
  return `${s}–${e}`;
}

/** 某习惯在某天是否算「完成」：布尔型 value>=1；量化型 value>=target（无目标则 >=1） */
export function isHabitDone(habit: Pick<Habit, "isBoolean" | "targetValue">, value: number): boolean {
  const v = Number.isFinite(value) ? value : 0;
  if (habit.isBoolean) return v >= 1;
  const target = habit.targetValue ?? 0;
  return target > 0 ? v >= target : v >= 1;
}

/**
 * 计算习惯统计（纯函数，前端与服务端共用）：
 * - currentStreak：从今天（或今天未完成时从昨天）向前数，遇到「排期内但未完成」即中断；
 *   非排期日跳过、不中断。
 * - longestStreak：全区间内最长连续段（同样跳过非排期日）。
 * - weekRate/monthRate：区间内「排期日」的完成比例。
 */
export function computeHabitStats(
  habit: Pick<Habit, "id" | "isBoolean" | "targetValue" | "schedule">,
  logs: HabitLogLike[],
  today: Date = new Date()
): HabitStats {
  const doneByDate = new Map<string, boolean>();
  for (const l of logs) {
    if (l.habitId !== habit.id) continue;
    const key = l.logDate.slice(0, 10);
    // 同一天多条取最大完成度
    const prev = doneByDate.get(key) ?? false;
    doneByDate.set(key, prev || isHabitDone(habit, l.value));
  }

  const dayDone = (d: Date) => doneByDate.get(toDateKey(d)) === true;

  // ---- currentStreak ----
  let current = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // 今天若未完成且是排期日，不算中断（今天还没结束）
  if (isScheduled(habit.schedule, cursor) && !dayDone(cursor)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  // 向前最多回溯 2 年，避免死循环
  for (let i = 0; i < 730; i++) {
    if (!isScheduled(habit.schedule, cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (dayDone(cursor)) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // ---- longestStreak（回溯 365 天窗口）----
  let longest = 0;
  let run = 0;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  start.setDate(start.getDate() - 365);
  const walk = new Date(start);
  for (let i = 0; i <= 365; i++) {
    if (!isScheduled(habit.schedule, walk)) {
      walk.setDate(walk.getDate() + 1);
      continue;
    }
    if (dayDone(walk)) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
    walk.setDate(walk.getDate() + 1);
  }
  if (current > longest) longest = current;

  // ---- 完成率 ----
  const rate = (days: number): number => {
    let scheduledDays = 0;
    let doneDays = 0;
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    for (let i = 0; i < days; i++) {
      if (isScheduled(habit.schedule, d)) {
        scheduledDays += 1;
        if (dayDone(d)) doneDays += 1;
      }
      d.setDate(d.getDate() - 1);
    }
    return scheduledDays === 0 ? 0 : Math.round((doneDays / scheduledDays) * 100);
  };

  return {
    habitId: habit.id,
    currentStreak: current,
    longestStreak: longest,
    doneToday: dayDone(today),
    weekRate: rate(7),
    monthRate: rate(30),
  };
}

/** 单次训练容量（总组数 / 总次数 / 总重量 kg） */
export function workoutVolume(items: Pick<WorkoutItem, "sets" | "reps" | "weightKg">[]): {
  sets: number;
  reps: number;
  volumeKg: number;
} {
  let sets = 0;
  let reps = 0;
  let volumeKg = 0;
  for (const it of items) {
    const s = Number(it.sets) || 0;
    const r = Number(it.reps) || 0;
    sets += s;
    reps += s * r;
    volumeKg += s * r * (Number(it.weightKg) || 0);
  }
  return { sets, reps, volumeKg: Math.round(volumeKg) };
}

/**
 * 生成最近 `dayCount` 天（含 `endDate` 当天）的训练负荷序列。
 * 纯函数，不读系统时间之外的东西 —— 便于单测与 Web/移动端共用。
 */
export function trainingLoadSeries(
  workouts: Pick<Workout, "exercisedOn" | "items" | "durationSeconds">[],
  dayCount: number,
  endDate: Date = new Date()
): TrainingLoadSeries {
  const safeCount = Math.max(1, Math.round(dayCount));
  const days: TrainingLoadDay[] = [];

  for (let i = 0; i < safeCount; i += 1) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (safeCount - 1 - i));
    const key = toDateKey(d);
    const ofDay = workouts.filter((w) => String(w.exercisedOn ?? "").slice(0, 10) === key);
    const v = workoutVolume(ofDay.flatMap((w) => w.items ?? []));
    days.push({
      key,
      weekday: d.getDay(),
      sessions: ofDay.length,
      sets: v.sets,
      reps: v.reps,
      volumeKg: v.volumeKg,
      durationSeconds: ofDay.reduce((sum, w) => sum + (Number(w.durationSeconds) || 0), 0),
      value: 0,
      height: 0,
    });
  }

  const hasPositive = (pick: (d: TrainingLoadDay) => number) => days.some((d) => pick(d) > 0);
  const metric: TrainingLoadMetric = hasPositive((d) => d.volumeKg)
    ? "volume"
    : hasPositive((d) => d.reps)
      ? "reps"
      : hasPositive((d) => d.sets)
        ? "sets"
        : "sessions";

  const valueOf = (d: TrainingLoadDay) =>
    metric === "volume" ? d.volumeKg : metric === "reps" ? d.reps : metric === "sets" ? d.sets : d.sessions;

  for (const d of days) d.value = valueOf(d);
  const max = Math.max(1, ...days.map((d) => d.value));
  for (const d of days) {
    d.height =
      d.value > 0
        ? Math.max(TRAINING_LOAD_MIN_HEIGHT, Math.round((d.value / max) * 100))
        : d.sessions > 0
          ? TRAINING_LOAD_MIN_HEIGHT
          : 0;
  }

  return {
    metric,
    max,
    days,
    total: {
      sessions: days.reduce((s, d) => s + d.sessions, 0),
      sets: days.reduce((s, d) => s + d.sets, 0),
      reps: days.reduce((s, d) => s + d.reps, 0),
      volumeKg: days.reduce((s, d) => s + d.volumeKg, 0),
      durationSeconds: days.reduce((s, d) => s + d.durationSeconds, 0),
    },
  };
}

/** 汇总某日营养摄入 */
export function sumNutrition(entries: Pick<MealEntry, "kcal" | "proteinG" | "carbsG" | "fatG">[]): NutritionTotals {
  const out: NutritionTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const e of entries) {
    out.kcal += Number(e.kcal) || 0;
    out.proteinG += Number(e.proteinG) || 0;
    out.carbsG += Number(e.carbsG) || 0;
    out.fatG += Number(e.fatG) || 0;
  }
  out.kcal = Math.round(out.kcal);
  out.proteinG = Math.round(out.proteinG);
  out.carbsG = Math.round(out.carbsG);
  out.fatG = Math.round(out.fatG);
  return out;
}

/** 由单值目标推出区间（默认 ±12%，四舍五入；最小宽度 1g） */
export function nutritionTargetRange(value: number, spread = 0.12): NutritionRange {
  const v = Number.isFinite(value) && value > 0 ? value : 0;
  const delta = Math.max(1, v * spread);
  return { min: Math.max(0, Math.round(v - delta)), max: Math.round(v + delta) };
}

/** 落在区间内的判定（用于"达标绿"） */
export function withinRange(value: number, range: NutritionRange): boolean {
  const v = Number.isFinite(value) ? value : 0;
  return v >= range.min && v <= range.max;
}

export function macroStatus(value: number, range: NutritionRange): MacroStatus {
  const v = Number.isFinite(value) ? value : 0;
  if (v < range.min) return "under";
  if (v > range.max) return "over";
  return "in";
}

/** 今日剩余可吃（可为负 = 已超出；D2：以「剩余」为主角） */
export function remainingKcal(eatenKcal: number, targetKcal: number): number {
  const eaten = Number.isFinite(eatenKcal) ? eatenKcal : 0;
  const target = Number.isFinite(targetKcal) && targetKcal > 0 ? targetKcal : 0;
  return Math.round(target - eaten);
}

/**
 * 剩余热量的"人话"换算（借小卡健康「≈ 几只苹果」的手法，只给一条，避免啰嗦）。
 * 以 100 kcal ≈ 半碗米饭 为基准，取最贴近的一项。
 */
export function kcalEquivalentText(kcal: number): string {
  const v = Math.abs(Math.round(Number.isFinite(kcal) ? kcal : 0));
  if (v < 60) return "很轻的一份加餐";
  const options: { unit: number; label: string }[] = [
    { unit: 130, label: "碗米饭" },
    { unit: 80, label: "个苹果" },
    { unit: 140, label: "瓶可乐" },
    { unit: 165, label: "份鸡胸" },
  ];
  let best = options[0];
  let bestErr = Number.POSITIVE_INFINITY;
  for (const o of options) {
    const n = v / o.unit;
    // 偏好 0.5–4 之间的整数或半数表达
    const rounded = n < 1 ? Math.round(n * 2) / 2 : Math.round(n);
    const err = Math.abs(n - rounded) + (rounded < 0.5 || rounded > 6 ? 1 : 0);
    if (err < bestErr) {
      bestErr = err;
      best = o;
    }
  }
  const n = v / best.unit;
  const shown = n < 1 ? Math.round(n * 2) / 2 : Math.round(n);
  return `约等于 ${shown} ${best.label}`;
}

/**
 * Mifflin-St Jeor 基础代谢（纯函数）。
 * 缺身高/年龄/性别时返回 null —— 调用方回落到默认目标，不阻塞使用。
 */
export function computeBmr(profile: BodyProfile, now: Date = new Date()): number | null {
  const { weightKg, heightCm, birthYear, sex } = profile;
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!heightCm || !Number.isFinite(heightCm) || heightCm <= 0) return null;
  if (!birthYear || !Number.isFinite(birthYear)) return null;
  if (sex !== "male" && sex !== "female") return null;
  const age = Math.max(14, Math.min(90, now.getFullYear() - birthYear));
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === "male" ? 5 : -161));
}

/**
 * 由身体数据算热量目标；数据不全时回落到默认目标。
 * 口径：BMR × 活动系数，钳位到 [1200, 4000]。
 */
export function computeCalorieTarget(
  profile: BodyProfile,
  fallbackKcal = DEFAULT_NUTRITION_TARGETS.kcal,
  now: Date = new Date()
): CalorieTargetResult {
  const factor = ACTIVITY_FACTORS[profile.activityLevel ?? "light"] ?? 1.375;
  const bmr = computeBmr(profile, now);
  if (bmr === null) {
    return {
      kcal: fallbackKcal,
      bmr: null,
      factor,
      computed: false,
      note: `填身高 / 出生年 / 性别后可自动算目标，当前用默认 ${fallbackKcal} kcal`,
    };
  }
  const raw = bmr * factor;
  const kcal = Math.round(Math.min(KCAL_TARGET_MAX, Math.max(KCAL_TARGET_MIN, raw)));
  return {
    kcal,
    bmr,
    factor,
    computed: true,
    note: `BMR ${bmr} × ${factor} ≈ ${Math.round(raw)} kcal`,
  };
}

/**
 * 由热量目标推三大营养素（蛋白 1.6g/kg、脂肪 0.9g/kg，碳水补足）。
 * 返回单值；UI 侧用 nutritionTargetRange() 展示成区间（D3）。
 */
export function macroTargetsFromKcal(
  kcal: number,
  weightKg: number
): { proteinG: number; carbsG: number; fatG: number } {
  const k = Number.isFinite(kcal) && kcal > 0 ? kcal : DEFAULT_NUTRITION_TARGETS.kcal;
  const w = Number.isFinite(weightKg) && weightKg > 0 ? weightKg : 60;
  const proteinG = Math.round(Math.min(2.4, Math.max(1.2, 1.6)) * w);
  const fatG = Math.round(0.9 * w);
  const carbsKcal = k - proteinG * 4 - fatG * 9;
  const carbsG = Math.max(50, Math.round(carbsKcal / 4));
  return { proteinG, carbsG, fatG };
}

export function buildNutritionTargetView(
  profile: BodyProfile,
  overrides?: { kcal?: number | null; proteinG?: number | null; carbsG?: number | null; fatG?: number | null } | null,
  now: Date = new Date()
): NutritionTargetView {
  const base = computeCalorieTarget(profile, DEFAULT_NUTRITION_TARGETS.kcal, now);
  const kcal = overrides?.kcal && overrides.kcal > 0 ? Math.round(overrides.kcal) : base.kcal;
  const macroBase = macroTargetsFromKcal(kcal, profile.weightKg);
  return {
    kcal,
    proteinG: overrides?.proteinG && overrides.proteinG > 0 ? Math.round(overrides.proteinG) : macroBase.proteinG,
    carbsG: overrides?.carbsG && overrides.carbsG > 0 ? Math.round(overrides.carbsG) : macroBase.carbsG,
    fatG: overrides?.fatG && overrides.fatG > 0 ? Math.round(overrides.fatG) : macroBase.fatG,
    computed: base.computed,
    bmr: base.bmr,
    factor: base.factor,
    note: base.note,
  };
}

export function sportGearTemplate(sportKey: string): string[] {
  return SPORT_GEAR_TEMPLATES[sportKey] ?? DEFAULT_SPORT_GEAR_LABELS;
}

/** 由装备行标签推测类别 */
export function gearKindFromLabel(label: string): SportGearKind {
  const text = String(label ?? "").toLowerCase();
  if (/球拍|底板|rackets?/.test(text)) return "racket";
  if (/鞋|shoe|战靴|钉鞋/.test(text)) return "shoes";
  if (/线|string|胶皮|磅/.test(text)) return "string";
  if (/手胶|grip|握把/.test(text)) return "grip";
  if (/球$|ball/.test(text)) return "ball";
  return "other";
}

/**
 * 档案里配图的装备行：**球拍 / 球鞋 / 拍线 / 比赛用球**（外加证件照）。
 * 布局：头像横屏 → 球拍横屏 → 一行两列（球鞋｜拍线）。
 * 其余装备行（手胶、球衣、护具、位置…）只填文字 —— 磅数这类纯数值更不该配图。
 */
export function gearRowWantsImage(label: string): boolean {
  const text = String(label ?? "");
  // 磅数是纯数值（图鉴四宫格里的输入框），**永远不配图** —— 它只是"看起来像拍线"的关键词
  if (/磅/.test(text)) return false;
  const kind = gearKindFromLabel(text);
  return kind === "racket" || kind === "shoes" || kind === "string" || kind === "ball";
}

export function normalizeGearLabel(label: string): string {
  const text = String(label ?? "").trim();
  return LEGACY_GEAR_LABEL_ALIASES[text] ?? text;
}

/**
 * 老库存的装备行归一到现模板：同标签多行合并（球拍型号 + 球拍类型），
 * 「磅数」行抽出成 tensionLbs 并弃用该行。
 */
export function normalizeSportGear(gear: SportGearRow[]): NormalizedSportGear {
  const out: SportGearRow[] = [];
  const indexOf = new Map<string, number>();
  let tensionLbs: number | null = null;
  for (const raw of gear ?? []) {
    const label = normalizeGearLabel(raw?.label ?? "");
    const value = String(raw?.value ?? "").trim();
    if (!label && !value) continue;
    if (label === "磅数" || label === "拉线磅数") {
      const n = Number(value.replace(/[^0-9.]/g, ""));
      if (tensionLbs === null && Number.isFinite(n) && n > 0) tensionLbs = n;
      continue;
    }
    const imageUrl = raw?.imageUrl ?? null;
    const hit = indexOf.get(label);
    if (hit === undefined) {
      indexOf.set(label, out.length);
      out.push({ label, value, imageUrl });
      continue;
    }
    const prev = out[hit];
    const parts = prev.value && prev.value !== value ? [prev.value, value] : [prev.value || value];
    out[hit] = { label, value: parts.filter(Boolean).join(" · "), imageUrl: prev.imageUrl || imageUrl };
  }
  return { gear: out, tensionLbs };
}

/** 归一 + 按当前模板排序补全（新模板新增的行即使空白也补上，方便填写）；自定义行保留在后面 */
export function mergeGearWithTemplate(sportKey: string, gear: SportGearRow[]): NormalizedSportGear {
  const { gear: normalized, tensionLbs } = normalizeSportGear(gear);
  const template = sportGearTemplate(sportKey);
  const byLabel = new Map(normalized.map((g) => [g.label, g]));
  const ordered: SportGearRow[] = template.map((label) => byLabel.get(label) ?? { label, value: "", imageUrl: null });
  const extras = normalized.filter((g) => !template.includes(g.label));
  return { gear: [...ordered, ...extras], tensionLbs };
}

export function computeSportsRecord(input: {
  matchesPlayed?: number | null;
  wins?: number | null;
  losses?: number | null;
}): SportsRecord {
  const wins = Math.max(0, Math.trunc(Number(input.wins) || 0));
  const losses = Math.max(0, Math.trunc(Number(input.losses) || 0));
  const declared = Math.max(0, Math.trunc(Number(input.matchesPlayed) || 0));
  const matches = Math.max(declared, wins + losses);
  const winRate = matches > 0 ? Math.round((wins / matches) * 1000) / 10 : null;
  return { matches, wins, losses, winRate };
}

export function formatWinRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toFixed(1)}%`;
}

/** 档案编号：BN + 6 位（由档案 id 派生，稳定不变） */
export function formatMemberNo(profileId: number | null | undefined): string {
  const id = Number(profileId);
  if (!Number.isFinite(id) || id <= 0) return "BN000000";
  return "BN" + String(Math.trunc(id)).padStart(6, "0");
}

/**
 * 由档案数据生成卡面文案模型 —— 卡片只负责「画」，映射全在这里，
 * 保证 Web（three.js 实时合成）与移动端（拟态闪光卡）显示同一份内容。
 */
export function buildSportsCardModel(
  profile: Pick<SportsProfile, "sportKey" | "identity" | "levelText" | "playStyle" | "handedness" | "gear" | "highlights"> &
    Partial<Pick<SportsProfile, "matchesPlayed" | "wins" | "losses" | "signatureMove">>,
  opts: { sportName: string; index?: number; total?: number; year?: number; memberNo?: string }
): SportsCardModel {
  const record = computeSportsRecord(profile);
  // 卡面同样归一：老档案的「球拍型号 / 球拍类型」在卡上只占一行
  const gear = normalizeSportGear((profile.gear ?? []).filter((g) => g.label.trim())).gear;
  const rowsLeft: [string, string][] = [
    ["等级", profile.levelText?.trim() || "未填写"],
    ...gear.slice(0, 3).map((g) => [g.label, g.value || "—"] as [string, string]),
  ];
  const rowsRight: [string, string][] = [
    ["总战绩", `${record.matches} 场`],
    ["胜 / 负", `${record.wins} 胜 / ${record.losses} 负`],
    ["胜率", formatWinRate(record.winRate)],
  ];
  const honorEntries = (profile.highlights ?? [])
    .filter((h) => h.label.trim() || h.value.trim())
    .map((h) => ({ title: h.label.trim() || h.value.trim(), detail: h.label.trim() ? h.value.trim() : "" }))
    .filter((h) => h.title);
  const flags = honorEntries
    .map((h) => (h.detail ? `${h.title} ${h.detail}` : h.title))
    .slice(0, 4);
  const mainHonor = honorEntries[0] ?? null;
  const honors = honorEntries.slice(1, 3);
  const pad = (n: number) => String(Math.max(1, n)).padStart(3, "0");
  const technique = profile.signatureMove?.trim() || profile.playStyle?.trim() || "未设定绝技";
  return {
    sportKey: profile.sportKey,
    title: `${opts.sportName}档案`,
    subtitle: SPORT_ARCHIVE_EN[profile.sportKey] ?? `${profile.sportKey.toUpperCase()} ARCHIVE`,
    technique,
    tagline:
      record.matches > 0
        ? `${record.matches} 战 · ${record.wins} 胜 · 胜率 ${formatWinRate(record.winRate)}`
        : "还没有战绩数据",
    edition: `NO.${pad(opts.index ?? 1)} / ${pad(opts.total ?? 1)}`,
    collection: `${opts.year ?? new Date().getFullYear()} 个人运动典藏`,
    description: `${opts.sportName}多层镭射闪光档案卡，记录等级、装备与完整战绩。`,
    panelTitle: SPORTS_CARD_PANEL_TITLE,
    rowsLeft,
    rowsRight,
    flags,
    mainHonor,
    honors,
    memberNo: opts.memberNo ?? formatMemberNo(0),
    gear: gear.map((g) => ({ label: g.label, value: g.value })),
    record,
    fileStem: `${opts.sportName}档案-${profile.sportKey}`,
  };
}

/** 从完整档案投影出公开视图（唯一的脱敏出口，避免各处手写白名单） */
export function toSportsShare(
  profile: Pick<SportsProfile, "sportKey" | "identity" | "levelText" | "handedness" | "playStyle" | "photoUrl" | "gear" | "highlights"> &
    Partial<Pick<SportsProfile, "matchesPlayed" | "wins" | "losses" | "signatureMove" | "showGearImages">>,
  sportName: string,
  displayName: string | null
): SportsShare {
  const record = computeSportsRecord(profile);
  return {
    sportKey: profile.sportKey,
    sportName,
    identity: profile.identity,
    levelText: profile.levelText,
    handedness: profile.handedness,
    playStyle: profile.playStyle,
    photoUrl: profile.photoUrl,
    gear: profile.gear ?? [],
    highlights: profile.highlights ?? [],
    matchesPlayed: record.matches,
    wins: record.wins,
    losses: record.losses,
    signatureMove: profile.signatureMove ?? null,
    showGearImages: Boolean(profile.showGearImages),
    displayName,
  };
}

export function equipmentCategoriesForSport(sportKey: string): EquipmentCategoryMeta[] {
  return EQUIPMENT_CATEGORIES.filter((c) => c.sportKey === sportKey);
}

/** 由装备行标签猜图库分类（拿不到就返回第一个候选） */
export function equipmentCategoryForGearLabel(sportKey: string, label: string): string {
  const candidates = equipmentCategoriesForSport(sportKey);
  const text = label.toLowerCase();
  const hit = candidates.find((c) => {
    if (/球拍|底板|rackets?/.test(text)) return c.key.endsWith("racket");
    if (/胶皮|rubber/.test(text)) return c.key.endsWith("rubber");
    if (/鞋|shoe|战靴|钉鞋/.test(text)) return c.key.endsWith("shoes");
    if (/线|string|磅/.test(text)) return c.key.endsWith("string");
    if (/手胶|grip|配件|accessor/.test(text)) return c.key.endsWith("accessory");
    if (/护膝|knee/.test(text)) return c.key.endsWith("knee");
    if (/护腿|guard/.test(text)) return c.key.endsWith("guard");
    if (/手套|glove/.test(text)) return c.key.endsWith("glove");
    if (/球棒|bat/.test(text)) return c.key.endsWith("bat");
    // 羽毛球的「球」类后缀是 shuttle（badminton-shuttle），不是 ball
    if (/球$|ball/.test(text)) return c.key.endsWith("ball") || c.key.endsWith("shuttle");
    return false;
  });
  return hit?.key ?? candidates[0]?.key ?? "";
}

/**
 * 按实际摄入量换算营养（v6 P1-3）：`amount` 与 `basisUnit` 同单位（默认克）。
 * 客户端只用它做实时预览；**服务端会独立重算一次**（不信客户端）。
 */
export function scaleFoodByAmount(
  item: Pick<FoodItemHit, "kcal" | "proteinG" | "carbsG" | "fatG" | "basisAmount">,
  amount: number
): { kcal: number; proteinG: number; carbsG: number; fatG: number } {
  // ⚠️ Postgres 的 numeric 经 node-pg 返回的是**字符串**（"96"），必须先 Number() 再判有限性，
  //    否则 Number.isFinite("96") === false → 预览恒为 0（v6 真机前实测到）。
  const basisRaw = Number(item.basisAmount);
  const basis = Number.isFinite(basisRaw) && basisRaw > 0 ? basisRaw : 100;
  const amountRaw = Number(amount);
  const a = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 0;
  const r = (n: unknown) => {
    const v = Number(n);
    return Math.round(((Number.isFinite(v) ? v : 0) * a) / basis * 10) / 10;
  };
  return { kcal: r(item.kcal), proteinG: r(item.proteinG), carbsG: r(item.carbsG), fatG: r(item.fatG) };
}

/** 基准量文案：每 100g / 每 500g / 每 1份 */
export function formatBasisLabel(item: { basisAmount: number | string; basisUnit: string }): string {
  return `每 ${item.basisAmount}${item.basisUnit}`;
}

function readinessRatio(done: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.max(0, Math.min(1, done / total));
}

/**
 * 今日状态分（口径与 APP 一致，见 docs/APP端优化方案-v2 §1.5.3D）：
 *   任务完成率×40 + 习惯完成率×30 + 今日有训练×15 + 饮食达标率×15；
 * 全部为 0 数据时给「待开始」而不是 0 分羞辱式文案；分数 ≥80 不再提示短板。
 */
export function computeDailyReadiness(input: DailyReadinessInput): DailyReadiness {
  const tasks = readinessRatio(input.tasksDone, input.tasksTotal);
  const habits = readinessRatio(input.habitsDone, input.habitsScheduled);
  const workout = input.workoutMinutes > 0 ? 1 : 0;
  const nutrition =
    input.nutritionTargetKcal > 0 ? Math.min(1, readinessRatio(input.nutritionKcal, input.nutritionTargetKcal)) : 0;

  const score = Math.round(
    tasks * DAILY_READINESS_WEIGHTS.tasks +
      habits * DAILY_READINESS_WEIGHTS.habits +
      workout * DAILY_READINESS_WEIGHTS.workout +
      nutrition * DAILY_READINESS_WEIGHTS.nutrition
  );

  const hasAnyPlan =
    input.tasksTotal > 0 || input.habitsScheduled > 0 || input.workoutMinutes > 0 || input.nutritionKcal > 0;

  let verdict: string;
  if (!hasAnyPlan) verdict = "今天还没有记录，先记一笔就算开始";
  else if (score >= 80) verdict = "状态很好，适合练力量";
  else if (score >= 60) verdict = "状态不错，按计划推进";
  else if (score >= 40) verdict = "状态一般，做点轻量训练";
  else verdict = "先补最薄弱的一项，别硬扛";

  const plannedDims = [
    input.tasksTotal > 0,
    input.habitsScheduled > 0,
    input.nutritionTargetKcal > 0,
  ].filter(Boolean).length;
  const gaps: { key: NonNullable<DailyReadiness["weakest"]>; gap: number }[] = [
    { key: "tasks", gap: input.tasksTotal > 0 ? 1 - tasks : -1 },
    { key: "habits", gap: input.habitsScheduled > 0 ? 1 - habits : -1 },
    { key: "workout", gap: input.workoutMinutes > 0 || plannedDims === 0 ? -1 : 1 },
    { key: "nutrition", gap: input.nutritionTargetKcal > 0 ? 1 - nutrition : -1 },
  ];
  const sorted = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap);
  const weakest = sorted.length > 0 && score < 80 ? sorted[0].key : null;

  return { score, verdict, weakest, parts: { tasks, habits, workout, nutrition } };
}

/** 是否命中弱口令黑名单（大小写不敏感，忽略首尾空白） */
export function isCommonWeakPassword(value: string): boolean {
  return COMMON_WEAK_PASSWORDS.includes(value.trim().toLowerCase());
}
