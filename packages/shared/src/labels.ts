/**
 * 文案 / 标签 / 常量表 / 静态目录数据。
 *
 * 由原 src/index.ts 拆出（S3-2 subpath exports）；index.ts 仍以 barrel 形式保留兼容。
 */
import type { BreakKind, DomainKind, ExerciseType, Hand, InterviewMode, JobApplicationStage, JobCategory, JobSource, KnowledgeNoteType, MealKind, ReminderType, ResumeAssetKind, ResumeSectionConfig, ResumeSectionKey } from "./schemas";
import type { DailyReadiness, EquipmentCategoryMeta, ExerciseCatalogItem, ExerciseMuscleGroup, HabitTemplate, NutritionTotals, ResumeTemplate, SportItem, TrainingLoadMetric } from "./types";

/** 证书状态中文标签（V3 独立证书领域） */
export const certificateStatusLabels: Record<"planned" | "preparing" | "achieved", string> = {
  planned: "计划中",
  preparing: "备考中",
  achieved: "已取得",
};

export const resumeAssetKindLabels: Record<ResumeAssetKind, string> = {
  project: "项目",
  skill: "技能",
  github: "GitHub",
  certificate: "证书",
};

export const resumeSectionKeyLabels: Record<ResumeSectionKey, string> = {
  basics: "基本信息",
  education: "教育经历",
  skills: "技能",
  projects: "项目",
  experience: "工作经历",
  certificates: "证书",
};

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    key: "classic",
    name: "经典单栏",
    description: "专业克制，适合国企/事业单位与通用投递",
    defaults: { accent: "#2f74c0", spacing: "normal", fontFamily: "sans" },
    layout: "single",
    heading: "underline",
  },
  {
    key: "serif",
    name: "衬线简洁",
    description: "衬线字体 + 纯文字小标题，适合传统行业与研究岗",
    defaults: { accent: "#334155", spacing: "relaxed", fontFamily: "serif" },
    layout: "single",
    heading: "plain",
  },
  {
    key: "sidebar",
    name: "双栏侧边",
    description: "左侧信息栏（技能/证书）+ 右侧主经历，信息密度高",
    defaults: { accent: "#0f766e", spacing: "compact", fontFamily: "sans" },
    layout: "sidebar",
    heading: "bar",
  },
  {
    key: "timeline",
    name: "时间线",
    description: "教育与工作按时间轴排布，成长路径清晰",
    defaults: { accent: "#7c3aed", spacing: "normal", fontFamily: "sans" },
    layout: "timeline",
    heading: "bar",
  },
];

export const resumeTemplateKeys = RESUME_TEMPLATES.map((t) => t.key);

/** 默认分节顺序（新建文档时使用） */
export const DEFAULT_RESUME_SECTION_ORDER: ResumeSectionConfig[] = [
  { key: "basics", visible: true },
  { key: "education", visible: true },
  { key: "skills", visible: true },
  { key: "experience", visible: true },
  { key: "projects", visible: true },
  { key: "certificates", visible: true },
];

export const taskTypeLabels: Record<string, string> = {
  study: "学习",
  agent: "Agent",
  output: "输出",
  review: "复盘",
  exam: "刷题",
};

export const logKindLabels: Record<string, string> = {
  feynman: "费曼讲稿",
  review: "周复盘",
  project: "项目笔记",
  interview: "面试记录",
};

export const certLabels: Record<string, string> = {
  "HCIP-Datacom": "HCIP-Datacom",
  "天翼云 ACP": "天翼云 ACP",
};

export const knowledgeNoteTypeLabels: Record<KnowledgeNoteType, string> = {
  NOTE: "笔记",
  TUTORIAL: "教程",
  REFERENCE: "参考",
  MINDMAP: "思维导图",
  REVIEW: "复盘",
  PROJECT_NOTE: "项目笔记",
};

export const exerciseTypeLabels: Record<ExerciseType, string> = {
  BALL: "球类运动",
  AEROBIC: "有氧运动",
  STRENGTH: "力量训练",
  STRETCH: "拉伸放松",
  MOVE: "日常活动",
  OTHER: "其他运动",
};

export const exerciseTypeOptions: { type: ExerciseType; label: string }[] = [
  { type: "BALL", label: "球类运动" },
  { type: "AEROBIC", label: "有氧运动" },
  { type: "STRENGTH", label: "力量训练" },
  { type: "STRETCH", label: "拉伸放松" },
  { type: "MOVE", label: "日常活动" },
  { type: "OTHER", label: "其他运动" },
];

