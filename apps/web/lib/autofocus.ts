/** 解析 /tasks?autofocus=study|exercise&minutes=N&label=篮球&stype=BALL 或 /tasks?focus=1 快捷开始参数（纯函数，便于测试） */
export interface AutofocusParams {
  mode: "focus" | "exercise";
  minutes?: number;
  /** 运动项目名（仅 exercise 模式）：写入运动记录 type_label */
  label?: string;
  /** 运动大类（仅 exercise 模式）：写入运动记录 type */
  stype?: string;
}

const EXERCISE_TYPES = new Set(["BALL", "AEROBIC", "STRENGTH", "STRETCH", "MOVE", "OTHER"]);

/** minutes 仅在 1~180 的有限数字时生效（取整），缺省/非法回退 undefined（用计时器默认时长） */
function parseMinutes(search: URLSearchParams): number | undefined {
  const m = Number(search.get("minutes"));
  return Number.isFinite(m) && m >= 1 && m <= 180 ? Math.round(m) : undefined;
}

/**
 * 合法输入：
 *  - `?focus=1`（S6-6 专注独立入口）→ focus 模式；
 *  - `?autofocus=study` → focus；`?autofocus=exercise` → exercise。
 * label 仅 exercise 模式且非空时保留（截断 50 字）；stype 仅在合法枚举内保留。
 * 缺省或不合法返回 null（忽略）。
 */
export function parseAutofocusParams(search: string): AutofocusParams | null {
  const sp = new URLSearchParams(search);

  // S6-6：专注一级入口直接带 ?focus=1（能真正打开计时器）
  if (sp.get("focus") === "1") {
    return { mode: "focus", minutes: parseMinutes(sp) };
  }

  const af = sp.get("autofocus");
  if (af !== "study" && af !== "exercise") return null;
  const result: AutofocusParams = { mode: af === "exercise" ? "exercise" : "focus", minutes: parseMinutes(sp) };
  if (result.mode === "exercise") {
    const label = (sp.get("label") ?? "").trim().slice(0, 50);
    if (label) result.label = label;
    const stype = sp.get("stype") ?? "";
    if (EXERCISE_TYPES.has(stype)) result.stype = stype;
  }
  return result;
}
