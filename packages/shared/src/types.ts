/**
 * 纯 TypeScript 类型（不依赖 zod，运行时零成本）。
 *
 * 由原 src/index.ts 拆出（S3-2 subpath exports）；index.ts 仍以 barrel 形式保留兼容。
 */
import type { ExerciseType, JobFreshnessLevel, ResumeStyle } from "./schemas";
import type { ActivityLevel } from "./labels";

/** 模板注册表（代码侧唯一事实源：避免 DB 种子与渲染器配置漂移） */
export interface ResumeTemplate {
  key: string;
  name: string;
  description: string;
  /** 默认样式，作为文档样式的兜底 */
  defaults: Partial<ResumeStyle>;
  /** 版式特征：单栏经典 / 双栏侧边 / 时间线 */
  layout: "single" | "sidebar" | "timeline";
  /** 小节标题风格：下划线 / 左侧色条 / 纯文字 */
  heading: "underline" | "bar" | "plain";
}

/* ---------- 运动项目注册表（Web/移动端共用；数据库 sport_items 同源种子） ---------- */

export interface SportItem {
  key: string;
  name: string;
  type: ExerciseType;
  /** 运动强度系数（MET），卡路里估算预留 */
  met: number;
  defaultMinutes: number;
  /** 前台常用位：默认网格只展示 featured 项目，其余收进「更多」 */
  featured: boolean;
  sort: number;
}

/* ---------- 健身房动作字典（迁移 046 exercise_items；Web/移动端共用，与迁移种子同源） ----------

   为什么单开一份（而不是复用 SPORT_CATALOG）：SPORT_CATALOG 是"运动/活动"目录
   （篮球、跑步、深蹲…），力量类只有 6 项，撑不起训练记录里的"选择动作"面板。
   本常量同时是「库不可用 / 未迁移环境」的回退数据源与移动端离线数据源。

   ⚠️ 改动这里必须同步 `db/migrations/046_exercise_catalog.sql`（只追加新迁移，别改 046）；
      `apps/web/lib/exercise-catalog.test.ts` 会解析迁移文件逐条比对，漂移即失败。
*/

export type ExerciseMuscleGroup = "胸" | "背" | "腿" | "肩" | "手臂" | "核心" | "臀" | "全身";

export type ExerciseEquipment = "杠铃" | "哑铃" | "器械" | "自重" | "绳索" | "壶铃";

export interface ExerciseCatalogItem {
  key: string;
  name: string;
  muscleGroup: ExerciseMuscleGroup;
  category: ExerciseType;
  equipment: ExerciseEquipment | null;
  /** 强度系数（MET），卡路里估算预留 */
  met: number | null;
  sort: number;
}

/** 可参与检索的最小结构（`/api/exercises` 的返回项即满足此形状，无需带 met/sort） */
export type ExerciseFilterable = Pick<
  ExerciseCatalogItem,
  "key" | "name" | "muscleGroup" | "category" | "equipment"
>;

export interface JobFreshness {
  level: JobFreshnessLevel;
  label: string;
  emoji: string;
  /** 用于徽标背景的 tailwind 类 */
  badgeClass: string;
}

export interface HabitLogLike {
  habitId: number;
  logDate: string;
  value: number;
}

/** 习惯模板（新建时的快速选择） */
export interface HabitTemplate {
  name: string;
  icon: string;
  isBoolean: boolean;
  targetValue: number | null;
  unit: string | null;
  color: string;
}

/* ================= 训练负荷口径（v1.44.2） ================= */

/**
 * 训练负荷的统计口径。
 *
 * ## 为什么要多档口径
 * 原来只有一种：「重量容量 = 组 × 次 × kg」。但**自重动作**（俯卧撑、引体、平板支撑、
 * 跑步机等）的 `weightKg` 按约定是 `null`（见 /api/workouts 的 normalizeItems 注释），
 * 于是容量恒为 0 —— 用户明明记录了训练，「近 7 天训练负荷」却全 0、柱状图只剩几个
 * 3px 的灰色小条，看起来就是"没有数据"（2026-10-12 真机反馈）。
 *
 * 现在按优先级自动退档，保证**只要记录了训练就有可见的柱**：
 *   volume(kg) → reps(次) → sets(组) → sessions(次训练)
 *
 * 取「整周里有没有出现过非 0 值」来决定口径，而不是逐日切换 —— 一周内口径必须统一，
 * 否则同一条柱状图里混着 kg 和 次，没有任何可读性。
 */
export type TrainingLoadMetric = "volume" | "reps" | "sets" | "sessions";

export interface TrainingLoadDay {
  /** YYYY-MM-DD（本地日） */
  key: string;
  /** 当天星期几，0=周日 */
  weekday: number;
  sessions: number;
  sets: number;
  reps: number;
  volumeKg: number;
  durationSeconds: number;
  /** 按选定口径算出的当天数值 */
  value: number;
  /** 柱高百分比 0–100 */
  height: number;
}

