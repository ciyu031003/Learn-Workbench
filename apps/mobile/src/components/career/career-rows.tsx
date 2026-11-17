import { useMemo } from "react";
import { View, Text } from "react-native";
import { router } from "expo-router";

import { PressableScale } from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { tabularNums } from "@/theme/tokens";

import { makeStyles } from "./career-styles";
import { TOOL_TONES, type EntryRowSpec } from "./career-model";

/** 单行入口（求职工具 / 更多入口 / 分析工具共用）：图标 + 标题/副标题 + 右侧值 + chevron */
function CareerEntryRow({ row }: { row: EntryRowSpec }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tone = TOOL_TONES[row.tone];
  return (
    <PressableScale
      style={styles.entryRow}
      hitSlop={4}
      haptic
      onPress={() => router.push(row.href as never)}
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
    >
      <View style={[styles.entryIcon, { backgroundColor: colors[tone.soft] as string }]}>
        <ThemedIcon name={row.icon} size={16} color={colors[tone.strong] as string} />
      </View>
      <View style={styles.entryBody}>
        <Text style={styles.entryTitle} numberOfLines={1}>{row.title}</Text>
        {row.subtitle ? <Text style={styles.entrySub} numberOfLines={1}>{row.subtitle}</Text> : null}
      </View>
      {row.end ? <Text style={[styles.entryEnd, tabularNums]} numberOfLines={1}>{row.end}</Text> : null}
      <ThemedIcon name="chevron-forward" size={13} color={colors.textFaint} />
    </PressableScale>
  );
}

/**
 * ③ / ⑤ / ⑥ 行列表：一张 Surface 卡片里若干行，行间一条 hairline 分隔线。
 * 求职工具（面试/简历/证书）、更多入口、分析工具（仅参考）三处复用同一个组件，
 * 只是传入的 rows 不同 —— 区块顺序与分隔线位置完全保持不变。
 */
export function CareerRowsList({ rows }: { rows: EntryRowSpec[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Surface padded={false} style={styles.rowList}>
      {rows.map((row, index) => (
        <View key={row.key}>
          {index > 0 ? <View style={styles.rowDivider} /> : null}
          <CareerEntryRow row={row} />
        </View>
      ))}
    </Surface>
  );
}