export const SPORT_CATALOG: SportItem[] = [
  // 球类 BALL
  { key: "basketball", name: "篮球", type: "BALL", met: 6.5, defaultMinutes: 30, featured: true, sort: 1 },
  { key: "badminton", name: "羽毛球", type: "BALL", met: 5.5, defaultMinutes: 30, featured: true, sort: 2 },
  { key: "volleyball", name: "排球", type: "BALL", met: 5.0, defaultMinutes: 30, featured: true, sort: 3 },
  { key: "table-tennis", name: "乒乓球", type: "BALL", met: 4.0, defaultMinutes: 30, featured: true, sort: 4 },
  { key: "soccer", name: "足球", type: "BALL", met: 7.0, defaultMinutes: 45, featured: false, sort: 5 },
  { key: "tennis", name: "网球", type: "BALL", met: 5.0, defaultMinutes: 45, featured: false, sort: 6 },
  { key: "baseball", name: "棒球", type: "BALL", met: 5.0, defaultMinutes: 45, featured: false, sort: 7 },
  // 有氧 AEROBIC
  { key: "run", name: "跑步", type: "AEROBIC", met: 8.0, defaultMinutes: 30, featured: true, sort: 10 },
  { key: "walk", name: "散步", type: "AEROBIC", met: 3.5, defaultMinutes: 30, featured: true, sort: 11 },
  { key: "brisk-walk", name: "快走", type: "AEROBIC", met: 5.0, defaultMinutes: 30, featured: false, sort: 12 },
  { key: "cycling", name: "骑行", type: "AEROBIC", met: 6.8, defaultMinutes: 40, featured: true, sort: 13 },
  { key: "rope-jumping", name: "跳绳", type: "AEROBIC", met: 10.0, defaultMinutes: 15, featured: true, sort: 14 },
  { key: "swimming", name: "游泳", type: "AEROBIC", met: 7.0, defaultMinutes: 40, featured: false, sort: 15 },
  { key: "dancing", name: "跳舞", type: "AEROBIC", met: 5.0, defaultMinutes: 30, featured: false, sort: 16 },
  { key: "hiking", name: "爬山", type: "AEROBIC", met: 6.0, defaultMinutes: 120, featured: false, sort: 17 },
  { key: "frisbee", name: "飞盘", type: "AEROBIC", met: 5.5, defaultMinutes: 40, featured: false, sort: 18 },
  { key: "treadmill", name: "跑步机", type: "AEROBIC", met: 5.0, defaultMinutes: 30, featured: false, sort: 19 },
  { key: "boxing", name: "拳击", type: "AEROBIC", met: 6.0, defaultMinutes: 30, featured: false, sort: 20 },
  // 力量 STRENGTH
  { key: "sit-ups", name: "仰卧起坐", type: "STRENGTH", met: 3.8, defaultMinutes: 15, featured: true, sort: 30 },
  { key: "squats", name: "深蹲", type: "STRENGTH", met: 5.0, defaultMinutes: 15, featured: true, sort: 31 },
  { key: "push-ups", name: "俯卧撑", type: "STRENGTH", met: 4.0, defaultMinutes: 10, featured: false, sort: 32 },
  { key: "plank", name: "平板支撑", type: "STRENGTH", met: 3.3, defaultMinutes: 10, featured: false, sort: 33 },
  { key: "dumbbells", name: "哑铃", type: "STRENGTH", met: 3.5, defaultMinutes: 20, featured: true, sort: 34 },
  { key: "pull-ups", name: "引体向上", type: "STRENGTH", met: 8.0, defaultMinutes: 10, featured: false, sort: 35 },
  { key: "crunches", name: "卷腹", type: "STRENGTH", met: 3.8, defaultMinutes: 10, featured: false, sort: 36 },
  // 拉伸 STRETCH
  { key: "stretching", name: "拉伸放松", type: "STRETCH", met: 2.3, defaultMinutes: 10, featured: true, sort: 40 },
  { key: "yoga", name: "瑜伽", type: "STRETCH", met: 2.5, defaultMinutes: 30, featured: false, sort: 41 },
  { key: "baduanjin", name: "八段锦", type: "STRETCH", met: 3.0, defaultMinutes: 20, featured: false, sort: 42 },
  { key: "tai-chi", name: "太极", type: "STRETCH", met: 3.0, defaultMinutes: 30, featured: false, sort: 43 },
  // 日常 MOVE
  { key: "stairs", name: "爬楼梯", type: "MOVE", met: 8.0, defaultMinutes: 10, featured: false, sort: 50 },
  { key: "housework", name: "家务活动", type: "MOVE", met: 3.3, defaultMinutes: 20, featured: false, sort: 51 },
];

