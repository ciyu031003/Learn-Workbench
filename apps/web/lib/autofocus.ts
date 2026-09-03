/** 解析 /tasks?autofocus=study|exercise&minutes=N 快捷开始参数（纯函数，便于测试） */
export interface AutofocusParams {
  mode: "focus" | "exercise";
  minutes?: number;
}

/**
 * 合法：autofocus=study → focus；autofocus=exercise → exercise。
 * minutes 仅在 1~180 的有限数字时生效（取整），缺省/非法回退 undefined（用计时器默认时长）。
 * autofocus 缺省或不合法返回 null（忽略）。
 */
export function parseAutofocusParams(search: string): AutofocusParams | null {
  const sp = new URLSearchParams(search);
  const af = sp.get("autofocus");
  if (af !== "study" && af !== "exercise") return null;
  const m = Number(sp.get("minutes"));
  const minutes = Number.isFinite(m) && m >= 1 && m <= 180 ? Math.round(m) : undefined;
  return { mode: af === "exercise" ? "exercise" : "focus", minutes };
}
