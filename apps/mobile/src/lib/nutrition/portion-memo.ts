import type { Food } from "@learn-workbench/shared/schemas";

/**
 * 本机「上次分量」记忆（需求 3）。
 *
 * 为什么放在本机：`/api/nutrition/foods?sort=recent` 只回名称/单位/单位营养与使用频次，
 * **没有「上次分量」字段**；那个接口是 Web 与 App 共用的，不动。于是由客户端在每次
 * 添加成功后顺手记住一份，键 = 食物名（与 `foods` 的口径一致），读不到就按 1 份。
 */
export const PORTION_MEMO_KEY = "lwb.nutrition.last-portion.v1";

export interface PortionMemoEntry {
  amount: number;
  unit: string;
}

/**
 * 份量选项（需求 1）：质量单位按 50/100/150/200 走，其余按 0.5/1/1.5/2 份。
 * 单位原样带在标签上（份 / 碗 / 个 / g / ml），避免"1"看不出是什么单位。
 */
export function portionOptions(food: { unit: string }): { value: number; label: string }[] {
  const unit = (food.unit ?? "份").trim() || "份";
  if (/^(g|ml|克|毫升)$/i.test(unit)) {
    return [50, 100, 150, 200].map((grams) => ({ value: grams, label: `${grams} ${unit}` }));
  }
  return [0.5, 1, 1.5, 2].map((multiplier) => ({ value: multiplier, label: `${multiplier} ${unit}` }));
}

/**
 * 解析本机记忆（AsyncStorage 的原始字符串 → 归一化记录）。
 * 空/损坏/非法分量一律丢弃，等价于「没有记忆」，永不抛错。
 */
export function parsePortionMemo(raw: string | null | undefined): Record<string, PortionMemoEntry> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const out: Record<string, PortionMemoEntry> = {};
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    const key = name.trim();
    if (!key) continue;
    const v = value as Partial<PortionMemoEntry> | null;
    const amount = Number(v?.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out[key] = { amount, unit: typeof v?.unit === "string" && v.unit.trim() ? v.unit : "份" };
  }
  return out;
}

/** 某种食物的「上次分量」：本机记忆优先，没有就按 1 个默认单位 */
export function lastPortionOf(
  memo: Record<string, PortionMemoEntry>,
  food: Pick<Food, "name" | "unit">
): PortionMemoEntry {
  return memo[food.name.trim()] ?? { amount: 1, unit: food.unit };
}
