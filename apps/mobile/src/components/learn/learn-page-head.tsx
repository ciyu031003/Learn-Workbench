import { useMemo } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { PageHead } from "@/components/v2/page-head";
import { useTheme } from "@/theme";

import { makeStyles } from "./learn-styles";

/**
 * ① 页头：eyebrow + 主标题 + 副文案；右上保留「阶段路线 / 全局搜索」两个入口。
 * 入场动画（entrance(0)）与 headRow 布局留在 learn.tsx 的组合层，本组件只出内容。
 */
export function LearnPageHead({ headSub }: { headSub: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <>
        <PageHead
          eyebrow="学习 · 网络与安全"
          title="学习"
          subtitle={headSub}
          style={styles.headText}
        />
        <View style={styles.headActions}>
          <PressableScale
            hitSlop={8}
            scaleTo={0.92}
            style={styles.headIconBtn}
            onPress={() => router.push("/roadmap" as never)}
            accessibilityRole="button"
            accessibilityLabel="打开阶段路线"
          >
            <ThemedIcon name="git-branch-outline" size={18} color={colors.textMuted} />
          </PressableScale>
          <PressableScale
            hitSlop={8}
            scaleTo={0.92}
            style={styles.headIconBtn}
            onPress={() => router.push("/search" as never)}
            accessibilityRole="button"
            accessibilityLabel="全局搜索"
          >
            <ThemedIcon name="search" size={18} color={colors.textMuted} />
          </PressableScale>
        </View>
    </>
  );
}
