import { useCallback, useEffect, useState } from "react";
import { AppState, Dimensions, PixelRatio } from "react-native";

import { normalizeFontScale } from "@/lib/text-scale";

/**
 * 系统字号倍数的**实时**读取（P2-2 遗留项）。
 *
 * 背景：设置页原先只在进入时 `useMemo(() => PixelRatio.getFontScale(), [])` 读一次，
 * 用户去系统设置改完字号再回来（页面还在导航栈里、组件不重挂）显示的仍是旧倍数。
 *
 * 订阅两条通道：
 * - `Dimensions.change`：Android 改系统字号/显示大小会触发；
 * - `AppState` 回到 active：iOS 改动态字体不保证发 Dimensions 事件，从设置页切回来时补读。
 * 读到的值非法（0/NaN/负数）时按 1 处理，与 normalizeFontScale 的兜底一致。
 */
export function useFontScale(): number {
  const [scale, setScale] = useState(() => normalizeFontScale(PixelRatio.getFontScale()));

  const refresh = useCallback(() => {
    const next = normalizeFontScale(PixelRatio.getFontScale());
    setScale((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => {
    const dimensionSub = Dimensions.addEventListener("change", refresh);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      dimensionSub.remove();
      appStateSub.remove();
    };
  }, [refresh]);

  return scale;
}
