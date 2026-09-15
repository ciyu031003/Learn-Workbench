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
}: {
  /** 食物名（用于推导 emoji） */
  name: string;
  size?: number;
  /** 直接指定 emoji（如来自常用食物表） */
  emoji?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const glyph = emoji ?? foodEmoji(name);
  return (
    <View
      style={[
        styles.sticker,
        { width: size, height: size, borderRadius: Math.round(size * 0.3) },
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
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
  });
