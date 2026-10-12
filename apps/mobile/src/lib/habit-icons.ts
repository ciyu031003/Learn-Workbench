import type { Ionicons } from "@expo/vector-icons";

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * 习惯图标：把历史遗留的 emoji 映射到开源图标组件（v1.44.2 去 emoji）。
 *
 * ## 为什么不直接把库里的 emoji 改成图标名
 * `habits.icon` 是**持久化 + 跨端同步**字段：数据库里存的是 emoji，Web 端
 * （apps/web/app/habits/page.tsx）也在读同一个值。直接改存储格式会让
 *   - 旧数据渲染成空白方块；
 *   - Web / 移动端在双方都改完之前不一致。
 * 所以**存储值保持 emoji 不动**，只新增这一层「emoji → 图标名」渲染映射：
 * 两端各自按同一张表渲染图标，未来想真正迁移存储格式时也有据可依。
 *
 * 遇到表里没有的值（用户自定义过的 emoji、或数据异常）统一回落到默认图标，
 * 不会出现空白。
 */
export const DEFAULT_HABIT_ICON: IoniconName = "repeat-outline";

/** 内置习惯图标（顺序即选择器里的展示顺序）；emoji 是**存储值**，name 是渲染用的图标 */
export const HABIT_ICON_CHOICES: { emoji: string; name: IoniconName }[] = [
  { emoji: "💧", name: "water-outline" },
  { emoji: "🌙", name: "moon-outline" },
  { emoji: "🧘", name: "body-outline" },
  { emoji: "📖", name: "book-outline" },
  { emoji: "👟", name: "footsteps-outline" },
  { emoji: "✍️", name: "create-outline" },
  { emoji: "🥗", name: "nutrition-outline" },
  { emoji: "🏃", name: "walk-outline" },
  { emoji: "💪", name: "barbell-outline" },
  { emoji: "🧠", name: "bulb-outline" },
  { emoji: "☀️", name: "sunny-outline" },
  { emoji: "🎯", name: "locate-outline" },
  { emoji: "🛏️", name: "bed-outline" },
  { emoji: "🦷", name: "happy-outline" },
  { emoji: "🧴", name: "flask-outline" },
  { emoji: "🍵", name: "cafe-outline" },
  { emoji: "🚭", name: "ban-outline" },
  { emoji: "📵", name: "phone-portrait-outline" },
  { emoji: "🎧", name: "headset-outline" },
  { emoji: "🧹", name: "brush-outline" },
  { emoji: "💊", name: "medkit-outline" },
  { emoji: "🐶", name: "paw-outline" },
  { emoji: "💰", name: "cash-outline" },
  { emoji: "🙏", name: "heart-outline" },
  { emoji: "✅", name: "checkmark-circle-outline" },
  { emoji: "🌱", name: "leaf-outline" },
];

const BY_EMOJI = new Map(HABIT_ICON_CHOICES.map((c) => [c.emoji, c.name]));

/** 存储的 emoji → 渲染用图标名；未知值回落到默认图标（绝不返回空） */
export function habitIconName(icon: string | null | undefined): IoniconName {
  if (!icon) return DEFAULT_HABIT_ICON;
  return BY_EMOJI.get(icon.trim()) ?? DEFAULT_HABIT_ICON;
}

/** 图标名是否在映射表内（选择器用来判断是否显示"当前自定义"态） */
export function isKnownHabitEmoji(icon: string | null | undefined): boolean {
  return !!icon && BY_EMOJI.has(icon.trim());
}
