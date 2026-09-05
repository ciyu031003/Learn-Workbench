/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useEffect, useState , useMemo } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import * as WebBrowser from "expo-web-browser";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { Card } from "@/components/card";
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
  const [enrolling, setEnrolling] = useState(false);

  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

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
          : "rgba(24,24,27,0.06)";

  const popHeart = () => {
    heartScale.value = withSequence(withSpring(1.35, { damping: 10, stiffness: 260 }), withSpring(1));
    if (job) onToggleFavorite(job);
  };

  const shareJob = async () => {
    try {
      await Share.share({
        title: display.title,
        message: display.title + " - " + display.company + "\n" + display.url,
      });
      setToast("已打开分享面板");
    } catch {
      setToast("分享失败，请稍后重试");
    }
    setTimeout(() => setToast(null), 2200);
  };

  const enrollPlan = async () => {
    if (!plan || plan.gaps.length === 0) return;
    setEnrolling(true);
    try {
      const created = await enrollJobGaps(plan.gaps);
      setToast(`已加入 ${created} 项学习任务到今日计划`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "加入失败");
    } finally {
      setEnrolling(false);
      setTimeout(() => setToast(null), 2400);
    }
  };

  const openOriginal = async () => {
    if (!display.url) {
      setToast("该职位暂未提供原文链接");
      setTimeout(() => setToast(null), 2200);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(display.url);
    } catch {
      setToast("无法打开原文链接");
      setTimeout(() => setToast(null), 2200);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <Card style={styles.sheet}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <View style={[styles.logo, { backgroundColor: AVATAR_COLORS[display.id % AVATAR_COLORS.length] }]}>
                <Text style={styles.logoText}>{display.company.trim().charAt(0).toUpperCase() || "公"}</Text>
              </View>
              <View style={styles.headerMain}>
                <Text style={styles.title}>{display.title}</Text>
                <Text style={styles.salary}>{salaryText(display)}</Text>
                <Text style={styles.meta}>
                  {display.company} · {display.city || "城市不限"} · {display.experience || "经验不限"} · {display.education || "学历不限"}
                </Text>
              </View>
            </View>

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
              <Text style={styles.fetchedAt}>更新于 {formatRelativeTime(display.fetchedAt)}</Text>
            </View>

            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color="#10b981" />
                  <Text style={styles.loadingText}>正在绽放职位详情...</Text>
                </View>
              ) : null}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {!loading && !error ? (
                <>
                  <Text style={styles.sectionTitle}>职位描述</Text>
                  <Text style={styles.sectionText}>{detail?.description || "暂无职位描述"}</Text>
                  <Text style={styles.sectionTitle}>任职要求</Text>
                  <Text style={styles.sectionText}>{detail?.requirements || "暂无任职要求"}</Text>
                  <Text style={styles.sectionTitle}>公司信息</Text>
                  <Text style={styles.sectionText}>{detail?.companyInfo || "暂无公司信息"}</Text>

                  {plan && plan.gaps.length > 0 ? (
                    <View style={styles.planBox}>
                      <View style={styles.planHeader}>
                        <Text style={styles.planTitle}>📋 岗位学习计划</Text>
                        <View style={styles.matchBadge}>
                          <Text style={styles.matchText}>匹配 {plan.match}% · 补完约 +{Math.max(0, 100 - plan.match)}%</Text>
                        </View>
                      </View>
                      <Text style={styles.planMeta}>
                        共 {plan.gaps.length} 项缺口 · 约 {plan.totalHours} 小时
                        {plan.estimatedWeeks > 0 ? ` · 每周 10h 约 ${plan.estimatedWeeks} 周` : ""}
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
                    </View>
                  ) : null}
                </>
              ) : null}
            </ScrollView>

            <View style={styles.actions}>
              <Animated.View style={heartStyle}>
                <Pressable style={styles.actionBtn} onPress={popHeart}>
                  <ThemedIcon name={job?.isFav ? "heart" : "heart-outline"} size={22} color={job?.isFav ? "#f43f5e" : colors.textMuted} />
                  <Text style={styles.actionText}>{job?.isFav ? "已收藏" : "收藏"}</Text>
                </Pressable>
              </Animated.View>
              <Pressable style={styles.actionBtn} onPress={shareJob}>
                <ThemedIcon name="share-social-outline" size={22} color="#4f46e5" />
                <Text style={styles.actionText}>分享</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={openOriginal}>
                <ThemedIcon name="open-outline" size={20} color="#ffffff" />
                <Text style={[styles.actionText, { color: "#ffffff" }]}>查看原文</Text>
              </Pressable>
            </View>

            {toast ? <Text style={styles.toast}>{toast}</Text> : null}
          </Card>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(5,8,18,0.52)",
  },
  sheetWrap: {
    height: "85%",
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: 20,
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(24,24,27,0.18)",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
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
  headerMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 24,
  },
  salary: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f97316",
  },
  meta: {
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 18,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaItem: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  metaLabel: {
    fontSize: 11,
    color: "#047857",
    fontWeight: "700",
  },
  metaValue: {
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(24,24,27,0.05)",
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
    color: "#047857",
    backgroundColor: "rgba(52,211,153,0.22)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.55)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    overflow: "hidden",
  },
  fetchedAt: {
    marginLeft: "auto",
    fontSize: 11,
    color: colors.textFaint,
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
    color: "#7c3aed",
    backgroundColor: "rgba(139,92,246,0.12)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  body: {
    flex: 1,
    marginTop: 12,
  },
  bodyContent: {
    gap: 10,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4,
  },
  sectionText: {
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
    color: "#dc2626",
    lineHeight: 19,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(24,24,27,0.10)",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(24,24,27,0.05)",
    borderRadius: 14,
    paddingVertical: 11,
  },
  actionPrimary: {
    backgroundColor: "#10b981",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 90,
    backgroundColor: "rgba(24,24,27,0.82)",
    color: "#ffffff",
    textAlign: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    overflow: "hidden",
  },
  planBox: {
    marginTop: 8,
    backgroundColor: "rgba(79,70,229,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(79,70,229,0.25)",
    padding: 12,
    gap: 8,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  planTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  matchBadge: {
    backgroundColor: "rgba(79,70,229,0.14)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  matchText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4f46e5",
  },
  planMeta: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  phaseBox: {
    backgroundColor: "rgba(24,24,27,0.04)",
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
    backgroundColor: "#10b981",
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
