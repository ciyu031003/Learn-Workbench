import { type ReactNode, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
import { spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v16 弹层分组（uiverse P6-5）：标题 + 说明 + 可选右上动作 + 内容，
 * 分组之间用细分隔线区隔，替掉各调用方手写的 <Text> 小标题。
 */
export function SheetSection({
  title,
  hint,
  action,
  children,
  last = false,
}: {
  title?: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  /** 最后一段不画下分隔线 */
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.wrap, !last && styles.divided]}>
      {title || action ? (
        <View style={styles.head}>
          <View style={styles.headText}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm, paddingBottom: spacing.md },
    divided: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      marginBottom: spacing.md,
    },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    headText: { flex: 1, minWidth: 0, gap: 2 },
    title: { ...typography.callout, fontWeight: "800", color: colors.text },
    hint: { ...typography.micro, color: colors.textMuted },
    body: { gap: spacing.sm },
  });