/** 面板里"按部位浏览"的顺序（与迁移 CHECK 约束一致） */
export const exerciseMuscleGroups: ExerciseMuscleGroup[] = ["胸", "背", "腿", "肩", "手臂", "核心", "臀", "全身"];

export const EXERCISE_CATALOG: ExerciseCatalogItem[] = [
  // 胸
  { key: "bench-press", name: "卧推", muscleGroup: "胸", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 11 },
  { key: "incline-bench-press", name: "上斜卧推", muscleGroup: "胸", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 12 },
  { key: "dumbbell-bench-press", name: "哑铃卧推", muscleGroup: "胸", category: "STRENGTH", equipment: "哑铃", met: 5.5, sort: 13 },
  { key: "dumbbell-fly", name: "哑铃飞鸟", muscleGroup: "胸", category: "STRENGTH", equipment: "哑铃", met: 4.0, sort: 14 },
  { key: "cable-crossover", name: "绳索夹胸", muscleGroup: "胸", category: "STRENGTH", equipment: "绳索", met: 4.0, sort: 15 },
  { key: "machine-chest-press", name: "器械推胸", muscleGroup: "胸", category: "STRENGTH", equipment: "器械", met: 5.0, sort: 16 },
  { key: "push-up", name: "俯卧撑", muscleGroup: "胸", category: "STRENGTH", equipment: "自重", met: 4.0, sort: 17 },
  { key: "dips", name: "双杠臂屈伸", muscleGroup: "胸", category: "STRENGTH", equipment: "自重", met: 5.0, sort: 18 },
  // 背
  { key: "deadlift", name: "硬拉", muscleGroup: "背", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 21 },
  { key: "romanian-deadlift", name: "罗马尼亚硬拉", muscleGroup: "背", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 22 },
  { key: "pull-up", name: "引体向上", muscleGroup: "背", category: "STRENGTH", equipment: "自重", met: 8.0, sort: 23 },
  { key: "lat-pulldown", name: "高位下拉", muscleGroup: "背", category: "STRENGTH", equipment: "器械", met: 5.0, sort: 24 },
  { key: "barbell-row", name: "杠铃划船", muscleGroup: "背", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 25 },
  { key: "seated-cable-row", name: "坐姿划船", muscleGroup: "背", category: "STRENGTH", equipment: "绳索", met: 5.0, sort: 26 },
  { key: "one-arm-dumbbell-row", name: "单臂哑铃划船", muscleGroup: "背", category: "STRENGTH", equipment: "哑铃", met: 5.0, sort: 27 },
  { key: "face-pull", name: "面拉", muscleGroup: "背", category: "STRENGTH", equipment: "绳索", met: 4.0, sort: 28 },
  { key: "reverse-fly", name: "反向飞鸟", muscleGroup: "背", category: "STRENGTH", equipment: "哑铃", met: 4.0, sort: 29 },
  { key: "t-bar-row", name: "T 杠划船", muscleGroup: "背", category: "STRENGTH", equipment: "杠铃", met: 5.5, sort: 30 },
  // 腿
  { key: "squat", name: "深蹲", muscleGroup: "腿", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 31 },
  { key: "front-squat", name: "前蹲", muscleGroup: "腿", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 32 },
  { key: "hack-squat", name: "哈克深蹲", muscleGroup: "腿", category: "STRENGTH", equipment: "器械", met: 5.5, sort: 33 },
  { key: "goblet-squat", name: "高脚杯深蹲", muscleGroup: "腿", category: "STRENGTH", equipment: "哑铃", met: 5.0, sort: 34 },
  { key: "bulgarian-split-squat", name: "保加利亚分腿蹲", muscleGroup: "腿", category: "STRENGTH", equipment: "哑铃", met: 5.0, sort: 35 },
  { key: "lunge", name: "箭步蹲", muscleGroup: "腿", category: "STRENGTH", equipment: "哑铃", met: 5.0, sort: 36 },
  { key: "leg-press", name: "腿举", muscleGroup: "腿", category: "STRENGTH", equipment: "器械", met: 5.0, sort: 37 },
  { key: "leg-extension", name: "腿屈伸", muscleGroup: "腿", category: "STRENGTH", equipment: "器械", met: 4.0, sort: 38 },
  { key: "leg-curl", name: "腿弯举", muscleGroup: "腿", category: "STRENGTH", equipment: "器械", met: 4.0, sort: 39 },
  { key: "standing-calf-raise", name: "站姿提踵", muscleGroup: "腿", category: "STRENGTH", equipment: "器械", met: 3.5, sort: 40 },
  // 肩
  { key: "overhead-press", name: "推举", muscleGroup: "肩", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 41 },
  { key: "dumbbell-shoulder-press", name: "哑铃推举", muscleGroup: "肩", category: "STRENGTH", equipment: "哑铃", met: 5.0, sort: 42 },
  { key: "arnold-press", name: "阿诺德推举", muscleGroup: "肩", category: "STRENGTH", equipment: "哑铃", met: 5.0, sort: 43 },
  { key: "lateral-raise", name: "哑铃侧平举", muscleGroup: "肩", category: "STRENGTH", equipment: "哑铃", met: 3.5, sort: 44 },
  { key: "front-raise", name: "前平举", muscleGroup: "肩", category: "STRENGTH", equipment: "哑铃", met: 3.5, sort: 45 },
  { key: "reverse-pec-deck", name: "反向蝴蝶机", muscleGroup: "肩", category: "STRENGTH", equipment: "器械", met: 4.0, sort: 46 },
  { key: "upright-row", name: "直立划船", muscleGroup: "肩", category: "STRENGTH", equipment: "杠铃", met: 5.0, sort: 47 },
  { key: "shrug", name: "耸肩", muscleGroup: "肩", category: "STRENGTH", equipment: "哑铃", met: 3.5, sort: 48 },
  // 手臂
  { key: "barbell-curl", name: "杠铃弯举", muscleGroup: "手臂", category: "STRENGTH", equipment: "杠铃", met: 4.0, sort: 51 },
  { key: "dumbbell-curl", name: "哑铃弯举", muscleGroup: "手臂", category: "STRENGTH", equipment: "哑铃", met: 3.5, sort: 52 },
  { key: "hammer-curl", name: "锤式弯举", muscleGroup: "手臂", category: "STRENGTH", equipment: "哑铃", met: 3.5, sort: 53 },
  { key: "concentration-curl", name: "集中弯举", muscleGroup: "手臂", category: "STRENGTH", equipment: "哑铃", met: 3.5, sort: 54 },
  { key: "preacher-curl", name: "牧师凳弯举", muscleGroup: "手臂", category: "STRENGTH", equipment: "器械", met: 4.0, sort: 55 },
  { key: "triceps-pushdown", name: "绳索下压", muscleGroup: "手臂", category: "STRENGTH", equipment: "绳索", met: 3.5, sort: 56 },
  { key: "close-grip-bench-press", name: "窄距卧推", muscleGroup: "手臂", category: "STRENGTH", equipment: "杠铃", met: 5.5, sort: 57 },
  { key: "lying-triceps-extension", name: "仰卧臂屈伸", muscleGroup: "手臂", category: "STRENGTH", equipment: "杠铃", met: 4.0, sort: 58 },
  { key: "overhead-triceps-ext", name: "过顶臂屈伸", muscleGroup: "手臂", category: "STRENGTH", equipment: "哑铃", met: 4.0, sort: 59 },
  { key: "wrist-curl", name: "腕弯举", muscleGroup: "手臂", category: "STRENGTH", equipment: "哑铃", met: 3.0, sort: 60 },
  // 核心
  { key: "plank", name: "平板支撑", muscleGroup: "核心", category: "STRENGTH", equipment: "自重", met: 3.3, sort: 61 },
  { key: "side-plank", name: "侧平板支撑", muscleGroup: "核心", category: "STRENGTH", equipment: "自重", met: 3.3, sort: 62 },
  { key: "crunch", name: "卷腹", muscleGroup: "核心", category: "STRENGTH", equipment: "自重", met: 3.8, sort: 63 },
  { key: "sit-up", name: "仰卧起坐", muscleGroup: "核心", category: "STRENGTH", equipment: "自重", met: 3.8, sort: 64 },
  { key: "hanging-leg-raise", name: "悬垂举腿", muscleGroup: "核心", category: "STRENGTH", equipment: "自重", met: 4.5, sort: 65 },
  { key: "russian-twist", name: "俄罗斯转体", muscleGroup: "核心", category: "STRENGTH", equipment: "自重", met: 4.0, sort: 66 },
  { key: "cable-crunch", name: "绳索卷腹", muscleGroup: "核心", category: "STRENGTH", equipment: "绳索", met: 4.5, sort: 67 },
  { key: "ab-wheel", name: "健腹轮", muscleGroup: "核心", category: "STRENGTH", equipment: "器械", met: 4.5, sort: 68 },
  // 臀
  { key: "glute-bridge", name: "臀桥", muscleGroup: "臀", category: "STRENGTH", equipment: "自重", met: 3.5, sort: 71 },
  { key: "hip-thrust", name: "臀冲", muscleGroup: "臀", category: "STRENGTH", equipment: "杠铃", met: 5.0, sort: 72 },
  { key: "hip-abduction", name: "髋外展", muscleGroup: "臀", category: "STRENGTH", equipment: "器械", met: 3.5, sort: 73 },
  { key: "cable-kickback", name: "绳索后踢", muscleGroup: "臀", category: "STRENGTH", equipment: "绳索", met: 4.0, sort: 74 },
  { key: "sumo-deadlift", name: "相扑硬拉", muscleGroup: "臀", category: "STRENGTH", equipment: "杠铃", met: 6.0, sort: 75 },
  // 全身（力量 / 有氧 / 拉伸）
  { key: "farmer-walk", name: "农夫行走", muscleGroup: "全身", category: "STRENGTH", equipment: "哑铃", met: 6.0, sort: 81 },
  { key: "kettlebell-swing", name: "壶铃摆荡", muscleGroup: "全身", category: "STRENGTH", equipment: "壶铃", met: 8.0, sort: 82 },
  { key: "burpee", name: "波比跳", muscleGroup: "全身", category: "STRENGTH", equipment: "自重", met: 8.0, sort: 83 },
  { key: "rowing-machine", name: "划船机", muscleGroup: "全身", category: "AEROBIC", equipment: "器械", met: 7.0, sort: 84 },
  { key: "battle-rope", name: "战绳", muscleGroup: "全身", category: "AEROBIC", equipment: "器械", met: 8.0, sort: 85 },
  { key: "jump-rope", name: "跳绳", muscleGroup: "全身", category: "AEROBIC", equipment: "自重", met: 10.0, sort: 86 },
  { key: "treadmill-run", name: "跑步机", muscleGroup: "全身", category: "AEROBIC", equipment: "器械", met: 8.0, sort: 87 },
  { key: "stair-climber", name: "爬楼机", muscleGroup: "腿", category: "AEROBIC", equipment: "器械", met: 9.0, sort: 88 },
  { key: "spin-bike", name: "动感单车", muscleGroup: "腿", category: "AEROBIC", equipment: "器械", met: 8.5, sort: 89 },
  { key: "foam-roll", name: "泡沫轴放松", muscleGroup: "全身", category: "STRETCH", equipment: "自重", met: 2.5, sort: 90 },
  { key: "stretch-cooldown", name: "训练后拉伸", muscleGroup: "全身", category: "STRETCH", equipment: "自重", met: 2.3, sort: 91 },
  { key: "yoga-flow", name: "瑜伽流", muscleGroup: "全身", category: "STRETCH", equipment: "自重", met: 2.8, sort: 92 },
];