export interface TrainingLoadSeries {
  metric: TrainingLoadMetric;
  /** 选定口径下的最大值（至少为 1，避免除零） */
  max: number;
  days: TrainingLoadDay[];
  /** 区间合计，便于直接显示"本周 X" */
  total: { sessions: number; sets: number; reps: number; volumeKg: number; durationSeconds: number };
}

export interface NutritionTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** 区间目标（D3：三大营养素用区间而非单值，降低焦虑） */
export interface NutritionRange {
  min: number;
  max: number;
}

/** 用量相对区间的状态：不足 / 达标 / 超出 */
export type MacroStatus = "under" | "in" | "over";

export type Sex = "male" | "female";

export interface BodyProfile {
  /** 当前体重（来自 user_settings.weight_kg） */
  weightKg: number;
  heightCm?: number | null;
  birthYear?: number | null;
  sex?: Sex | null;
  activityLevel?: ActivityLevel | null;
}

export interface CalorieTargetResult {
  /** 目标热量（单值；D3 里只有三大营养素用区间） */
  kcal: number;
  bmr: number | null;
  factor: number;
  /** 是否由身体数据算出（false = 用了默认值） */
  computed: boolean;
  /** 一句话解释（可展开显示"怎么算出来的"） */
  note: string;
}

/** 目标预览（UI 显示"怎么算出来的"和最终四项） */
export interface NutritionTargetView {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  computed: boolean;
  bmr: number | null;
  factor: number;
  note: string;
}

/** 装备行类别（决定「是否配图位」与图库分类） */
export type SportGearKind = "racket" | "shoes" | "string" | "grip" | "ball" | "other";

/** 装备行（网页 / App 共用） */
export interface SportGearRow {
  label: string;
  value: string;
  imageUrl?: string | null;
}

export interface NormalizedSportGear {
  gear: SportGearRow[];
  /** 老数据里「磅数」装备行的数值（现已移出装备行，落到图鉴四宫格） */
  tensionLbs: number | null;
}

export interface SportsRecord {
  /** 总场次（取「填写的场次」与「胜+负」的较大者，避免只填胜负时卡面显示 0 场） */
  matches: number;
  wins: number;
  losses: number;
  /** 胜率百分比（0-100，一位小数）；无场次为 null */
  winRate: number | null;
}

export interface SportsCardModel {
  sportKey: string;
  /** 卡面标题（如「羽毛球档案」） */
  title: string;
  /** 卡面英文小标（如 BADMINTON ARCHIVE） */
  subtitle: string;
  /** 绝技（底部大字） */
  technique: string;
  /** 战绩一句话（绝技上方小字） */
  tagline: string;
  edition: string;
  collection: string;
  description: string;
  panelTitle: string;
  /** 信息面板左列 [标签, 值]（等级 + 装备） */
  rowsLeft: [string, string][];
  /** 信息面板右列 [标签, 值]（战绩） */
  rowsRight: [string, string][];
  /** 面板底部徽章（公开成绩） */
  flags: string[];
  /** 主荣誉（放大展示的那一条）：highlights[0] */
  mainHonor: { title: string; detail: string } | null;
  /** 其余荣誉（最多 2 条） */
  honors: { title: string; detail: string }[];
  /** 档案编号（BN + 6 位） */
  memberNo: string;
  /** 装备清单（卡背用，顺序与档案一致） */
  gear: { label: string; value: string }[];
  record: SportsRecord;
  /** 导出文件名用的安全串 */
  fileStem: string;
}

/* ==================== v11 P1.5：装备图库（品牌官方白底商品图） ==================== */

export interface EquipmentCategoryMeta {
  key: string;
  /** 中文类别名（选择器 chips） */
  label: string;
  /** 对应档案装备行的默认标签 */
  gearLabel: string;
  /** 供给的运动项目 */
  sportKey: string;
}

/* ============================ v6：食物营养基准库（P1-3） ============================ */


/**
 * 营养基准库条目：`kcal/proteinG/carbsG/fatG` 都是**每 `basisAmount basisUnit`** 的量
 * （中餐常见「每 100g」或「每 500g」）。来自 `food_items` 表（迁移 047）。
 */
export interface FoodItemHit {
  id: number;
  name: string;
  category: string | null;
  mealTags: string[];
  basisAmount: number;
  basisUnit: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source?: string;
  license?: string;
  score?: number;
  times?: number;
}

/* ==================== v8：今日状态分（Web/APP 共用同一口径） ==================== */

export interface DailyReadinessInput {
  tasksTotal: number;
  tasksDone: number;
  habitsScheduled: number;
  habitsDone: number;
  workoutMinutes: number;
  nutritionKcal: number;
  nutritionTargetKcal: number;
}

export interface DailyReadiness {
  /** 0..100 整数 */
  score: number;
  /** 一句话结论（鼓励而非警示） */
  verdict: string;
  /** 最该补的一项（无短板时为 null） */
  weakest: "tasks" | "habits" | "workout" | "nutrition" | null;
  /** 四项分解比例（0..1），供 hero 画分解条 */
  parts: { tasks: number; habits: number; workout: number; nutrition: number };
}
