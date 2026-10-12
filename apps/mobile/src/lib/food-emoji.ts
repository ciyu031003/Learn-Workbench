/**
 * 食物 → emoji 贴纸（v3 M3/M4：我们没有照片，用 emoji 当记录行的视觉锚点）
 *
 * 设计：按关键词**子串**匹配，命中优先级 = 关键词长度（更具体的词优先）；
 * 未命中返回 undefined，由调用方兜底 🍽️。纯函数、无依赖，便于单测。
 */
const RULES: [string, string][] = [
  // 主食
  ["米饭", "🍚"], ["炒饭", "🍚"], ["盖饭", "🍚"], ["粥", "🥣"], ["面条", "🍜"], ["拉面", "🍜"],
  ["意面", "🍝"], ["粉", "🍜"], ["米线", "🍜"], ["馒头", "🥟"], ["包子", "🥟"], ["饺子", "🥟"],
  ["面包", "🍞"], ["吐司", "🍞"], ["三明治", "🥪"], ["汉堡", "🍔"], ["披萨", "🍕"], ["卷饼", "🌯"],
  ["玉米", "🌽"], ["红薯", "🍠"], ["土豆", "🥔"], ["薯条", "🍟"], ["燕麦", "🥣"], ["麦片", "🥣"],
  // 蛋白
  ["鸡蛋", "🥚"], ["水煮蛋", "🥚"], ["煎蛋", "🍳"], ["鸡胸", "🍗"], ["鸡肉", "🍗"], ["炸鸡", "🍗"],
  ["牛肉", "🥩"], ["牛排", "🥩"], ["猪肉", "🥓"], ["培根", "🥓"], ["羊肉", "🍖"], ["排骨", "🍖"],
  ["鱼", "🐟"], ["三文鱼", "🍣"], ["虾", "🦐"], ["蟹", "🦀"], ["贝", "🦪"], ["豆腐", "🧊"],
  ["香肠", "🌭"], ["热狗", "🌭"],
  // 蔬果
  ["沙拉", "🥗"], ["生菜", "🥬"], ["西兰花", "🥦"], ["番茄", "🍅"], ["西红柿", "🍅"], ["黄瓜", "🥒"],
  ["胡萝卜", "🥕"], ["蘑菇", "🍄"], ["洋葱", "🧅"], ["大蒜", "🧄"], ["辣椒", "🌶️"], ["茄子", "🍆"],
  ["苹果", "🍎"], ["香蕉", "🍌"], ["橙", "🍊"], ["橘", "🍊"], ["葡萄", "🍇"], ["西瓜", "🍉"],
  ["草莓", "🍓"], ["蓝莓", "🫐"], ["桃", "🍑"], ["梨", "🍐"], ["菠萝", "🍍"], ["芒果", "🥭"],
  ["牛油果", "🥑"], ["柠檬", "🍋"], ["椰子", "🥥"], ["樱桃", "🍒"], ["猕猴桃", "🥝"],
  // 乳 / 饮
  ["牛奶", "🥛"], ["酸奶", "🥛"], ["奶酪", "🧀"], ["芝士", "🧀"], ["豆浆", "🥛"],
  ["咖啡", "☕"], ["拿铁", "☕"], ["美式", "☕"], ["奶茶", "🧋"], ["茶", "🍵"], ["可乐", "🥤"],
  ["汽水", "🥤"], ["果汁", "🧃"], ["啤酒", "🍺"], ["红酒", "🍷"], ["白酒", "🍶"], ["水", "💧"],
  // 零食 / 其他
  ["蛋糕", "🍰"], ["甜点", "🍰"], ["饼干", "🍪"], ["巧克力", "🍫"], ["冰淇淋", "🍦"], ["雪糕", "🍦"],
  ["坚果", "🥜"], ["花生", "🥜"], ["薯片", "🥔"], ["糖果", "🍬"], ["蜂蜜", "🍯"], ["月饼", "🥮"],
  ["寿司", "🍣"], ["火锅", "🍲"], ["汤", "🍲"], ["烧烤", "🍢"], ["串", "🍢"], ["麻辣烫", "🍲"],
  ["便当", "🍱"], ["咖喱", "🍛"], ["意式", "🍝"], ["墨西哥", "🌮"], ["塔可", "🌮"], ["泡面", "🍜"],
  ["蛋白粉", "🥤"], ["能量棒", "🍫"], ["补剂", "💊"],
];

