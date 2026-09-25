/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState , useMemo } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import { InlineToast, TOAST_DEFAULT_LIFE_MS, type ToastKind } from "@/components/toast";
import * as WebBrowser from "expo-web-browser";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetSection, SheetStickyCta } from "@/components/sheet";
import { enrollJobGaps, fetchJobDetail, fetchJobPlan, type JobDetail } from "@/lib/jobs";
import { formatRelativeTime, jobFreshness, jobSourceLabels, type JobLearningPlan, type JobPostingListItem } from "@learn-workbench/shared";

const SOURCE_COLORS: Record<string, string> = {
  lagou: "#10b981",
  liepin: "#0ea5e9",
  zhilian: "#4f46e5",
  job51: "#f97316",
  boss: "#f43f5e",
};

const AVATAR_COLORS = ["#10b981", "#0ea5e9", "#8b5cf6", "#f97316", "#f43f5e", "#f59e0b"];

function salaryText(job: JobPostingListItem): string {
  if (job.salaryText) return job.salaryText;
  if (job.salaryMin != null && job.salaryMax != null) return job.salaryMin + "-" + job.salaryMax + "K";
  if (job.salaryMin != null) return job.salaryMin + "K 起";
  if (job.salaryMax != null) return "最高 " + job.salaryMax + "K";
  return "面议";
}

/**
 * 岗位详情（v16 弹层重构）：
 * - 壳换成 `BottomSheet` 的 Sheet v3 槽位：subtitle / icon / headerAction（分享）/ footer（吸底 CTA）
 * - 正文用 `SheetSection` 分成「岗位信息 / 匹配分析 / 来源」三段
 * - 底部动作改 `SheetStickyCta`：主 = 查看原文，次 = 收藏（原三按钮里的「分享」上移到头部）
 * - 请求、回调、轻提示与"加入学习任务"的逻辑**一行未改**
 */
