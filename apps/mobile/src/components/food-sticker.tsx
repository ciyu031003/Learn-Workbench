import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { foodIcon } from "@/lib/food-icons";
import { shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 食物贴纸（v3 M3/M4；v2.0.1 去 emoji 收尾）
 *
 * 借「吃一点」的**贴纸 craft**（白描边 + 轻投影），视觉主体用开源图标而不是照片
 * —— 我们不做相机/AI（决策 D5），图标让每条记录都有可识别的视觉锚点。
 *
 * 图标来源：`lib/food-icons.ts` 按「食物名 → 分类 → Ionicons」推导；
 * iOS 由 ThemedIcon 自动换成 SF Symbols。调用方不再传 emoji（那层中间键已删）。
 */
export function FoodSticker({
  name,
  size = 40,
  style,
  outlined = false,
  rotate = 0,
}: {
  /** 食物名（用于推导分类图标） */
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  /**
   * 贴纸质感（v4 P4-b）：更粗的**白描边** + 更明显的投影。
   * 默认关闭，既有用法（列表小图标、日记网格等）渲染结果完全不变。
   */
  outlined?: boolean;
  /** 轻微旋转（度）：配合 outlined 做出"手贴上去"的感觉；默认 0 = 不转 */
  rotate?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View
      style={[
        styles.sticker,
        { width: size, height: size, borderRadius: Math.round(size * 0.3) },
        outlined && styles.outlined,
        rotate !== 0 && { transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
      accessibilityLabel={name}
    >
      {/* v2.0.1：分类图标（Ionicons / iOS SF Symbols），不再有 emoji 字符 */}
      <ThemedIcon name={foodIcon(name)} size={Math.round(size * 0.52)} color={colors.text} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sticker: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...shadows.card,
    },
    /** 白描边贴纸：3px 白边 + 更深的投影（借「吃一点」的贴纸 craft） */
    outlined: {
      borderWidth: 3,
      borderColor: "#FFFFFF",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 4,
    },
  });
