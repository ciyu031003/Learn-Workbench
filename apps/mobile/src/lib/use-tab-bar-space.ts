import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tabBarSpaceFor } from "@/lib/tab-bar-metrics";

export {
  TAB_BAR_BREATHING,
  TAB_BAR_FLOAT_GAP,
  TAB_BAR_HEIGHT,
  tabBarBottomFor,
  tabBarSpaceFor,
} from "@/lib/tab-bar-metrics";

/**
 * 可滚动内容底部应留的空白（底栏高 + 安全区 + 呼吸）。
 * 23 个可滚动页统一用它做 `paddingBottom`，不再逐屏随手写数值。
 * @param extra 追加留白（如页面自带的浮动按钮）
 */
export function useTabBarSpace(extra = 0): number {
  const insets = useSafeAreaInsets();
  return tabBarSpaceFor(insets.bottom, extra);
}
