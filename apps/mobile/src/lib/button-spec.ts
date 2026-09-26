/**
 * 按钮视觉规格（v17-D / R10）—— 零 react-native 依赖，可直接单测。
 *
 * 背景：项目里 `components/button.tsx`（Button，4 变体）与 `components/press-button.tsx`
 * （PressButton，3 变体）长期并存，**两边的尺寸/圆角/禁用透明度/配色其实一模一样**，
 * 只是各自复制了一份；差别只在按压与 loading 语义（PressButton 自带 0.97 缩放 + loadingLabel）。
 * 这里把"会漂移"的部分收敛成唯一出口（不替换调用点，避免大范围回归）。
 *
 * 分工（v17 决定，不再新增第三套）：
 * - Button      ：默认选择，绝大多数位置继续用它
 * - PressButton ：主 CTA（保存/上传/打卡/提交）——按下收一档 + loading 文案切换
 * 两者共享本文件的尺寸与配色，变体清单也统一为 primary / secondary / ghost / danger。
 */

export type UnifiedButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export const BUTTON_SIZES = {
  md: { height: 48, paddingHorizontal: 20, gap: 8, icon: 18 },
  sm: { height: 38, paddingHorizontal: 14, gap: 6, icon: 16 },
} as const;

export type ButtonSize = keyof typeof BUTTON_SIZES;

/** 禁用/加载态统一 40% 透明 */
export const BUTTON_DISABLED_OPACITY = 0.4;

export function buttonBackground(
  colors: { primary: string; primarySoft: string; danger: string },
  variant: UnifiedButtonVariant
): string {
  switch (variant) {
    case "primary":
      return colors.primary;
    case "secondary":
      return colors.primarySoft;
    case "danger":
      return colors.danger;
    default:
      return "transparent";
  }
}

/**
 * 前景色（文字与图标）：
 * - primary / danger 是彩色实底 → 白字（不跟随主题，否则深色模式下对比不足）
 * - secondary → 品牌色；ghost → 正文色
 */
export function buttonForeground(
  colors: { primary: string; text: string },
  variant: UnifiedButtonVariant
): string {
  if (variant === "primary" || variant === "danger") return "#FFFFFF";
  return variant === "secondary" ? colors.primary : colors.text;
}

/** 尺寸 → 图标字号（保持两个组件口径一致，避免 16/18 漂移） */
export function buttonIconSize(size: ButtonSize): number {
  return BUTTON_SIZES[size].icon;
}
