import type { Ionicons } from "@expo/vector-icons";

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * 食物 → 开源图标（v2.0.1：彻底去 emoji）
 *
 * 演进：v3 起「食物贴纸」直接用 emoji 当视觉锚点 → v1.44.2 把**渲染**换成图标、
 * 但仍保留 emoji 当中间键（emoji → MaterialCommunityIcons）→ v2.0.1 按真机反馈
 * 「全 App 用户可见 emoji」把中间键也拆掉：现在表里直接写**分类**，分类再映射到
 * Ionicons（iOS 由 ThemedIcon 转 SF Symbols），文件内不再出现任何 emoji 字符，
 * 也就不存在 emoji 兜底。
 *
 * 匹配规则不变：按关键词**子串**匹配，关键词更长者优先；长度相同按表序（表序 =
 * 分类「主食 → 蛋白 → 水产 → 蔬果 → 水果 → 乳 → 饮 → 零食 → 菜肴」）。
 *
 * 纯数据 + 纯函数、零 react-native 运行时依赖（type-only import），便于单测。
 */

export type FoodCategory =
  | "staple"
  | "protein"
  | "seafood"
  | "vegetable"
  | "fruit"
  | "dairy"
  | "drink"
  | "snack"
  | "dish";

/** 分类 → Ionicons 图标名（iOS 的 SF Symbols 映射见 components/themed-icon.tsx） */
export const FOOD_CATEGORY_ICONS: Record<FoodCategory, IoniconName> = {
  /** 主食：米面粥饼 */
  staple: "restaurant",
  /** 蛋白：肉蛋豆制品 */
  protein: "fast-food",
  /** 水产：鱼虾蟹贝 */
  seafood: "fish",
  /** 蔬菜 */
  vegetable: "leaf",
  /** 水果 */
  fruit: "nutrition",
  /** 乳制品 */
  dairy: "cafe",
  /** 饮品 */
  drink: "cafe",
  /** 零食甜点 */
  snack: "ice-cream",
  /** 菜肴 / 复合餐（火锅、便当、汤…） */
  dish: "pizza",
};

/** 兜底图标（无法识别食物时；不返回 emoji） */
export const FOOD_ICON_FALLBACK: IoniconName = "restaurant";

/** 关键词 → 分类（导出便于单测与「贴纸墙」复用） */
export const FOOD_CATEGORY_RULES: readonly (readonly [string, FoodCategory])[] = [
  // 主食
  ["米饭", "staple"], ["炒饭", "staple"], ["盖饭", "staple"], ["粥", "staple"],
  ["面条", "staple"], ["拉面", "staple"], ["意面", "staple"], ["粉", "staple"], ["米线", "staple"],
  ["馒头", "staple"], ["包子", "staple"], ["饺子", "staple"], ["面包", "staple"],
  ["吐司", "staple"], ["三明治", "staple"], ["汉堡", "staple"], ["披萨", "staple"], ["卷饼", "staple"],
  ["玉米", "staple"], ["红薯", "staple"], ["土豆", "staple"], ["薯条", "staple"],
  ["燕麦", "staple"], ["麦片", "staple"],
  // 蛋白（肉蛋豆）
  ["鸡蛋", "protein"], ["水煮蛋", "protein"], ["煎蛋", "protein"],
  ["鸡胸", "protein"], ["鸡肉", "protein"], ["炸鸡", "protein"],
  ["牛肉", "protein"], ["牛排", "protein"], ["猪肉", "protein"], ["培根", "protein"],
  ["羊肉", "protein"], ["排骨", "protein"], ["豆腐", "protein"],
  ["香肠", "protein"], ["热狗", "protein"], ["补剂", "protein"],
  // 水产
  ["鱼", "seafood"], ["三文鱼", "seafood"], ["虾", "seafood"], ["蟹", "seafood"], ["贝", "seafood"],
  // 蔬菜
  ["沙拉", "vegetable"], ["生菜", "vegetable"], ["西兰花", "vegetable"],
  ["番茄", "vegetable"], ["西红柿", "vegetable"], ["黄瓜", "vegetable"],
  ["胡萝卜", "vegetable"], ["蘑菇", "vegetable"], ["洋葱", "vegetable"],
  ["大蒜", "vegetable"], ["辣椒", "vegetable"], ["茄子", "vegetable"],
  // 水果
  ["苹果", "fruit"], ["香蕉", "fruit"], ["橙", "fruit"], ["橘", "fruit"], ["葡萄", "fruit"],
  ["西瓜", "fruit"], ["草莓", "fruit"], ["蓝莓", "fruit"], ["桃", "fruit"], ["梨", "fruit"],
  ["菠萝", "fruit"], ["芒果", "fruit"], ["牛油果", "fruit"], ["柠檬", "fruit"],
  ["椰子", "fruit"], ["樱桃", "fruit"], ["猕猴桃", "fruit"],
  // 乳制品
  ["牛奶", "dairy"], ["酸奶", "dairy"], ["奶酪", "dairy"], ["芝士", "dairy"], ["豆浆", "dairy"],
  // 饮品
  ["咖啡", "drink"], ["拿铁", "drink"], ["美式", "drink"],
  ["奶茶", "drink"], ["茶", "drink"], ["可乐", "drink"], ["汽水", "drink"], ["果汁", "drink"],
  ["啤酒", "drink"], ["红酒", "drink"], ["白酒", "drink"], ["水", "drink"],
  // 零食 / 甜点
  ["蛋糕", "snack"], ["甜点", "snack"], ["饼干", "snack"], ["巧克力", "snack"],
  ["冰淇淋", "snack"], ["雪糕", "snack"], ["坚果", "snack"], ["花生", "snack"],
  ["薯片", "snack"], ["糖果", "snack"], ["蜂蜜", "snack"], ["月饼", "snack"], ["能量棒", "snack"],
  // 菜肴 / 复合餐
  ["寿司", "dish"], ["火锅", "dish"], ["汤", "dish"], ["烧烤", "dish"], ["串", "dish"],
  ["麻辣烫", "dish"], ["便当", "dish"], ["咖喱", "dish"], ["意式", "dish"],
  ["墨西哥", "dish"], ["塔可", "dish"], ["泡面", "dish"],
];

/** 食物名 → 分类；无法识别返回 null（由 foodIcon 兜底） */
export function foodCategory(name: string | null | undefined): FoodCategory | null {
  const n = (name ?? "").trim();
  if (!n) return null;
  let category: FoodCategory | null = null;
  let bestLen = 0;
  for (const [kw, cat] of FOOD_CATEGORY_RULES) {
    if (n.includes(kw) && kw.length > bestLen) {
      category = cat;
      bestLen = kw.length;
    }
  }
  return category;
}

/** 食物名 → Ionicons 图标名（绝不返回 emoji；未知食物走 FOOD_ICON_FALLBACK） */
export function foodIcon(name: string | null | undefined): IoniconName {
  const category = foodCategory(name);
  return category ? FOOD_CATEGORY_ICONS[category] : FOOD_ICON_FALLBACK;
}