export function JobDetailModal({
  job,
  visible,
  onClose,
  onToggleFavorite,
}: {
  job: JobPostingListItem | null;
  visible: boolean;
  onClose: () => void;
  onToggleFavorite: (job: JobPostingListItem) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [plan, setPlan] = useState<JobLearningPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** v13 U4：轻提示的语义色与停留时长（与下面 setTimeout 的超时保持一致） */
  const [toastKind, setToastKind] = useState<ToastKind>("success");
  const [toastLifeMs, setToastLifeMs] = useState(TOAST_DEFAULT_LIFE_MS);
  const [enrolling, setEnrolling] = useState(false);

  const jobId = job?.id;
  useEffect(() => {
    if (!visible || jobId == null) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setDetail(null);
    setPlan(null);
    setToast(null);
    Promise.all([
      fetchJobDetail(jobId),
      fetchJobPlan(jobId).catch(() => null), // 未登录/无画像时返回 null，不阻断详情
    ])
      .then(([d, p]) => {
        if (alive) {
          setDetail(d);
          setPlan(p);
        }
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : "职位详情加载失败");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, jobId]);

  /**
   * v13 U4：轻提示统一入口 —— 文案/语义色/停留时长一起设置，
   * 超时清除沿用旧版的 setTimeout 语义（只清掉"还是这一条"的那个，避免清掉更新的提示）。
   * ⚠️ 必须声明在 `if (!display) return null` 之前：Hooks 不能出现在早退之后。
   */
  const showToast = useCallback((message: string, kind: ToastKind = "success", lifeMs = TOAST_DEFAULT_LIFE_MS) => {
    setToast(message);
    setToastKind(kind);
    setToastLifeMs(lifeMs);
    setTimeout(() => setToast((current) => (current === message ? null : current)), lifeMs);
  }, []);

  const display = detail ?? job;
  if (!display) return null;

  const freshness = jobFreshness(
    display.publishedAt ?? null,
    display.fetchedAt,
    display.deadlineAt ?? null,
    display.channel === "announcement" ? "announcement" : "job"
  );
  const freshnessColor =
    freshness.level === "just" || freshness.level === "within3"
      ? "#047857"
      : freshness.level === "within7"
        ? "#b45309"
        : freshness.level === "stale"
          ? "#b91c1c"
          : colors.textMuted;
  const freshnessBg =
    freshness.level === "just" || freshness.level === "within3"
      ? "rgba(16,185,129,0.14)"
      : freshness.level === "within7"
        ? "rgba(245,158,11,0.16)"
        : freshness.level === "stale"
          ? "rgba(239,68,68,0.14)"
          : colors.surfaceMuted;

  const popHeart = () => {
    if (job) onToggleFavorite(job);
  };

  const shareJob = async () => {
    try {
      await Share.share({
        title: display.title,
        message: display.title + " - " + display.company + "\n" + display.url,
      });
      showToast("已打开分享面板", "info", 2200);
    } catch {
      showToast("分享失败，请稍后重试", "error", 2200);
    }
  };

  const enrollPlan = async () => {
    if (!plan || plan.gaps.length === 0) return;
    setEnrolling(true);
    try {
      const created = await enrollJobGaps(plan.gaps);
      showToast(`已加入 ${created} 项学习任务到今日计划`, "success", 2400);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "加入失败", "error", 2400);
    } finally {
      setEnrolling(false);
    }
  };

  const openOriginal = async () => {
    if (!display.url) {
      showToast("该职位暂未提供原文链接", "info", 2200);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(display.url);
    } catch {
      showToast("无法打开原文链接", "error", 2200);
    }
  };

  const subtitle = [display.company, display.city || "城市不限", display.experience || "经验不限", display.education || "学历不限"]
    .filter(Boolean)
    .join(" · ");

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={display.title}
      subtitle={subtitle}
      icon="briefcase-outline"
      height="94%"
      headerAction={
        <Pressable hitSlop={10} onPress={() => void shareJob()} accessibilityLabel="分享职位">
          <ThemedIcon name="share-social-outline" size={19} color={colors.textMuted} />
        </Pressable>
      }
      footer={
        <>
          {toast ? <InlineToast message={toast} kind={toastKind} lifeMs={toastLifeMs} /> : null}
          <SheetStickyCta
            label="查看原文"
            icon="open-outline"
            onPress={() => void openOriginal()}
            secondaryLabel={job?.isFav ? "已收藏" : "收藏"}
            onSecondary={popHeart}
          />
        </>
      }
      footerHint={job?.isFav ? "已收藏，可在「我的求职」里跟进" : "收藏后会同步到「我的求职」"}
    >
      {/* 企业首字 + 薪资：原来的头部信息压缩成一行，省下的纵向空间留给正文 */}
      <View style={styles.heroRow}>
        <View style={[styles.logo, { backgroundColor: AVATAR_COLORS[display.id % AVATAR_COLORS.length] }]}>
          <Text style={styles.logoText}>{display.company.trim().charAt(0).toUpperCase() || "公"}</Text>
        </View>
        <View style={styles.heroMain}>
          <Text style={styles.salary}>{salaryText(display)}</Text>
          <Text style={styles.heroMeta}>更新于 {formatRelativeTime(display.fetchedAt)}</Text>
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <SheetSection title="岗位信息">
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>经验</Text>
            <Text style={styles.metaValue}>{display.experience || "不限"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>学历</Text>
            <Text style={styles.metaValue}>{display.education || "不限"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>城市</Text>
            <Text style={styles.metaValue}>{display.city || "不限"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>发布</Text>
            <Text style={styles.metaValue}>{formatRelativeTime(display.publishedAt)}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>正在绽放职位详情...</Text>
          </View>
        ) : !error ? (
          <>
            <Text style={styles.paraTitle}>职位描述</Text>
            <Text style={styles.paraText}>{detail?.description || "暂无职位描述"}</Text>
            <Text style={styles.paraTitle}>任职要求</Text>
            <Text style={styles.paraText}>{detail?.requirements || "暂无任职要求"}</Text>
            <Text style={styles.paraTitle}>公司信息</Text>
            <Text style={styles.paraText}>{detail?.companyInfo || "暂无公司信息"}</Text>
          </>
        ) : null}
      </SheetSection>

      {plan && plan.gaps.length > 0 ? (
        <SheetSection title="匹配分析" hint={plan.estimatedWeeks > 0 ? `每周 10h 约 ${plan.estimatedWeeks} 周` : undefined}>
          <View style={styles.planHeader}>
            <View style={styles.matchBadge}>
              <Text style={styles.matchText}>匹配 {plan.match}% · 补完约 +{Math.max(0, 100 - plan.match)}%</Text>
            </View>
          </View>
          <Text style={styles.planMeta}>
            共 {plan.gaps.length} 项缺口 · 约 {plan.totalHours} 小时
          </Text>
          {plan.phases.map((ph) => (
            <View key={ph.phaseId ?? "other"} style={styles.phaseBox}>
              <Text style={styles.phaseTitle}>
                {ph.phaseId ? `${(ph.phaseKey ?? "").replace("phase-", "P")} · ${ph.phaseTitle ?? "阶段"}` : "其他学习内容"}
                <Text style={styles.phaseHours}>  {ph.hours}h</Text>
              </Text>
              {ph.skills.map((g) => (
                <Text key={g.skill} style={styles.phaseSkill}>
                  · {g.skill}{g.topicTitle ? ` → ${g.topicTitle}` : ""}{g.estimateHours ? `（${g.estimateHours}h）` : ""}
                </Text>
              ))}
            </View>
          ))}
          <Pressable style={[styles.enrollBtn, enrolling && styles.enrollBtnDisabled]} onPress={enrollPlan} disabled={enrolling}>
            <Text style={styles.enrollText}>{enrolling ? "加入中..." : "全部缺口加入学习任务"}</Text>
          </Pressable>
        </SheetSection>
      ) : null}

      <SheetSection title="来源" last>
        <View style={styles.sourceRow}>
          <View style={styles.sourceBadge}>
            <View style={[styles.sourceDot, { backgroundColor: SOURCE_COLORS[display.source] }]} />
            <Text style={styles.sourceText}>{jobSourceLabels[display.source]}</Text>
          </View>
          {display.channel !== "announcement" ? (
            <View style={[styles.freshBadge, { backgroundColor: freshnessBg }]}>
              <Text style={[styles.freshText, { color: freshnessColor }]}>{freshness.emoji} {freshness.label}</Text>
            </View>
          ) : null}
          {display.isNew ? <Text style={styles.newBadge}>NEW</Text> : null}
          {display.clusterSources && display.clusterSources.length > 1 ? (
            <Text style={styles.clusterText} numberOfLines={1}>
              🔁 {display.clusterSources.map((s) => jobSourceLabels[s] ?? s).join("/")}
            </Text>
          ) : null}
        </View>
      </SheetSection>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  heroMain: { flex: 1, minWidth: 0, gap: 3 },
  salary: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.accentStrong,
  },
  heroMeta: {
    fontSize: 11.5,
    color: colors.textFaint,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metaItem: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.successSoft,
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.success,
    fontWeight: "700",
  },
  metaValue: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  paraTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginTop: 6,
  },
  paraText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.text,
  },
  loadingBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    lineHeight: 19,
    marginBottom: 12,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  sourceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "700",
  },
  newBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.success,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: "hidden",
  },
  freshBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  freshText: { fontSize: 10, fontWeight: "800" },
  clusterText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "700",
    color: colors.lavender,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  matchBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  matchText: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.primary,
  },
  planMeta: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  phaseBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  phaseTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.text,
  },
  phaseHours: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  phaseSkill: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
  enrollBtn: {
    backgroundColor: colors.success,
    borderRadius: 13,
    alignItems: "center",
    paddingVertical: 11,
    marginTop: 2,
  },
  enrollBtnDisabled: {
    opacity: 0.6,
  },
  enrollText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: "800",
  },
});