/** 运动大类的推荐兜底项目（老记录/自定义时展示用） */
export const sportTypeFallbackItem: Record<ExerciseType, SportItem> = {
  BALL: { key: "ball-other", name: "球类运动", type: "BALL", met: 5.0, defaultMinutes: 30, featured: false, sort: 99 },
  AEROBIC: { key: "aerobic-other", name: "有氧运动", type: "AEROBIC", met: 5.0, defaultMinutes: 30, featured: false, sort: 99 },
  STRENGTH: { key: "strength-other", name: "力量训练", type: "STRENGTH", met: 4.0, defaultMinutes: 15, featured: false, sort: 99 },
  STRETCH: { key: "stretch-other", name: "拉伸放松", type: "STRETCH", met: 2.5, defaultMinutes: 10, featured: false, sort: 99 },
  MOVE: { key: "move-other", name: "日常活动", type: "MOVE", met: 3.5, defaultMinutes: 20, featured: false, sort: 99 },
  OTHER: { key: "other", name: "其他运动", type: "OTHER", met: 4.0, defaultMinutes: 30, featured: false, sort: 99 },
};

export const reminderTypeLabels: Record<ReminderType, string> = {
  HYDRATION: "喝水",
  STAND: "站立",
  BREAK: "休息",
  MOVEMENT: "活动",
  SLEEP: "睡眠",
  CUSTOM: "自定义",
};

