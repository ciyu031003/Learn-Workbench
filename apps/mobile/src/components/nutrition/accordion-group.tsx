import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInUp, LinearTransition } from "react-native-reanimated";
import { ThemedIcon } from "@/components/themed-icon";
import { type ThemeColors } from "@/theme/tokens";
import type { NutritionStyles } from "./nutrition-styles";

export function AccordionGroup({
  id,
  title,
  hint,
  count,
  open,
  onToggle,
  styles,
  colors,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  /** 折叠标题上的条目数（undefined = 这组不是列表，不显示数字） */
  count?: number;
  open: boolean;
  onToggle: (id: string) => void;
  styles: NutritionStyles;
  colors: ThemeColors;
  children: ReactNode;
}) {
  return (
    <Animated.View layout={LinearTransition.duration(180)} style={styles.group}>
      <Pressable
        onPress={() => onToggle(id)}
        style={styles.groupHead}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}${typeof count === "number" ? `，${count} 项` : ""}，${open ? "点击收起" : "点击展开"}`}
      >
        <View style={styles.groupTitleWrap}>
          <Text style={styles.groupTitle}>{title}</Text>
          {hint ? (
            <Text style={styles.groupHint} numberOfLines={1}>
              {hint}
            </Text>
          ) : null}
        </View>
        {typeof count === "number" ? (
          <View style={styles.groupCount}>
            <Text style={styles.groupCountText}>{count}</Text>
          </View>
        ) : null}
        <ThemedIcon name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeInUp.duration(180)} style={styles.groupBody}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
