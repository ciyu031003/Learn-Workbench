import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { jobFreshness } from "@learn-workbench/shared";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";

/**
 * v20-J1 · 岗位视觉件单源（招花域）。
 *
 * 背景：jobs.tsx 与 job-detail-modal.tsx 之间复制了 5 组东西——平台来源色 / 头像底色 /
 * 薪资文案 / 鲜度徽章（含色映射）/ NEW 徽章，且两副面孔已有微差（newBadge 边框 1 vs hairline）。
 * 本文件是唯一事实源；徽章只做观感，不承载交互。
 */

/** 平台来源色：**仅作图表语义色**用于 6px 小色点，不参与页面强调色（强调色一律 colors.primary） */
export const JOB_SOURCE_COLORS: Record<string, string> = {
  lagou: "#5DAE74",
  liepin: "#2FB3A6",
  zhilian: "#8D7BD8",
  job51: "#F28C28",
  boss: "#F26B5E",
};

/** 公司 logo 圆底色（小面积语义色轮换，v20-V1 起 token 等价） */
export const JOB_AVATAR_COLORS = ["#5DAE74", "#2FB3A6", "#8D7BD8", "#F28C28", "#F26B5E", "#FFB25E"];

export function avatarColorOf(id: number): string {
  return JOB_AVATAR_COLORS[Math.abs(id) % JOB_AVATAR_COLORS.length];
}

type SalaryJob = { salaryText?: string | null; salaryMin?: number | null; salaryMax?: number | null };

/** 薪资文案：显式文案 > 区间 > 单边 > 面议 */
export function jobSalaryText(job: SalaryJob): string {
  if (job.salaryText) return job.salaryText;
  if (job.salaryMin != null && job.salaryMax != null) return job.salaryMin + "-" + job.salaryMax + "K";
  if (job.salaryMin != null) return job.salaryMin + "K 起";
  if (job.salaryMax != null) return "最高 " + job.salaryMax + "K";
  return "面议";
}

export function JobSourceBadge({ source, label }: { source: string; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.sourceBadge}>
      <View style={[styles.sourceDot, { backgroundColor: JOB_SOURCE_COLORS[source] ?? colors.textFaint }]} />
      <Text style={styles.sourceText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * 鲜度徽章：just/within3 绿 · within7 琥珀 · stale 红。
 * v20-J1：色映射收进 token（successSoft/warningSoft/dangerSoft），替换原先逐处手写的 rgba。
 */
export function JobFreshnessBadge({
  publishedAt,
  fetchedAt,
  deadlineAt,
}: {
  publishedAt: string | null;
  fetchedAt: string;
  deadlineAt: string | null;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const f = jobFreshness(publishedAt, fetchedAt, deadlineAt, "job");
  const color =
    f.level === "just" || f.level === "within3"
      ? colors.success
      : f.level === "within7"
        ? colors.warning
        : f.level === "stale"
          ? colors.danger
          : colors.textMuted;
  const bg =
    f.level === "just" || f.level === "within3"
      ? colors.successSoft
      : f.level === "within7"
        ? colors.warningSoft
        : f.level === "stale"
          ? colors.dangerSoft
          : colors.surfaceMuted;
  return (
    <View style={[styles.freshBadge, { backgroundColor: bg }]}>
      <Text style={[styles.freshText, { color }]}>
        {f.emoji} {f.label}
      </Text>
    </View>
  );
}

export function JobNewBadge() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.newBadge}>
      <Text style={styles.newText}>NEW</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sourceBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 9,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    sourceDot: { width: 7, height: 7, borderRadius: 4 },
    sourceText: { fontSize: 11, color: colors.textMuted, fontWeight: "700" },
    freshBadge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
    freshText: { fontSize: 10, fontWeight: "800" },
    newBadge: {
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: colors.successSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.success,
      overflow: "hidden",
    },
    newText: { fontSize: 10, fontWeight: "800", color: colors.success },
  });