export const breakKindLabels: Record<BreakKind, string> = {
  SHORT: "短休",
  LONG: "长休",
  MOVEMENT: "活动",
  EYE_REST: "远眺",
  MEAL: "用餐",
};

export const energyLevelLabels: Record<number, string> = {
  1: "极低",
  2: "较低",
  3: "一般",
  4: "良好",
  5: "很好",
};

export const energyLevelColors: Record<number, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#f59e0b",
  4: "#22c55e",
  5: "#0ea5e9",
};

export const jobSourceLabels: Record<string, string> = {
  lagou: "拉勾",
  liepin: "猎聘",
  zhilian: "智联招聘",
  job51: "前程无忧",
  boss: "Boss直聘",
  "sasac-recruit": "国资委",
  "cpta-notice": "中国人事考试网",
  "81rc": "军队人才网",
  "mohrss-sydw": "人社部事业单位平台",
  "jiangsu-sydw": "江苏省人社厅",
  "iguopin": "国聘网",
  "guokao": "国考专题",
};

/** 实验性平台（强风控，可能不稳定） */
export const experimentalJobSources: JobSource[] = ["boss"];

export const defaultCrawlerPlatforms: JobSource[] = ["lagou", "liepin", "zhilian", "job51"];

/** 招花招聘 · 支持的城市（前端城市筛选常驻显示；爬虫侧单源见 scripts/lib/cities.js，二者需保持一致） */
export const SUPPORTED_CITIES = [
  "北京", "上海", "广州", "深圳", "杭州", "成都",
  "西安", "重庆", "南京", "武汉", "苏州",
  "天津", "长沙", "郑州", "青岛", "宁波", "合肥",
  "厦门", "福州", "济南", "大连", "沈阳", "哈尔滨",
  "长春", "昆明", "贵阳", "南宁", "海口", "太原",
  "石家庄", "南昌",
  "乌鲁木齐", "克拉玛依", "吐鲁番", "哈密", "昌吉",
  "伊犁", "喀什", "阿克苏", "和田",
];

