import { useMemo } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";

import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";

import { makeStyles } from "./learn-styles";

/**
 * ① 学习舱页头（对齐 demo .lc-hero 上半部分）：
 * eyebrow「LEARNING CABIN · P1」+ 两行大标题（当前阶段名，来自 roadmap 数据）。
 *
 * 右上保留「阶段路线 / 全局搜索」两个入口（原页头功能不丢）：
 * 章节树负责「当前阶段内」，这两个按钮负责「换阶段」与「跨内容查找」。
 */
export function LearnPageHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
      <View style={styles.headRow}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {eyebrow}
        </Text>
        <View style={styles.headActions}>
          <PressableScale
            hitSlop={8}
            scaleTo={0.92}
            style={styles.headIconBtn}
            onPress={() => router.push("/roadmap" as never)}
            accessibilityRole="button"
            accessibilityLabel="打开阶段路线"
          >
            <Icon name="target" size={18} weight="regular" color={colors.textMeta} />
          </PressableScale>
          <PressableScale
            hitSlop={8}
            scaleTo={0.92}
            style={styles.headIconBtn}
            onPress={() => router.push("/search" as never)}
            accessibilityRole="button"
            accessibilityLabel="全局搜索"
          >
            <Icon name="search" size={18} weight="regular" color={colors.textMeta} />
          </PressableScale>
        </View>
      </View>
      <Text style={styles.headTitle} numberOfLines={2}>
        {title}
      </Text>
    </>
  );
}
