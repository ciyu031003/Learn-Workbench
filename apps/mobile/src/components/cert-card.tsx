import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Defs, LinearGradient, Rect, Stop, Svg } from "react-native-svg";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { withAlpha } from "@/lib/chart-math";
import type { Certificate } from "@learn-workbench/shared/schemas";
import { certificateStatusLabels } from "@learn-workbench/shared/labels";
import { certificateExpiryInfo } from "@learn-workbench/shared/pure";
import { achievementTone, type AchievementTone } from "@/components/achievement-card";

/**
 * 证书卡（V12 对齐）。
 *
 * 列表用 CertRow（已获得 / 备考中 / 计划中 三组，同一行式材质），
 * 详情用 CertDetailTile（深蓝证书主视觉 + CERTIFICATE OF ACHIEVEMENT 字样）。
 * 这里不再把证书图/备注塞进列表卡，避免首屏被图片撑成不规则高度。
 */
export type CertStatus = "planned" | "preparing" | "achieved";

export const CERT_STATUSES: readonly CertStatus[] = ["planned", "preparing", "achieved"];

/** 状态说明：让「更新状态」弹层里的每一行都能自解释，而不是只有三个词 */
export const CERT_STATUS_DESC: Record<CertStatus, string> = {
  planned: "先记下来，之后安排学习与报名",
  preparing: "正在备考 / 培训中，可在备注里记录进度",
  achieved: "已拿到证书，可上传证书照片留档",
};

/** 三种状态复用的 AchievementTone 语义（不新造色板） */
export function certStatusTone(status: CertStatus): AchievementTone {
  if (status === "achieved") return "gold";
  if (status === "preparing") return "blue";
  return "neutral";
}

/** 状态对应的 soft / strong 两档颜色，供状态弹层复用 */
export function certStatusPalette(colors: ThemeColors, status: CertStatus): { soft: string; strong: string } {
  return achievementTone(colors, certStatusTone(status));
}

export const CERT_STATUS_ICON: Record<CertStatus, Parameters<typeof ThemedIcon>[0]["name"]> = {
  planned: "book",
  preparing: "locate",
  achieved: "trophy",
};

/** 列表三组的识别色：已获得绿 / 备考中橙 / 计划中紫（对齐 demo listRow tone） */
export function certRowPalette(colors: ThemeColors, status: CertStatus): { soft: string; strong: string } {
  if (status === "achieved") return { soft: colors.successSoft, strong: colors.success };
  if (status === "preparing") return { soft: colors.accentSoft, strong: colors.accentStrong };
  return { soft: withAlpha(colors.lavender, 0.14), strong: colors.lavender };
}

export function CertRow({
  record,
  onPress,
  last = false,
}: {
  record: Certificate;
  onPress: () => void;
  last?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const status = (record.status ?? "planned") as CertStatus;
  const palette = certRowPalette(colors, status);
  const expiry = certificateExpiryInfo(record.expiryDate ?? null);
  const dateLabel = status === "achieved" ? record.earnedDate : record.targetDate;
  const meta = [record.issuer || null, dateLabel || null].filter(Boolean).join(" · ") || "未填写机构";
  const urgent = expiry.level === "soon" || expiry.level === "expired";

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={"查看证书 " + record.name + "，状态" + certificateStatusLabels[status]}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: palette.soft }]}>
        <ThemedIcon name={CERT_STATUS_ICON[status]} size={20} color={palette.strong} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {record.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {meta}
        </Text>
        {urgent ? (
          <Text style={[styles.rowExpiry, expiry.level === "expired" && styles.rowExpiryDanger]}>
            {expiry.label}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowEnd}>
        <Text style={[styles.rowStatus, { color: palette.strong }]}>{certificateStatusLabels[status]}</Text>
        <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}

/** 详情主视觉：深蓝渐变证书卡（对齐 demo .cert-tile） */
export function CertDetailTile({ record }: { record: Certificate }): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const status = (record.status ?? "planned") as CertStatus;
  return (
    <View style={styles.tile}>
      {/* 固定 viewBox + 数字尺寸：Android 上百分比 Rect 偶发不绘制，底下的深蓝底色保证文字始终可读 */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id="certTile" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#244A6A" />
            <Stop offset="0.56" stopColor="#2F74C0" />
            <Stop offset="1" stopColor="#5D9AD0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={100} height={60} fill="url(#certTile)" />
      </Svg>
      <View pointerEvents="none" style={styles.tileRing} />
      <Text style={styles.tileEyebrow}>CERTIFICATE OF ACHIEVEMENT</Text>
      <Text style={styles.tileName}>{record.name}</Text>
      <Text style={styles.tileIssuer}>{record.issuer || "—"}</Text>
      <View style={styles.tileBottom}>
        <View>
          <Text style={styles.tileSmall}>ISSUED</Text>
          <Text style={styles.tileValue}>{record.earnedDate || record.targetDate || "—"}</Text>
        </View>
        <View style={styles.tileBottomRight}>
          <Text style={styles.tileSmall}>STATUS</Text>
          <Text style={styles.tileValue}>{certificateStatusLabels[status]}</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /* 列表行：一个连续容器里的三组，分隔线只画在行与行之间 */
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 72,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      backgroundColor: colors.surfaceStrong,
    },
    rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    pressed: { opacity: 0.72 },
    rowIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    rowBody: { flex: 1, minWidth: 0, gap: 2 },
    rowTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    rowMeta: { ...typography.micro, color: colors.textMuted },
    rowExpiry: { ...typography.micro, fontWeight: "700", color: colors.accentStrong },
    rowExpiryDanger: { color: colors.danger },
    rowEnd: { alignItems: "flex-end", gap: 4 },
    rowStatus: { ...typography.micro, fontWeight: "800" },

    /* 详情证书主视觉 */
    tile: {
      position: "relative",
      overflow: "hidden",
      padding: 20,
      borderRadius: 20,
      minHeight: 170,
      backgroundColor: "#244A6A",
      ...shadows.floating,
    },
    tileRing: {
      position: "absolute",
      top: -84,
      right: -54,
      width: 190,
      height: 190,
      borderRadius: 95,
      borderWidth: 30,
      borderColor: "rgba(255,255,255,0.08)",
    },
    tileEyebrow: {
      ...typography.eyebrow,
      color: "rgba(255,255,255,0.72)",
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },
    tileName: { ...typography.title1, color: "#FFFFFF", marginTop: 9, letterSpacing: -0.6 },
    tileIssuer: { ...typography.caption, color: "rgba(255,255,255,0.76)", marginTop: 4 },
    tileBottom: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing.md,
      marginTop: "auto",
      paddingTop: 22,
    },
    tileBottomRight: { alignItems: "flex-end" },
    tileSmall: { ...typography.eyebrow, color: "rgba(255,255,255,0.62)", letterSpacing: 1 },
    tileValue: { ...typography.caption, fontWeight: "800", color: "#FFFFFF", marginTop: 3 },
  });