export const jobCategoryLabels: Record<JobCategory, string> = {
  internet: "互联网",
  gongkao: "考公",
  gongbian: "考编",
  yangqi: "央国企",
};

export const jobCategoryColors: Record<JobCategory, string> = {
  internet: "#10b981",
  gongkao: "#3b82f6",
  gongbian: "#8b5cf6",
  yangqi: "#f59e0b",
};

export const allJobCategories: JobCategory[] = ["internet", "gongkao", "gongbian", "yangqi"];

export const domainKindLabels: Record<DomainKind, string> = {
  career: "职业成长",
  language: "语言学习",
  sports: "运动训练",
  hobby: "兴趣技能",
  life: "生活成长",
  custom: "自定义",
};

export const jobApplicationStageLabels: Record<JobApplicationStage, string> = {
  favorite: "收藏",
  ready: "准备投递",
  applied: "已投递",
  online_test: "笔试",
  interview1: "一面",
  interview2: "二面",
  offer: "Offer",
  hired: "入职",
  closed: "关闭",
};

export const jobApplicationStageColors: Record<JobApplicationStage, string> = {
  favorite: "#8b8b94",
  ready: "#0ea5e9",
  applied: "#6366f1",
  online_test: "#8b5cf6",
  interview1: "#d97706",
  interview2: "#ea580c",
  offer: "#16a34a",
  hired: "#10b981",
  closed: "#6b7280",
};

/** Kanban 四列分组：收藏/进行中（投递+笔试+面试）/Offer/已入职 */
export const KANBAN_COLUMNS = [
  { key: "favorite", label: "收藏", stages: ["favorite", "ready"] as JobApplicationStage[] },
  { key: "active", label: "进行中", stages: ["applied", "online_test", "interview1", "interview2"] as JobApplicationStage[] },
  { key: "offer", label: "Offer", stages: ["offer"] as JobApplicationStage[] },
  { key: "done", label: "已入职/关闭", stages: ["hired", "closed"] as JobApplicationStage[] },
] as const;

export const interviewModeLabels: Record<InterviewMode, string> = {
  quiz: "题库刷题",
  mock: "模拟面试",
  interview: "真实面试",
};

