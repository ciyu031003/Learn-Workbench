import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";

export interface ChipOption {
  key: string;
  label: string;
  /** 右上角小数字（如"12 个岗位"） */
  badge?: number;
}

/**
 * v16 胶囊筛选（uiverse P6-1 的胶囊语言）：单选或多选，可横滑、可换行。
 * 招花的领域/城市/方向、雷达筛选、内容选择都收敛到这一个组件。
 */
export function ChipGroup({
  options,
  selected,
  onToggle,
  multiple = true,
  wrap = false,
  allKey,
  allLabel = "全部",
}: {
  options: readonly ChipOption[];
  selected: readonly string[];
  onToggle: (key: string) => void;
  /** false = 单选（点新的替换旧的） */
  multiple?: boolean;
  /** true = 换行铺排；false = 横向滚动 */
  wrap?: boolean;
  /** 传入后自动在最前面加一枚"全部" */
  allKey?: string;
  allLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const items: ChipOption[] = allKey
    ? [{ key: allKey, label: allLabel }, ...options.filter((o) => o.key !== allKey)]
    : [...options];

  const chips = items.map((o) => {
    const active = multiple ? selected.includes(o.key) : selected[0] === o.key;
    return (
      <PressableScale
        key={o.key}
        haptic
        scaleTo={0.96}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => onToggle(o.key)}
      >
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{o.label}</Text>
        {typeof o.badge === "number" && o.badge > 0 ? (
          <View style={[styles.badge, active && styles.badgeActive]}>
            <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{o.badge}</Text>
          </View>
        ) : null}
      </PressableScale>
    );
  });

  if (wrap) return <View style={styles.wrapRow}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    row: { gap: 8, paddingVertical: 2 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    labelActive: { color: colors.canvas },
    badge: {
      minWidth: 18,
      paddingHorizontal: 5,
      borderRadius: 999,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeActive: { backgroundColor: colors.canvas },
    badgeText: { ...typography.micro, fontSize: 10, fontWeight: "800", color: colors.textMuted },
    badgeTextActive: { color: colors.primary },
  });
