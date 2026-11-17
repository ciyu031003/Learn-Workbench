import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { PageHead } from "@/components/v2/page-head";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";

import { makeStyles } from "./radar-styles";

/**
 * ① 页头（v2 PageHead）：eyebrow + 主标题 + 副文案（目标岗位/城市）+ 右侧刷新控件。
 * 视觉锚点留给下方概览卡；副文案的拼接口径与拆分前逐字一致。
 */
export function RadarPageHead({
  targetRole,
  profileCity,
  onRefresh,
}: {
  targetRole: string | null;
  profileCity: string | null;
  onRefresh: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.pageHead}>
      <PageHead
        style={styles.pageHeadText}
        eyebrow="岗位匹配"
        title="岗位雷达"
        subtitle={
          targetRole
            ? `目标 ${targetRole}${profileCity ? ` · ${profileCity}` : ""}`
            : "按匹配度给今日适合你的岗位排序"
        }
      />
      <Pressable
        hitSlop={10}
        onPress={onRefresh}
        style={styles.refreshBtn}
        accessibilityRole="button"
        accessibilityLabel="刷新雷达"
      >
        <ThemedIcon name="refresh" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}