export const HABIT_WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export const HABIT_TEMPLATES: HabitTemplate[] = [
  { name: "饮水", icon: "💧", isBoolean: false, targetValue: 8, unit: "杯", color: "#0ea5e9" },
  { name: "早睡", icon: "🌙", isBoolean: true, targetValue: null, unit: null, color: "#6366f1" },
  { name: "拉伸", icon: "🧘", isBoolean: true, targetValue: null, unit: null, color: "#14b8a6" },
  { name: "阅读", icon: "📖", isBoolean: false, targetValue: 30, unit: "分钟", color: "#f59e0b" },
  { name: "步数", icon: "👟", isBoolean: false, targetValue: 8000, unit: "步", color: "#22c55e" },
  { name: "练字", icon: "✍️", isBoolean: true, targetValue: null, unit: null, color: "#a855f7" },
];

/** 各口径在界面上的标题与单位 */
export const TRAINING_LOAD_METRIC_META: Record<TrainingLoadMetric, { title: string; unit: string }> = {
  volume: { title: "训练容量", unit: "kg" },
  reps: { title: "总次数", unit: "次" },
  sets: { title: "总组数", unit: "组" },
  sessions: { title: "训练次数", unit: "次" },
};

/** 当天有训练、但没有可量化负荷时的最小柱高（%），保证肉眼看得见 */
export const TRAINING_LOAD_MIN_HEIGHT = 16;

export const mealKindLabels: Record<MealKind, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

/** 每日营养目标（规则版默认值，可由用户设置覆盖） */
export const DEFAULT_NUTRITION_TARGETS: NutritionTotals = {
  kcal: 2000,
  proteinG: 120,
  carbsG: 220,
  fatG: 60,
};

/* ---------- v3 饮食模块视图口径（纯函数，Web / Mobile 共用） ---------- */

/** 餐次热量占比目标（早 25% / 午 35% / 晚 30% / 加餐 10%） */
export const MEAL_KCAL_SHARES: Record<MealKind, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

/* ---------- v3 M6：热量目标（BMR × 活动系数） ---------- */

export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "high"] as const;

export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "久坐",
  light: "轻活动",
  moderate: "中等活动",
  high: "高活动",
};

/** 热量目标的安全区间（避免算出离谱值） */
export const KCAL_TARGET_MIN = 1200;

export const KCAL_TARGET_MAX = 4000;

export const handLabels: Record<Hand, string> = { left: "左手", right: "右手" };

/* ---------- 运动闪光卡（卡面数据模型；Web 三维卡与移动端闪光卡共用同一份映射） ---------- */

/** 各项运动的英文档案名（卡面顶部小字） */
export const SPORT_ARCHIVE_EN: Record<string, string> = {
  badminton: "BADMINTON ARCHIVE",
  tennis: "TENNIS ARCHIVE",
  basketball: "BASKETBALL ARCHIVE",
  volleyball: "VOLLEYBALL ARCHIVE",
  "table-tennis": "TABLE TENNIS ARCHIVE",
  soccer: "FOOTBALL ARCHIVE",
  baseball: "BASEBALL ARCHIVE",
};

/** 通用兜底装备行 */
export const DEFAULT_SPORT_GEAR_LABELS = ["球拍", "球鞋", "球线", "手胶"];

/**
 * 各运动的装备录入模板（填入运动档案后直接上卡面）。
 *
 * v11.1 起：球拍只留一行「球拍」（型号与类型合并填写，如「VICTOR 龙牙之刃 II 进攻拍」）；
 * 「磅数」不再占装备行 —— 它只是一组数字，走图鉴四宫格的数值输入，不配图。
 */
export const SPORT_GEAR_TEMPLATES: Record<string, string[]> = {
  badminton: ["球拍", "球鞋", "羽毛球", "拍线"],
  tennis: ["球拍", "球鞋", "网球", "拍线"],
  "table-tennis": ["底板", "正手胶皮", "反手胶皮", "球鞋"],
  basketball: ["球鞋", "球衣", "护具", "身高位置"],
  soccer: ["球鞋（钉型）", "球衣", "护腿板", "比赛用球"],
  volleyball: ["球鞋", "护膝", "比赛用球", "位置"],
  baseball: ["手套", "球棒", "钉鞋", "比赛用球"],
};

/** 旧模板标签 → 现模板标签（v11.1 合并球拍型号 / 球拍类型，「球鞋类型」归并到「球鞋」） */
export const LEGACY_GEAR_LABEL_ALIASES: Record<string, string> = {
  球拍型号: "球拍",
  球拍类型: "球拍",
  球鞋类型: "球鞋",
};

export const SPORTS_CARD_PANEL_TITLE = "运动员档案 · ATHLETE PROFILE";