/**
 * 食物 → 开源图标（v1.44.2 去 emoji）。
 *
 * 原先贴纸直接渲染 emoji。改图标时**不动 RULES 表**：它同时是"食物名 → 视觉分类"的
 * 唯一映射，而且 `foodEmoji()` 已被单测与「贴纸墙」复用；这里只加一层
 * 「emoji → MaterialCommunityIcons 名」的渲染映射，改动面最小。
 *
 * 选 MCI 是因为它的食物图标族最全（rice / noodles / fruit-grapes / glass-wine…），
 * 项目里也已装了 @expo/vector-icons。名字逐个核对过 glyphMap，不存在拼错变空白的风险。
 */
export const FOOD_ICON_BY_EMOJI: Record<string, string> = {
  "🍚": "rice",
  "🥣": "bowl-mix-outline",
  "🍜": "noodles",
  "🍝": "pasta",
  "🥟": "food-croissant",
  "🍞": "bread-slice-outline",
  "🥪": "food-croissant",
  "🍔": "hamburger",
  "🍕": "pizza",
  "🌯": "food-takeout-box-outline",
  "🌽": "corn",
  "🍠": "food-apple-outline",
  "🥔": "food",
  "🍟": "french-fries",
  "🥚": "egg-outline",
  "🍳": "egg-fried",
  "🍗": "food-drumstick-outline",
  "🥩": "food-steak",
  "🥓": "food-drumstick-outline",
  "🍖": "food-drumstick",
  "🐟": "fish",
  "🍣": "fish",
  "🦐": "fish",
  "🦀": "fish",
  "🦪": "fish",
  "🧊": "cube-outline",
  "🌭": "food-hot-dog",
  "🥗": "food-apple-outline",
  "🥬": "leaf",
  "🥦": "sprout",
  "🍅": "fruit-cherries",
  "🥒": "food-apple-outline",
  "🥕": "carrot",
  "🍄": "mushroom-outline",
  "🧅": "food-apple-outline",
  "🧄": "food-apple-outline",
  "🌶️": "chili-hot",
  "🍆": "food-apple-outline",
  "🍎": "food-apple",
  "🍌": "food-apple",
  "🍊": "fruit-citrus",
  "🍇": "fruit-grapes",
  "🍉": "fruit-watermelon",
  "🍓": "fruit-cherries",
  "🫐": "fruit-cherries",
  "🍑": "fruit-cherries",
  "🍐": "food-apple",
  "🍍": "fruit-pineapple",
  "🥭": "fruit-cherries",
  "🥑": "fruit-cherries",
  "🍋": "fruit-citrus",
  "🥥": "fruit-cherries",
  "🍒": "fruit-cherries",
  "🥝": "fruit-cherries",
  "🥛": "cup",
  "🧀": "cheese",
  "☕": "coffee",
  "🧋": "cup",
  "🍵": "tea",
  "🥤": "cup-outline",
  "🧃": "bottle-soda-outline",
  "🍺": "beer",
  "🍷": "glass-wine",
  "🍶": "glass-mug-variant",
  "💧": "water",
  "🍰": "cake-variant",
  "🍪": "cookie",
  "🍫": "candy",
  "🍦": "ice-cream",
  "🥜": "peanut",
  "🍬": "candy",
  "🍯": "beehive-outline",
  "🥮": "cake-variant",
  "🍲": "pot-steam",
  "🍢": "food-drumstick-outline",
  "🍱": "food-takeout-box-outline",
  "🍛": "rice",
  "🌮": "taco",
  "💊": "pill",
  "🍽️": "silverware-fork-knife",
};

/** 兜底图标（无法识别食物时） */
export const FOOD_ICON_FALLBACK = "silverware-fork-knife";

/** 取食物对应的图标名；先按指定 emoji，再按食物名推导，最后兜底 */
export function foodIcon(name: string | null | undefined, emoji?: string): string {
  const key = (emoji ?? foodEmoji(name)).trim();
  return FOOD_ICON_BY_EMOJI[key] ?? FOOD_ICON_FALLBACK;
}

/** 默认兜底（无法识别时） */
export const FOOD_EMOJI_FALLBACK = "🍽️";

/** 关键词命中表（导出便于单测与"贴纸墙"复用） */
export const FOOD_EMOJI_RULES: readonly [string, string][] = RULES;

export function foodEmoji(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return FOOD_EMOJI_FALLBACK;
  let best: string | undefined;
  let bestLen = 0;
  for (const [kw, emoji] of RULES) {
    if (n.includes(kw) && kw.length > bestLen) {
      best = emoji;
      bestLen = kw.length;
    }
  }
  return best ?? FOOD_EMOJI_FALLBACK;
}
