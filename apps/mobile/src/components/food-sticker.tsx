import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { foodEmoji } from "@/lib/food-emoji";
import { shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 食物 emoji 贴纸（v3 M3/M4）
 *
 * 借「吃一点」的**贴纸 craft**（白描边 + 轻投影），但视觉主体是 emoji 而不是照片
 * —— 我们不做相机/AI（决策 D5），emoji 让每条记录都有可识别的视觉锚点。
 */
export function FoodSticker({
  name,
  size = 40,
  emoji,
  style,
  outlined = false,
  rotate = 0,
}: {
  /** 食物名（用于推导 emoji） */
  name: string;
  size?: number;
  /** 直接指定 emoji（如来自常用食物表） */
  emoji?: string;
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
  const glyph = emoji ?? foodEmoji(name);
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
      <Text style={{ fontSize: Math.round(size * 0.5), lineHeight: Math.round(size * 0.62) }}>{glyph}</Text>
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