export const EQUIPMENT_CATEGORIES: EquipmentCategoryMeta[] = [
  { key: "badminton-racket", label: "羽毛球拍", gearLabel: "球拍", sportKey: "badminton" },
  { key: "badminton-shoes", label: "羽毛球鞋", gearLabel: "球鞋", sportKey: "badminton" },
  { key: "badminton-string", label: "拍线", gearLabel: "拍线", sportKey: "badminton" },
  { key: "badminton-shuttle", label: "羽毛球", gearLabel: "羽毛球", sportKey: "badminton" },
  { key: "badminton-accessory", label: "手胶/配件", gearLabel: "手胶", sportKey: "badminton" },
  { key: "tennis-racket", label: "网球拍", gearLabel: "球拍", sportKey: "tennis" },
  { key: "tennis-shoes", label: "网球鞋", gearLabel: "球鞋", sportKey: "tennis" },
  { key: "tennis-string", label: "网球线", gearLabel: "拍线", sportKey: "tennis" },
  { key: "tennis-ball", label: "网球", gearLabel: "网球", sportKey: "tennis" },
  { key: "table-tennis-racket", label: "乒乓球拍/底板", gearLabel: "底板", sportKey: "table-tennis" },
  { key: "table-tennis-rubber", label: "乒乓球胶皮", gearLabel: "正手胶皮", sportKey: "table-tennis" },
  { key: "table-tennis-shoes", label: "乒乓球鞋", gearLabel: "球鞋", sportKey: "table-tennis" },
  { key: "table-tennis-ball", label: "乒乓球", gearLabel: "比赛用球", sportKey: "table-tennis" },
  { key: "basketball-shoes", label: "篮球鞋", gearLabel: "球鞋", sportKey: "basketball" },
  { key: "basketball-ball", label: "篮球", gearLabel: "比赛用球", sportKey: "basketball" },
  { key: "soccer-shoes", label: "足球鞋", gearLabel: "球鞋（钉型）", sportKey: "soccer" },
  { key: "soccer-ball", label: "足球", gearLabel: "比赛用球", sportKey: "soccer" },
  { key: "soccer-guard", label: "护腿板", gearLabel: "护腿板", sportKey: "soccer" },
  { key: "volleyball-shoes", label: "排球鞋", gearLabel: "球鞋", sportKey: "volleyball" },
  { key: "volleyball-ball", label: "排球", gearLabel: "比赛用球", sportKey: "volleyball" },
  { key: "volleyball-knee", label: "护膝", gearLabel: "护膝", sportKey: "volleyball" },
  { key: "baseball-glove", label: "棒球手套", gearLabel: "手套", sportKey: "baseball" },
  { key: "baseball-bat", label: "棒球棒", gearLabel: "球棒", sportKey: "baseball" },
  { key: "baseball-shoes", label: "棒球钉鞋", gearLabel: "钉鞋", sportKey: "baseball" },
  { key: "baseball-ball", label: "棒球", gearLabel: "比赛用球", sportKey: "baseball" },
];

/** 每项权重（合计 100） */
export const DAILY_READINESS_WEIGHTS = { tasks: 40, habits: 30, workout: 15, nutrition: 15 } as const;

/** 最短板的人话（hero caption 用） */
export const DAILY_WEAKEST_LABEL: Record<NonNullable<DailyReadiness["weakest"]>, string> = {
  tasks: "任务还差几件",
  habits: "习惯还没打卡",
  workout: "今天还没动",
  nutrition: "饮食还没记",
};

/* ================= 密码策略（P0 安全加固 · S2-6） ================= */

/**
 * 常见弱口令黑名单（小写精确相等比较）：
 * 覆盖弱口令排行前端（123456/password/qwerty…）+ 中文场景高频（woaini/5201314…）。
 * 只做整串相等判断（不做子串/模式识别）：误伤少、可解释，作为长度策略之外的兜底。
 */
export const COMMON_WEAK_PASSWORDS: readonly string[] = [
  "123456",
  "12345",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "passw0rd",
  "111111",
  "11111111",
  "000000",
  "666666",
  "888888",
  "123123",
  "123321",
  "654321",
  "qwerty",
  "qwerty123",
  "qazwsx",
  "asdfgh",
  "asdfghjkl",
  "zxcvbnm",
  "abc123",
  "abcd1234",
  "a123456",
  "aa123456",
  "123qwe",
  "1q2w3e4r",
  "admin",
  "admin123",
  "root123",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "master",
  "shadow",
  "superman",
  "batman",
  "iloveyou",
  "trustno1",
  "changeme",
  "test1234",
  "guest123",
  "woaini",
  "woaini1314",
  "5201314",
];
