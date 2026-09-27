import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";

/**
 * v20-J2 · 统一分页条（招花域第 4 份复制收单源：jobs / radar / applications / interview）。
 *
 * 页码 API 统一为 **0 基**（与 radar/applications/interview 一致；jobs 1 基在调用处换算）。
 * 内置：PressableScale 按压 + soft 触觉 + 翻页中转圈 +「已显示 from–to / 共 total」range 行
 * （from/to/total 任一为 undefined 则省略该行）。
 */
export function PagerBar({
  page,
  pageCount,
  onPageChange,
  from,
  to,
  total,
  unit = "条",
  loading = false,
  style,
}: {
  /** 当前页（0 基） */
  page: number;
  pageCount: number;
  onPageChange: (next: number) => void;
  /** 已显示起始（1 基）；与 to/total 一起省略时不显示 range 行 */
  from?: number;
  to?: number;
  total?: number;
  /** range 单位（条 / 题 / 个） */
  unit?: string;
  /** 翻页请求进行中：中间显示转圈、两侧禁用 */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const disabled = loading || pageCount <= 1;
  const canPrev = page > 0 && !disabled;
  const canNext = page < pageCount - 1 && !disabled;

  const go = (next: number) => {
    if (next < 0 || next > pageCount - 1 || next === page || loading) return;
    haptics.soft();
    onPageChange(next);
  };

  return (
    <View style={[styles.wrap, style]}>
      <PressableScale
        disabled={!canPrev}
        scaleTo={0.94}
        onPress={() => go(page - 1)}
        style={[styles.btn, !canPrev && styles.btnOff]}
        accessibilityRole="button"
        accessibilityLabel="上一页"
      >
        <ThemedIcon name="chevron-back" size={16} color={canPrev ? colors.primary : colors.textFaint} />
        <Text style={[styles.btnText, !canPrev && styles.textOff]}>上一页</Text>
      </PressableScale>

      <View style={styles.mid}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <>
            <Text style={styles.page}>
              第 {page + 1} / {pageCount} 页
            </Text>
            {from != null && to != null && total != null ? (
              <Text style={styles.count}>
                已显示 {from}–{to} / 共 {total} {unit}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <PressableScale
        disabled={!canNext}
        scaleTo={0.94}
        onPress={() => go(page + 1)}
        style={[styles.btn, !canNext && styles.btnOff]}
        accessibilityRole="button"
        accessibilityLabel="下一页"
      >
        <Text style={[styles.btnText, !canNext && styles.textOff]}>下一页</Text>
        <ThemedIcon name="chevron-forward" size={16} color={canNext ? colors.primary : colors.textFaint} />
      </PressableScale>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    btnOff: { opacity: 0.45 },
    btnText: { ...typography.caption, color: colors.primary },
    textOff: { color: colors.textFaint },
    mid: { alignItems: "center", gap: 2, minWidth: 110 },
    page: { ...typography.caption, fontWeight: "700", color: colors.text },
    count: { ...typography.micro, color: colors.textMuted },
  });
