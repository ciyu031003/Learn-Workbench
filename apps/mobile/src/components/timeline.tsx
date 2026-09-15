import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 统一时间线（见 docs/APP端优化方案-v2 §1.5.3E —— 借 Orbix CareNest 的 care-plan timeline）
 * 节点 10pt：完成=品牌色实心 / 进行中=品牌色描边 / 未开始=muted 空心
 * 连线 2pt `border`；日期在左 11·muted，内容在右 15·600 + 12·muted
 * 用于：求职投递时间线、学习阶段推进、证书有效期。
 */
export type TimelineState = "done" | "active" | "todo";

export interface TimelineItem {
  key: string;
  state: TimelineState;
  /** 左侧日期/序号（如 09-15 / 第 3 阶段） */
  meta?: string;
  title: string;
  subtitle?: string;
  /** 右侧补充值（如时长 / 状态标签） */
  value?: string;
}

export function Timeline({
  items,
  style,
}: {
  items: TimelineItem[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.wrap, style]}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <View key={it.key} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.node,
                  it.state === "done" && styles.nodeDone,
                  it.state === "active" && styles.nodeActive,
                ]}
              />
              {!last ? <View style={styles.line} /> : null}
            </View>
            <View style={[styles.body, last && styles.bodyLast]}>
              {it.meta ? <Text style={styles.meta}>{it.meta}</Text> : null}
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>{it.title}</Text>
                {it.value ? <Text style={styles.value} numberOfLines={1}>{it.value}</Text> : null}
              </View>
              {it.subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{it.subtitle}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const RAIL_WIDTH = 22;
const NODE_SIZE = 10;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 0 },
    row: { flexDirection: "row", gap: 10 },
    rail: { width: RAIL_WIDTH, alignItems: "center" },
    node: {
      width: NODE_SIZE,
      height: NODE_SIZE,
      borderRadius: NODE_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      backgroundColor: "transparent",
      marginTop: 4,
    },
    nodeDone: { backgroundColor: colors.primary, borderColor: colors.primary },
    nodeActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    line: { flex: 1, width: 2, backgroundColor: colors.border, marginVertical: 2 },
    body: { flex: 1, minWidth: 0, paddingBottom: 14, gap: 2 },
    bodyLast: { paddingBottom: 0 },
    meta: { ...typography.micro, fontWeight: "600", color: colors.textFaint },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { flex: 1, minWidth: 0, ...typography.body, fontWeight: "600", color: colors.text },
    value: { ...typography.micro, fontWeight: "700", color: colors.primary },
    subtitle: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
  });
