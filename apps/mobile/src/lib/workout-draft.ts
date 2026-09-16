import { toDateKey, fromDateKey, type Workout } from "@learn-workbench/shared";

/**
 * 训练记录「草稿」纯逻辑（v4 P3）。
 *
 * 抽出来的原因：这些规则（步进钳位、payload 清洗、日期选项、从已有记录回填）都跟 UI 无关，
 * 但出错代价高（组数变 0、重量丢精度、日期串格式不对 → 服务端 400），所以单测覆盖。
 */

export interface DraftItem {
  /** 动作字典的稳定键（自由输入的动作留 null） */
  exerciseKey: string | null;
  exerciseLabel: string;
  /** 输入框一律用字符串（受控输入 + 允许中途为空），提交时才转数字 */
  sets: string;
  reps: string;
  weightKg: string;
}

/** 步进器范围：比服务端上限（sets 200 / reps 2000 / weight 2000）紧，避免手滑点到离谱数值 */
export const SETS_MIN = 1;
export const SETS_MAX = 30;
export const REPS_MIN = 1;
export const REPS_MAX = 100;
export const WEIGHT_MAX = 500;
/** 杠铃/哑铃最小配重片：2.5kg */
export const WEIGHT_STEP = 2.5;

export const DEFAULT_SETS = "4";
export const DEFAULT_REPS = "8";

export function newDraftItem(over: Partial<DraftItem> = {}): DraftItem {
  return {
    exerciseKey: null,
    exerciseLabel: "",
    sets: DEFAULT_SETS,
    reps: DEFAULT_REPS,
    weightKg: "",
    ...over,
  };
}

/**
 * 数值步进：输入非法/为空时先用 fallback，再加减并钳位。
 * 返回字符串（受控 TextInput 的 value 类型），整数输入。
 */
export function stepNumber(raw: string, delta: number, min: number, max: number, fallback: number): string {
  const n = Number(raw);
  const base = raw.trim() !== "" && Number.isFinite(n) ? n : fallback;
  return String(Math.max(min, Math.min(max, Math.round(base + delta))));
}

/** 重量步进：0 视为"未填"（清空显示），保留 1 位小数（2.5 的倍数） */
export function stepWeight(raw: string, delta: number): string {
  const n = Number(raw);
  // 先把当前值夹到合法区间再加步长：粘贴进来的负数/超限值不会把结果带偏
  const base = raw.trim() !== "" && Number.isFinite(n) ? Math.max(0, Math.min(WEIGHT_MAX, n)) : 0;
  const next = Math.max(0, Math.min(WEIGHT_MAX, base + delta));
  const rounded = Math.round(next * 10) / 10;
  return rounded === 0 ? "" : String(rounded);
}

export interface WorkoutItemPayload {
  exerciseKey: string | null;
  exerciseLabel: string;
  sets: number;
  reps: number;
  weightKg: number | null;
}

/**
 * 草稿 → 提交 payload：
 * - 丢掉没填动作名的行（与旧实现一致）
 * - 数值钳到**服务端**范围（服务端会再钳一次，这里保证本地回显与服务端一致）
 */
export function toPayloadItems(items: DraftItem[]): WorkoutItemPayload[] {
  return items
    .map((it) => ({
      exerciseKey: it.exerciseKey,
      exerciseLabel: it.exerciseLabel.trim(),
      sets: clampInt(it.sets, 1, 200, 1),
      reps: clampInt(it.reps, 1, 2000, 1),
      weightKg: clampWeight(it.weightKg),
    }))
    .filter((it) => it.exerciseLabel.length > 0);
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = Number(raw);
  const base = raw.trim() !== "" && Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, Math.round(base)));
}

function clampWeight(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(Math.min(2000, n) * 10) / 10;
}

/** 已有记录 → 草稿（编辑场景回填） */
export function draftFromWorkout(w: Workout): { name: string; date: string; items: DraftItem[] } {
  return {
    name: w.name,
    date: w.exercisedOn.slice(0, 10),
    items:
      w.items.length > 0
        ? w.items.map((it) =>
            newDraftItem({
              exerciseKey: it.exerciseKey ?? null,
              exerciseLabel: it.exerciseLabel,
              sets: String(it.sets),
              reps: String(it.reps),
              weightKg: it.weightKg === null || it.weightKg === undefined ? "" : String(it.weightKg),
            })
          )
        : [newDraftItem()],
  };
}

export interface DateOption {
  key: string;
  label: string;
}

/**
 * 日期快捷项：今天 / 昨天 / 前天；编辑历史记录时把「原日期」也作为一项带上
 * （否则用户一进编辑弹层，日期就会被悄悄改成今天）。
 */
export function dateOptions(todayKey: string, current?: string | null): DateOption[] {
  const today = fromDateKey(todayKey);
  const out: DateOption[] = [
    { key: toDateKey(today), label: "今天" },
    { key: toDateKey(shiftDays(today, -1)), label: "昨天" },
    { key: toDateKey(shiftDays(today, -2)), label: "前天" },
  ];
  const cur = (current ?? "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(cur) && !out.some((o) => o.key === cur)) {
    out.unshift({ key: cur, label: cur.slice(5).replace("-", "/") });
  }
  return out;
}

function shiftDays(d: Date, delta: number): Date {
  const next = new Date(d.getTime());
  next.setDate(next.getDate() + delta);
  return next;
}
