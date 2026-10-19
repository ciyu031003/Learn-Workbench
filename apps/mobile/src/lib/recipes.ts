import type { MealKind } from "@learn-workbench/shared/schemas";

/**
 * 饮食页「每日推荐」的食谱池（需求 2）。
 *
 * 为什么单独放一份、而不直接用 `@learn-workbench/content` 的 `recipeCatalog`：
 *  - 推荐位只需要「一人份的热量 + 三大营养素 + 时长 + 一个标签」，用来回答"今天吃什么"，
 *    不需要配料表与做法（那是「精选食谱」详情面板的职责）；
 *  - 数据量小、可离线、可按日期确定性轮换，不必为了推荐去载入整本食谱目录。
 *
 * 口径：所有数值都是**单人份**估算，来自常见中式家常搭配的公开常识值，用于日常记录参考，
 * 不替代营养师建议。热量与三大营养素保持自洽（4P + 4C + 9F ≈ kcal，见 recipes.test.ts），
 * 避免推荐卡上出现"热量和宏量对不上"的尴尬。
 */
export interface RecipeIdea {
  id: string;
  name: string;
  /** 可归入的餐次（早/午/晚/加餐） */
  meals: MealKind[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** 备餐 + 烹饪总时长（分钟） */
  minutes: number;
  /** 一句话标签（快手 / 高蛋白 / 减脂 …），沿用页面既有的胶囊语言 */
  tag: string;
}

/** 餐次顺序（与 shared 的 mealKindSchema 一致；页面按这个顺序铺推荐卡） */
export const RECIPE_MEALS: MealKind[] = ["breakfast", "lunch", "dinner", "snack"];

/**
 * 食谱池：早餐 7 / 午餐 7 / 晚餐 7 / 加餐 7 = 28 条（需求要求 ≥24 且四个餐次都覆盖）。
 * 有跨餐次的条目（如水果杯既早餐又加餐），轮换时可选空间更大。
 */
export const RECIPE_IDEAS: RecipeIdea[] = [
  /* ---------------- 早餐 ---------------- */
  {
    id: "banana-oat-bowl",
    name: "香蕉燕麦牛奶碗",
    meals: ["breakfast"],
    kcal: 420,
    proteinG: 18,
    carbsG: 62,
    fatG: 11,
    minutes: 10,
    tag: "高纤维",
  },
  {
    id: "tomato-egg-toast",
    name: "番茄鸡蛋全麦三明治",
    meals: ["breakfast"],
    kcal: 390,
    proteinG: 22,
    carbsG: 42,
    fatG: 15,
    minutes: 13,
    tag: "高蛋白",
  },
  {
    id: "purple-potato-soy-egg",
    name: "紫薯豆浆鸡蛋餐",
    meals: ["breakfast"],
    kcal: 430,
    proteinG: 22,
    carbsG: 58,
    fatG: 12,
    minutes: 20,
    tag: "饱腹",
  },
  {
    id: "century-egg-congee",
    name: "皮蛋瘦肉粥",
    meals: ["breakfast"],
    kcal: 340,
    proteinG: 18,
    carbsG: 44,
    fatG: 8,
    minutes: 35,
    tag: "暖胃",
  },
  {
    id: "greek-yogurt-berries",
    name: "希腊酸奶莓果杯",
    meals: ["breakfast", "snack"],
    kcal: 280,
    proteinG: 20,
    carbsG: 30,
    fatG: 8,
    minutes: 5,
    tag: "快手",
  },
  {
    id: "chive-egg-pancake",
    name: "韭菜鸡蛋饼",
    meals: ["breakfast"],
    kcal: 360,
    proteinG: 16,
    carbsG: 34,
    fatG: 18,
    minutes: 15,
    tag: "家常",
  },
  {
    id: "beef-lettuce-onigiri",
    name: "牛肉生菜饭团",
    meals: ["breakfast"],
    kcal: 410,
    proteinG: 24,
    carbsG: 48,
    fatG: 12,
    minutes: 12,
    tag: "带得走",
  },

  /* ---------------- 午餐 ---------------- */
  {
    id: "tomato-beef-rice",
    name: "番茄牛腩饭",
    meals: ["lunch"],
    kcal: 620,
    proteinG: 34,
    carbsG: 72,
    fatG: 20,
    minutes: 45,
    tag: "高蛋白",
  },
  {
    id: "chicken-grain-bowl",
    name: "香煎鸡胸杂粮饭",
    meals: ["lunch"],
    kcal: 560,
    proteinG: 42,
    carbsG: 58,
    fatG: 14,
    minutes: 30,
    tag: "减脂",
  },
  {
    id: "salmon-quinoa-salad",
    name: "三文鱼藜麦沙拉",
    meals: ["lunch"],
    kcal: 520,
    proteinG: 32,
    carbsG: 40,
    fatG: 24,
    minutes: 25,
    tag: "Omega-3",
  },
  {
    id: "pepper-pork-rice",
    name: "青椒肉丝盖饭",
    meals: ["lunch"],
    kcal: 590,
    proteinG: 28,
    carbsG: 70,
    fatG: 18,
    minutes: 25,
    tag: "下饭",
  },
  {
    id: "shrimp-broccoli-pasta",
    name: "虾仁西兰花意面",
    meals: ["lunch"],
    kcal: 540,
    proteinG: 34,
    carbsG: 62,
    fatG: 14,
    minutes: 30,
    tag: "高蛋白",
  },
  {
    id: "mapo-tofu-rice",
    name: "麻婆豆腐配米饭",
    meals: ["lunch"],
    kcal: 610,
    proteinG: 24,
    carbsG: 68,
    fatG: 26,
    minutes: 25,
    tag: "素食友好",
  },
  {
    id: "teriyaki-chicken-bento",
    name: "照烧鸡腿便当",
    meals: ["lunch"],
    kcal: 650,
    proteinG: 36,
    carbsG: 70,
    fatG: 22,
    minutes: 30,
    tag: "便当",
  },

  /* ---------------- 晚餐 ---------------- */
  {
    id: "steamed-bass-greens",
    name: "清蒸鲈鱼配时蔬",
    meals: ["dinner"],
    kcal: 420,
    proteinG: 38,
    carbsG: 18,
    fatG: 22,
    minutes: 30,
    tag: "低碳水",
  },
  {
    id: "winter-melon-rib-noodles",
    name: "冬瓜排骨汤面",
    meals: ["dinner"],
    kcal: 480,
    proteinG: 26,
    carbsG: 52,
    fatG: 16,
    minutes: 45,
    tag: "汤面",
  },
  {
    id: "mushroom-chicken-brown-rice",
    name: "香菇鸡肉糙米饭",
    meals: ["dinner"],
    kcal: 500,
    proteinG: 32,
    carbsG: 56,
    fatG: 14,
    minutes: 35,
    tag: "高纤维",
  },
  {
    id: "tomato-basa-pot",
    name: "番茄龙利鱼锅",
    meals: ["dinner"],
    kcal: 380,
    proteinG: 34,
    carbsG: 24,
    fatG: 14,
    minutes: 25,
    tag: "减脂",
  },
  {
    id: "garlic-broccoli-shrimp",
    name: "蒜蓉西兰花炒虾仁",
    meals: ["dinner"],
    kcal: 340,
    proteinG: 30,
    carbsG: 18,
    fatG: 14,
    minutes: 18,
    tag: "快手",
  },
  {
    id: "tofu-mushroom-soup-bun",
    name: "豆腐菌菇汤配杂粮馒头",
    meals: ["dinner"],
    kcal: 400,
    proteinG: 20,
    carbsG: 52,
    fatG: 12,
    minutes: 25,
    tag: "清淡",
  },
  {
    id: "chicken-soba-salad",
    name: "凉拌鸡丝荞麦面",
    meals: ["dinner"],
    kcal: 450,
    proteinG: 30,
    carbsG: 48,
    fatG: 14,
    minutes: 20,
    tag: "低 GI",
  },

  /* ---------------- 加餐 ---------------- */
  {
    id: "yogurt-nuts",
    name: "无糖酸奶配坚果",
    meals: ["snack"],
    kcal: 220,
    proteinG: 12,
    carbsG: 18,
    fatG: 11,
    minutes: 3,
    tag: "快手",
  },
  {
    id: "boiled-egg-tomatoes",
    name: "水煮蛋配小番茄",
    meals: ["snack"],
    kcal: 150,
    proteinG: 10,
    carbsG: 8,
    fatG: 8,
    minutes: 10,
    tag: "低碳水",
  },
  {
    id: "apple-peanut-butter",
    name: "苹果配花生酱",
    meals: ["snack"],
    kcal: 230,
    proteinG: 6,
    carbsG: 28,
    fatG: 11,
    minutes: 3,
    tag: "解馋",
  },
  {
    id: "whey-banana-shake",
    name: "乳清蛋白香蕉奶昔",
    meals: ["snack"],
    kcal: 260,
    proteinG: 26,
    carbsG: 28,
    fatG: 5,
    minutes: 5,
    tag: "练后",
  },
  {
    id: "cottage-cheese-cup",
    name: "茅屋奶酪奇亚籽水果杯",
    meals: ["snack"],
    kcal: 250,
    proteinG: 22,
    carbsG: 26,
    fatG: 6,
    minutes: 5,
    tag: "高蛋白",
  },
  {
    id: "roasted-chickpeas",
    name: "烤鹰嘴豆",
    meals: ["snack"],
    kcal: 180,
    proteinG: 9,
    carbsG: 24,
    fatG: 5,
    minutes: 25,
    tag: "高纤维",
  },
  {
    id: "dark-chocolate-walnut",
    name: "黑巧配核桃",
    meals: ["snack"],
    kcal: 200,
    proteinG: 4,
    carbsG: 14,
    fatG: 15,
    minutes: 2,
    tag: "小份犒劳",
  },
];

/**
 * FNV-1a 32 位哈希：把日期串变成稳定种子。
 * 为什么不用 `Math.random`：同一天内多次渲染/多次进页面必须给出**同一组**推荐，
 * 否则"刷新就换一批"会让人没法按推荐去买菜；种子只来自日期字符串，天然可复现。
 */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32：小、快、只依赖种子的伪随机数发生器（返回 [0,1)） */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 确定性洗牌（Fisher-Yates + 种子随机）：同一 seed 永远得到同一顺序；不改入参数组 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = makeRandom(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** YYYY-MM-DD → 天序号（UTC）；非法输入返回 0（解析失败时只退化，不抛错） */
export function dayNumber(dateKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return 0;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : 0;
}

/**
 * 在候选里按「日期 + 盐」挑一条：
 *  - 洗牌顺序由日期种子决定 → 有随机感，跨天大概率换菜；
 *  - 再按天序号旋转一格 → 相邻两天不会都落在同一条（洗牌本身有连号概率）。
 */
function pickForDay<T>(list: readonly T[], dateKey: string, salt: string): T | null {
  if (list.length === 0) return null;
  const order = seededShuffle(list, hashSeed(`${dateKey}|${salt}`));
  const offset = dayNumber(dateKey) % order.length;
  return order[offset];
}

export interface DailyRecipe {
  meal: MealKind;
  recipe: RecipeIdea;
}

/**
 * 按日期取「每日推荐」：每个餐次一条（早/午/晚/加餐），同一天内稳定、跨天变化。
 * 某个餐次在池子里没有候选时跳过（不会返回 undefined 卡片）。
 * 同一天内四个餐次尽量不重复（像水果杯这种跨餐次的条目先被早餐挑走，加餐就换一条），
 * 只有候选被挑完时才允许复用 —— 否则小池子会直接少一张卡。
 */
export function dailyRecipes(dateKey: string, pool: readonly RecipeIdea[] = RECIPE_IDEAS): DailyRecipe[] {
  const out: DailyRecipe[] = [];
  const used = new Set<string>();
  for (const meal of RECIPE_MEALS) {
    const all = pool.filter((idea) => idea.meals.includes(meal));
    const fresh = all.filter((idea) => !used.has(idea.id));
    const recipe = pickForDay(fresh.length > 0 ? fresh : all, dateKey, meal);
    if (!recipe) continue;
    used.add(recipe.id);
    out.push({ meal, recipe });
  }
  return out;
}

/**
 * 通用取数（需求里的「取固定几条推荐」）：从整个池子里按日期挑 count 条，
 * 同样做到同一天稳定、跨天变化；count 超过池子大小时按池子大小截断。
 */
export function pickRecipesForDate(
  dateKey: string,
  count = 3,
  pool: readonly RecipeIdea[] = RECIPE_IDEAS
): RecipeIdea[] {
  if (pool.length === 0 || count <= 0) return [];
  const order = seededShuffle(pool, hashSeed(`daily|${dateKey}`));
  const offset = dayNumber(dateKey) % order.length;
  const rotated = [...order.slice(offset), ...order.slice(0, offset)];
  return rotated.slice(0, Math.min(count, pool.length));
}

/** 按 id 取一条（详情/测试用） */
export function recipeIdeaById(id: string, pool: readonly RecipeIdea[] = RECIPE_IDEAS): RecipeIdea | null {
  return pool.find((idea) => idea.id === id) ?? null;
}
