import { StyleSheet } from "react-native";

import { withAlpha } from "@/lib/chart-math";
import { radius, shadows, spacing, tabularNums, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";

/**
 * 职业页（V7 决策工作台）样式表。
 *
 * 纪律：
 * - 字阶一律走 typography token（本文件禁止裸数字 fontSize，scripts/check-font-scale.mjs 会拦）；
 * - 颜色一律走 colors.* 语义色（深色档自动成立），只有「暖橙渐变」用语义 soft 色 + withAlpha 叠出来；
 * - 圆角 / 间距 / 阴影只用 radius / spacing / shadows token。
 *
 * 版式对齐 prototype/learn-workbench-mobile-demo-v7.html 的「职业：决策工作台」：
 * 目标方向卡（暖橙）→ 岗位决策矩阵（表格）→ 技能缺口（横条）→ 投递漏斗 → 本周行动 → 决策日志。
 */
export const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /* ---------- 页面骨架 ---------- */
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { paddingHorizontal: spacing.lg, gap: spacing.md },
    section: { marginTop: spacing.md, marginBottom: 0 },
    sectionMeta: { ...typography.eyebrow, color: colors.textFaint },
    toast: { marginTop: spacing.sm },
    quote: {
      ...typography.eyebrow,
      color: colors.textFaint,
      textAlign: "center",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },

    /* ---------- ① 目标方向卡（暖橙渐变底） ---------- */
    northStar: {
      marginTop: spacing.xs,
      borderRadius: radius.panel,
      padding: spacing.lg,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(colors.accent, 0.26),
      backgroundColor: colors.surface,
      ...shadows.card,
    },
    nEyebrow: { ...typography.eyebrow, color: colors.accentStrong },
    nTitle: { ...typography.hero, color: colors.text, marginTop: 7 },
    nHint: { ...typography.meta, color: colors.textMuted, marginTop: 5 },
    fitRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.md },
    fitNum: { flexShrink: 0, alignItems: "center", minWidth: 64 },
    fitValue: { ...typography.numXl, color: colors.text, ...tabularNums },
    fitLabel: { ...typography.eyebrow, color: colors.textMuted, marginTop: 5 },
    bars: { flex: 1, minWidth: 0, gap: 7 },
    barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    barLabel: { ...typography.eyebrow, color: colors.textMuted, width: 52 },
    barTrack: { flex: 1, height: 5, borderRadius: radius.pill, backgroundColor: colors.chartTrack, overflow: "hidden" },
    barFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.accent },
    barValue: { ...typography.eyebrow, color: colors.textSecondary, minWidth: 40, textAlign: "right" },
    nCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: spacing.lg,
      minHeight: 44,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.control,
      backgroundColor: colors.accent,
    },
    nCtaText: { ...typography.callout, fontWeight: "700", color: colors.focusCanvas },

    /* ---------- ② 岗位决策矩阵（表格，不是卡片流） ---------- */
    matrix: {
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    matrixHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceMuted,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    matrixHeadTitle: { ...typography.eyebrow, color: colors.textFaint, flex: 1 },
    matrixHeadCell: { ...typography.eyebrow, color: colors.textFaint, textAlign: "center" },
    matrixHeadDeadline: { textAlign: "right" },
    matrixRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: 11,
      minHeight: 56,
    },
    matrixRowPressed: { backgroundColor: colors.surfaceMuted },
    matrixDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.md },
    colMatch: { width: 36 },
    colSalary: { width: 50 },
    colGrowth: { width: 30 },
    colDeadline: { width: 30 },
    badgeCell: { alignItems: "center" },
    mName: { flex: 1, minWidth: 0 },
    mTitle: { ...typography.caption, fontWeight: "700", color: colors.text },
    mSub: { ...typography.eyebrow, color: colors.textMuted, marginTop: 2 },
    badge: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { ...typography.eyebrow, fontWeight: "800", ...tabularNums },
    mSalary: { ...typography.eyebrow, color: colors.textSecondary, textAlign: "center" },
    mGrowth: { ...typography.eyebrow, textAlign: "center", fontWeight: "800" },
    mDeadline: { ...typography.eyebrow, color: colors.textMeta, textAlign: "right" },
    matrixEmpty: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      minHeight: 56,
      paddingHorizontal: spacing.md,
    },
    matrixEmptyText: { ...typography.caption, fontWeight: "600", color: colors.primary },

    /* ---------- ③ 技能缺口（3 条横向进度条） ---------- */
    gapRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderStyle: "dashed",
      borderBottomColor: colors.border,
    },
    gapName: { ...typography.meta, fontWeight: "600", color: colors.text, width: 96 },
    gapTrack: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.chartTrack, overflow: "hidden" },
    gapFill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.accent },
    gapValue: { ...typography.eyebrow, color: colors.textMuted, minWidth: 72, textAlign: "right", ...tabularNums },
    gapEmpty: { ...typography.meta, color: colors.textMuted, paddingVertical: spacing.sm },
    gapCta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: spacing.md,
      minHeight: 44,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: withAlpha(colors.primary, 0.24),
      backgroundColor: colors.primarySoft,
    },
    gapCtaDisabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
    gapCtaText: { ...typography.caption, fontWeight: "700", color: colors.primary },
    gapFoot: { ...typography.eyebrow, color: colors.textFaint, textAlign: "center", marginTop: spacing.sm },

    /* ---------- ④ 投递漏斗 ---------- */
    funnelRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 3 },
    funnelLabel: { ...typography.eyebrow, color: colors.textMuted, width: 40 },
    funnelTrack: {
      flex: 1,
      height: 22,
      borderRadius: radius.sm,
      backgroundColor: colors.chartTrack,
      overflow: "hidden",
    },
    funnelFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: radius.sm, backgroundColor: colors.primary },
    funnelFillOffer: { backgroundColor: colors.success },
    funnelCount: { ...typography.caption, fontWeight: "700", color: colors.text, width: 34, textAlign: "right", ...tabularNums },
    funnelRate: { ...typography.eyebrow, color: colors.textFaint, width: 40, textAlign: "right", ...tabularNums },
    funnelEmpty: { ...typography.meta, color: colors.textMuted, paddingVertical: spacing.sm },

    /* ---------- ⑤ 本周行动（可勾选） ---------- */
    actionRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      minHeight: 56,
    },
    actionRowLast: { borderBottomWidth: 0 },
    tick: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
      flexShrink: 0,
    },
    tickDone: { backgroundColor: colors.success, borderColor: colors.success },
    actionBody: { flex: 1, minWidth: 0, gap: 3 },
    actionTitle: { ...typography.caption, fontWeight: "700", color: colors.text },
    actionTitleDone: { color: colors.textFaint, textDecorationLine: "line-through" },
    actionDetail: { ...typography.meta, color: colors.textMuted },

    /* ---------- ⑥ 决策日志 ---------- */
    logRow: {
      flexDirection: "row",
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderStyle: "dashed",
      borderBottomColor: colors.border,
    },
    logRowLast: { borderBottomWidth: 0 },
    logDate: { width: 44, ...typography.eyebrow, color: colors.textFaint, paddingTop: 2, ...tabularNums },
    logBody: { flex: 1, minWidth: 0 },
    logText: { ...typography.meta, color: colors.textSecondary },
    logStrong: { fontWeight: "700", color: colors.text },

    /* ---------- 底部「分析工具（仅参考）」入口 ---------- */
    analysisRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    analysisIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      flexShrink: 0,
    },
    analysisBody: { flex: 1, minWidth: 0, gap: 2 },
    analysisTitle: { ...typography.callout, fontWeight: "600", color: colors.text },
    analysisSub: { ...typography.eyebrow, color: colors.textMuted },
    analysisEnd: { ...typography.eyebrow, color: colors.textFaint },
  });
