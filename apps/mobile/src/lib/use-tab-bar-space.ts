import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname } from "expo-router";
import { tabBarSpaceForRoute } from "@/lib/tab-bar-metrics";

export {
  TAB_BAR_BREATHING,
  TAB_BAR_FLOAT_GAP,
  TAB_BAR_HEIGHT,
  tabBarBottomFor,
  tabBarSpaceFor,
} from "@/lib/tab-bar-metrics";

/**
 * 可滚动内容底部应留的空白。
 *
 * v17 阶段 B 起**按当前路由自适应**：hub 页（有底栏）留出底栏占位；
 * 被 push 上来的子页会盖住底栏，只留安全区 —— 否则子页滚到底会多出一段死白。
 * 23 个可滚动页继续统一用它做 `paddingBottom`，不逐屏写数值。
 * @param extra 追加留白（如页面自带的浮动按钮）
 */
export function useTabBarSpace(extra = 0): number {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  return tabBarSpaceForRoute(pathname, insets.bottom, extra);
}
