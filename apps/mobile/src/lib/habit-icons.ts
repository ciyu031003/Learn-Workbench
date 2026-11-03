import type { Ionicons } from "@expo/vector-icons";

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * 习惯图标：把历史遗留的 emoji 映射到开源图标组件（v1.44.2 去 emoji，v2.0.1 收尾）。
 *
 * ## 为什么存储值仍是 emoji
 * `habits.icon` 是**持久化 + 跨端同步**字段：数据库里存的是 emoji，Web 端
 * （apps/web/app/habits/page.tsx）也在读同一个值。直接改存储格式会让
 *   - 旧数据渲染成空白方块；
 *   - Web / 移动端在双方都改完之前不一致。
 * 所以**存储值保持 emoji 不动**，只保留这一层「emoji → 图标名」渲染映射：
 * 两端各自按同一张表渲染图标，未来想真正迁移存储格式时也有据可依。
 *
 * ⚠️ 因此本文件的 emoji 都是**数据键，不会出现在任何 Text 里**：
 * 渲染一律走 `ThemedIcon name={habitIconName(...)}`，无 screen-reader 暴露
 * （选择器的无障碍文案用下面的 `label`，不再读 emoji 字符）。
 *
 * 遇到表里没有的值（用户自定义过的 emoji、或数据异常）统一回落到默认图标，
 * 不会出现空白。
 */
export const DEFAULT_HABIT_ICON: IoniconName = "repeat-outline";

/** 新建习惯时的默认存储值（emoji，兼容旧数据与 Web 端；不渲染） */
export const DEFAULT_HABIT_EMOJI = "✅";

/**
 * 内置习惯图标（顺序即选择器里的展示顺序）。
 * - `emoji`：**存储值**（持久化 + Web 端同读），只当 key，绝不渲染；
 * - `name`：移动端渲染用的 Ionicons（iOS 走 SF Symbols）；
 * - `label`：选择器的无障碍文案（读屏不读 emoji）。
 */
export const HABIT_ICON_CHOICES: { emoji: string; name: IoniconName; label: string }[] = [
  { emoji: "💧", name: "water-outline", label: "饮水" },
  { emoji: "🌙", name: "moon-outline", label: "早睡" },
  { emoji: "🧘", name: "body-outline", label: "冥想" },
  { emoji: "📖", name: "book-outline", label: "阅读" },
  { emoji: "👟", name: "footsteps-outline", label: "走路" },
  { emoji: "✍️", name: "create-outline", label: "写作" },
  { emoji: "🥗", name: "nutrition-outline", label: "饮食" },
  { emoji: "🏃", name: "walk-outline", label: "跑步" },
  { emoji: "💪", name: "barbell-outline", label: "健身" },
  { emoji: "🧠", name: "bulb-outline", label: "思考" },
  { emoji: "☀️", name: "sunny-outline", label: "早起" },
  { emoji: "🎯", name: "locate-outline", label: "专注" },
  { emoji: "🛏️", name: "bed-outline", label: "睡眠" },
  { emoji: "🦷", name: "happy-outline", label: "刷牙" },
  { emoji: "🧴", name: "flask-outline", label: "护肤" },
  { emoji: "🍵", name: "cafe-outline", label: "茶饮" },
  { emoji: "🚭", name: "ban-outline", label: "戒烟" },
  { emoji: "📵", name: "phone-portrait-outline", label: "少手机" },
  { emoji: "🎧", name: "headset-outline", label: "听书" },
  { emoji: "🧹", name: "brush-outline", label: "整理" },
  { emoji: "💊", name: "medkit-outline", label: "吃药" },
  { emoji: "🐶", name: "paw-outline", label: "遛狗" },
  { emoji: "💰", name: "cash-outline", label: "记账" },
  { emoji: "🙏", name: "heart-outline", label: "感恩" },
  { emoji: "✅", name: "checkmark-circle-outline", label: "打卡" },
  { emoji: "🌱", name: "leaf-outline", label: "成长" },
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
