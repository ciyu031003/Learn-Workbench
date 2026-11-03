import { useCallback, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { SectionTitle } from "@/components/v2/section-title";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { Skeleton, SkeletonCard } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import { InlineToast, TOAST_DEFAULT_LIFE_MS, type ToastKind } from "@/components/toast";
import {
  JobFreshnessBadge,
  JobNewBadge,
  JobSourceBadge,
  avatarColorOf,
  jobSalaryText,
} from "@/components/job-bits";
import { haptics } from "@/lib/haptics";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import {
  JobApiError,
  applyToJob,
  enrollJobGaps,
  fetchApplicationForJob,
  fetchJobDetail,
  fetchJobPlan,
  toggleJobFavorite,
  type JobDetail,
} from "@/lib/jobs";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import type { JobApplication, JobLearningPlan } from "@learn-workbench/shared/schemas";
import { jobApplicationStageLabels, jobSourceLabels } from "@learn-workbench/shared/labels";
import { formatRelativeTime } from "@learn-workbench/shared/dates";

/**
 * 招花 · 岗位详情页（P3-3A）。
 *
 * 背景：详情原先只是 jobs / radar 共用的弹层（components/job-detail-modal.tsx）。
 * 本页把「看详情 → 收藏 → 投递 → 缺口入计划」收敛成一条独立路由：
 * - 数据只复用 lib/jobs.ts 的既有客户端（fetchJobDetail / fetchJobPlan / toggleJobFavorite），
 *   另外新增 GET /api/jobs/favorites、GET/POST /api/jobs/applications 两个薄封装；
 * - 收藏是乐观更新 + 失败回滚（与服务端 favorited 返回值对齐）；
 * - 投递写 POST /api/jobs/applications（stage=applied）；已有非「收藏」阶段的记录时不重复投递，
 *   直接引导去 /applications 看进度；
 * - 匹配分析在未登录 / 画像不足 / 接口异常时降级为提示，不阻断详情阅读。
 *
 * 动效纪律：本页不加任何入场动画（motion 预算已满），交互反馈只用 PressableScale 按压；
 * 字阶一律走 typography token（fontscale 棘轮按文件计新增）。
 */

export default function JobDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const jobId = (raw ?? "").trim();
  // 路由参数只接受正整数 id：缺参数/脏参数直接给可返回的空态，不发请求
  if (!/^\d+$/.test(jobId)) return <MissingJob />;
  return <JobDetailView key={jobId} jobId={jobId} />;
}

function JobDetailView({ jobId }: { jobId: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((state) => state.token);

  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [plan, setPlan] = useState<JobLearningPlan | null>(null);
  const [application, setApplication] = useState<JobApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: ToastKind } | null>(null);

  /** 轻提示：与弹层版一致，超时只清掉「还是这一条」的提示，避免清掉更新的提示 */
  const showToast = useCallback(
    (message: string, kind: ToastKind = "success", lifeMs = TOAST_DEFAULT_LIFE_MS) => {
      setToast({ message, kind });
      setTimeout(() => {
        setToast((current) => (current?.message === message ? null : current));
      }, lifeMs);
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      // 匹配计划是「锦上添花」：未登录（401）/ 画像不足都会失败，不能拖垮详情主体
      const [nextDetail, nextPlan, nextApplication] = await Promise.all([
        fetchJobDetail(jobId),
        fetchJobPlan(jobId).catch(() => null),
        token ? fetchApplicationForJob(jobId).catch(() => null) : Promise.resolve(null),
      ]);
      setDetail(nextDetail);
      setPlan(nextPlan);
      setApplication(nextApplication);
      setFavorite(nextDetail.isFav);
    } catch (e) {
      const missing = e instanceof JobApiError && e.status === 404;
      setDetail(null);
      setPlan(null);
      setApplication(null);
      setNotFound(missing);
      setError(missing ? "这个岗位可能已下线或被删除" : e instanceof Error ? e.message : "职位详情加载失败");
    } finally {
      setLoading(false);
    }
  }, [jobId, token]);

  // 页面获得焦点时重新取数：从 /applications 或登录页返回后，投递态/收藏态不会过期
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const { control: pullControl } = usePullRefresh(load);

  const goLogin = () => {
    Alert.alert("请先登录", "登录后才能收藏和投递岗位。", [
      { text: "取消", style: "cancel" },
      { text: "去登录", onPress: () => router.push("/settings" as never) },
    ]);
  };

  /** 收藏：乐观更新，服务端确认后以返回值为准；失败回滚并提示 */
  const onToggleFavorite = async () => {
    if (favoriteBusy) return;
    if (!token) {
      goLogin();
      return;
    }
    const optimistic = !favorite;
    setFavorite(optimistic);
    setFavoriteBusy(true);
    haptics.soft();
    try {
      const favorited = await toggleJobFavorite(jobId);
      setFavorite(favorited);
      if (favorited) {
        haptics.success();
        showToast("已收藏，可在「我的收藏」查看", "success", 2200);
      } else {
        haptics.soft();
        showToast("已取消收藏", "info", 1800);
        // 取消收藏时服务端会同步移除仍停在「收藏」阶段的求职记录
        if (application && application.stage === "favorite") setApplication(null);
      }
    } catch (e) {
      setFavorite(!optimistic);
      haptics.error();
      showToast(e instanceof Error ? e.message : "收藏失败，请稍后重试", "error", 2600);
    } finally {
      setFavoriteBusy(false);
    }
  };

  const openOriginal = async () => {
    const url = detail?.url;
    if (!url) {
      showToast("该职位暂未提供原文链接", "info", 2000);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      showToast("无法打开原文链接", "error", 2200);
    }
  };

  const shareJob = async () => {
    if (!detail) return;
    try {
      await Share.share({
        title: detail.title,
        message: detail.title + " - " + detail.company + (detail.url ? "\n" + detail.url : ""),
      });
    } catch {
      showToast("分享失败，请稍后重试", "error", 2200);
    }
  };

  /**
   * 投递到我的求职：
   * - 已在后续阶段（非「收藏」）→ 不重复写入，直接去 /applications 看进度；
   * - 已收藏 / 无记录 → POST 应用（服务端 upsert，阶段推进到 applied）。
   */
  const onApply = async () => {
    if (application && application.stage !== "favorite") {
      router.push("/applications" as never);
      return;
    }
    if (!token) {
      goLogin();
      return;
    }
    if (applying) return;
    setApplying(true);
    try {
      const created = await applyToJob(jobId);
      setApplication(created);
      haptics.success();
      showToast("已投递，可在「我的求职」里继续跟进", "success", 2600);
    } catch (e) {
      haptics.error();
      showToast(e instanceof Error ? e.message : "投递失败，请稍后重试", "error", 2600);
    } finally {
      setApplying(false);
    }
  };

  const onEnrollGaps = async () => {
    if (!plan || plan.gaps.length === 0 || enrolling) return;
    if (!token) {
      goLogin();
      return;
    }
    setEnrolling(true);
    try {
      const created = await enrollJobGaps(plan.gaps);
      haptics.success();
      showToast("已加入 " + created + " 项学习任务到今日计划", "success", 2400);
    } catch (e) {
      haptics.error();
      showToast(e instanceof Error ? e.message : "加入学习任务失败", "error", 2600);
    } finally {
      setEnrolling(false);
    }
  };

  const applied = application !== null && application.stage !== "favorite";
  const applicationStageLabel = application ? jobApplicationStageLabels[application.stage] : "";
  const applyLabel = applying ? "投递中…" : applied ? "已投递 · 查看进度" : "投递到我的求职";
  const applyHint = applied
    ? "已在投递记录：" + applicationStageLabel + " · 点右侧查看进度"
    : application
      ? "已收藏 · 投递后进入「我的求职」跟进"
      : token
        ? "投递后会出现在「我的求职」，可继续推进阶段"
        : "登录后可投递并跟进进度";
  /** 吸底操作条高度 + 呼吸留白（正文底部留白用，避免最后一段被按钮压住） */
  const actionBarSpace = 96 + Math.max(insets.bottom, spacing.md);

  const headerRight = detail ? (
    <PressableScale
      hitSlop={8}
      onPress={() => void shareJob()}
      accessibilityRole="button"
      accessibilityLabel="分享职位"
    >
      <ThemedIcon name="share-social-outline" size={20} color={colors.textMuted} />
    </PressableScale>
  ) : undefined;

  if (loading && !detail) {
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="岗位详情" backTo="/jobs" />
        <View style={styles.content}>
          <SkeletonCard />
          <Skeleton lines={5} />
        </View>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.root}>
        <ScreenHeaderStickyBar title="岗位详情" backTo="/jobs" />
        <View style={styles.centerBox}>
          <EmptyState
            icon={notFound ? "document-outline" : "cloud-offline-outline"}
            title={notFound ? "没有找到这个岗位" : "职位详情加载失败"}
            hint={notFound ? "它可能已下线，或者被招聘平台撤回了。" : error ?? "网络不可用，请检查网络后重试。"}
            actionLabel={notFound ? "返回招花" : "重新加载"}
            onAction={() => {
              if (notFound) router.replace("/jobs" as never);
              else void load();
            }}
            pattern="none"
          />
        </View>
      </View>
    );
  }

  const tags = detail.tags.slice(0, 6);
  /** 匹配度条宽度：只做展示，数据仍来自 plan.match（不改动业务口径） */
  const matchPercent = plan ? Math.max(0, Math.min(100, Math.round(plan.match))) : 0;
  const matchWidth = `${matchPercent}%` as `${number}%`;
  const subtitleParts = [
    detail.company,
    detail.city || "城市不限",
    detail.experience || "经验不限",
    detail.education || "学历不限",
  ].filter(Boolean);

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="岗位详情" backTo="/jobs" right={headerRight} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: actionBarSpace }]}
        refreshControl={<RefreshControl {...pullControl} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 头部：企业首字 + 标题 + 公司 + 薪资（与列表卡同一套视觉件） */}
        <Card variant="hero" style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.logo, { backgroundColor: avatarColorOf(detail.id) }]}>
              <Text style={styles.logoText}>{detail.company.trim().charAt(0).toUpperCase() || "公"}</Text>
            </View>
            <View style={styles.heroMain}>
              <Text style={styles.title}>{detail.title}</Text>
              <Text style={styles.company} numberOfLines={1}>
                {subtitleParts.join(" · ")}
              </Text>
            </View>
          </View>
          <View style={styles.salaryRow}>
            <Text style={styles.salary}>{jobSalaryText(detail)}</Text>
            {detail.isNew ? <JobNewBadge /> : null}
          </View>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>城市</Text>
              <Text style={styles.metaValue}>{detail.city || "不限"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>经验</Text>
              <Text style={styles.metaValue}>{detail.experience || "不限"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>学历</Text>
              <Text style={styles.metaValue}>{detail.education || "不限"}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>发布</Text>
              <Text style={styles.metaValue}>{formatRelativeTime(detail.publishedAt ?? null)}</Text>
            </View>
          </View>
          <View style={styles.badgeRow}>
            {jobSourceLabels[detail.source] ? (
              <JobSourceBadge source={detail.source} label={jobSourceLabels[detail.source]} />
            ) : null}
            {detail.channel !== "announcement" && detail.fetchedAt ? (
              <JobFreshnessBadge
                publishedAt={detail.publishedAt ?? null}
                fetchedAt={detail.fetchedAt}
                deadlineAt={detail.deadlineAt ?? null}
              />
            ) : null}
            {detail.clusterSources && detail.clusterSources.length > 1 ? (
              <Text style={styles.clusterText} numberOfLines={1}>
                {detail.clusterSources.map((source) => jobSourceLabels[source] ?? source).join("/")}
              </Text>
            ) : null}
          </View>
          {tags.length > 0 ? (
            <View style={styles.tagRow}>
              {tags.map((tag, tagIndex) => (
                <View key={tag + "-" + tagIndex} style={styles.tag}>
                  <Text style={styles.tagText} numberOfLines={1}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <PressableScale
            haptic
            onPress={() => void openOriginal()}
            style={styles.originalLink}
            accessibilityRole="button"
            accessibilityLabel="打开职位原文"
          >
            <ThemedIcon name="open-outline" size={16} color={colors.primary} />
            <Text style={styles.originalText}>查看职位原文</Text>
            <ThemedIcon name="chevron-forward" size={14} color={colors.textFaint} />
          </PressableScale>
        </Card>

        {/* 职位描述：长文默认折叠，避免把匹配分析推到看不见的地方 */}
        <Card style={styles.sectionCard}>
          <SectionTitle title="职位描述" style={styles.sectionTitle} />
          <CollapsibleParagraph text={detail.description || "暂无职位描述"} />
          <SectionTitle title="任职要求" style={styles.sectionTitle} />
          <CollapsibleParagraph text={detail.requirements || "暂无任职要求"} />
          <SectionTitle title="公司信息" style={styles.sectionTitle} />
          <CollapsibleParagraph text={detail.companyInfo || "暂无公司信息"} />
        </Card>

        {/* 匹配分析：未登录 / 画像缺失 / 接口异常时优雅降级 */}
        <Card style={styles.sectionCard}>
          <SectionTitle
            title="匹配分析"
            style={styles.sectionTitleNoGap}
            right={
              plan && plan.estimatedWeeks > 0 ? (
                <Text style={styles.sectionHint}>每周 10h 约 {plan.estimatedWeeks} 周</Text>
              ) : undefined
            }
          />
          {plan ? (
            <>
              <View style={styles.matchRow}>
                <View style={styles.matchBadge}>
                  <Text style={styles.matchText}>匹配 {plan.match}%</Text>
                </View>
                <Text style={styles.planMeta}>
                  共 {plan.gaps.length} 项缺口 · 约 {plan.totalHours} 小时
                </Text>
              </View>
              {/* v2 匹配度条：静态渲染（本页不新增动画调用点），视觉与 ProgressBar 对齐 */}
              <View style={styles.matchTrack}>
                <View style={[styles.matchFill, { width: matchWidth }]} />
              </View>
              {plan.gaps.length === 0 ? (
                <Text style={styles.mutedText}>
                  暂无缺口数据：该岗位可能没有关联技能标签，或你的技能画像还没建立。
                </Text>
              ) : (
                <>
                  {plan.phases.map((phase) => (
                    <View key={phase.phaseId ?? "other"} style={styles.phaseBox}>
                      <View style={styles.phaseHead}>
                        <Text style={styles.phaseTitle}>
                          {phase.phaseId
                            ? (phase.phaseKey ?? "").replace("phase-", "P") + " · " + (phase.phaseTitle ?? "阶段")
                            : "其他学习内容"}
                        </Text>
                        <Text style={styles.phaseHours}>{phase.hours}h</Text>
                      </View>
                      {phase.skills.map((gap) => (
                        <Text key={gap.skill} style={styles.phaseSkill}>
                          · {gap.skill}
                          {gap.topicTitle ? " → " + gap.topicTitle : ""}
                          {gap.estimateHours ? "（" + gap.estimateHours + "h）" : ""}
                        </Text>
                      ))}
                    </View>
                  ))}
                  <PressableScale
                    haptic
                    disabled={enrolling}
                    onPress={() => void onEnrollGaps()}
                    style={[styles.enrollButton, enrolling ? styles.buttonBusy : null]}
                    accessibilityRole="button"
                    accessibilityLabel="全部缺口加入学习任务"
                  >
                    <ThemedIcon name="add-circle-outline" size={17} color={colors.primary} />
                    <Text style={styles.enrollText}>
                      {enrolling ? "加入中…" : token ? "全部缺口加入学习任务" : "登录后加入学习任务"}
                    </Text>
                  </PressableScale>
                </>
              )}
            </>
          ) : (
            <View style={styles.degradeBox}>
              <ThemedIcon name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.degradeText}>
                {token
                  ? "匹配分析暂时不可用：技能画像可能还不完整，稍后重试即可。"
                  : "登录后可查看匹配度、缺口技能与预计补完周数。"}
              </Text>
              <PressableScale
                hitSlop={4}
                onPress={() => {
                  if (token) void load();
                  else router.push("/settings" as never);
                }}
                style={styles.degradeAction}
                accessibilityRole="button"
                accessibilityLabel={token ? "重新加载匹配分析" : "去登录"}
              >
                <Text style={styles.degradeActionText}>{token ? "重新加载" : "去登录"}</Text>
              </PressableScale>
            </View>
          )}
        </Card>
      </ScrollView>

      {/* 吸底操作条：收藏（乐观更新）+ 投递（唯一主 CTA） */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        {toast ? <InlineToast message={toast.message} kind={toast.kind} style={styles.toast} /> : null}
        <Text style={styles.actionHint} numberOfLines={1}>
          {applyHint}
        </Text>
        <View style={styles.actionRow}>
          <PressableScale
            haptic
            disabled={favoriteBusy}
            onPress={() => void onToggleFavorite()}
            style={[styles.favoriteButton, favorite ? styles.favoriteButtonActive : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: favorite }}
            accessibilityLabel={favorite ? "取消收藏" : "收藏该岗位"}
          >
            <ThemedIcon
              name={favorite ? "heart" : "heart-outline"}
              size={19}
              color={favorite ? colors.danger : colors.textSecondary}
            />
            <Text style={[styles.favoriteText, favorite ? styles.favoriteTextActive : null]}>
              {favorite ? "已收藏" : "收藏"}
            </Text>
          </PressableScale>
          <PressableScale
            haptic
            disabled={applying}
            onPress={() => void onApply()}
            style={[styles.applyButton, applying ? styles.buttonBusy : null]}
            accessibilityRole="button"
            accessibilityLabel={applyLabel}
          >
            <ThemedIcon
              name={applied ? "checkmark-circle-outline" : "paper-plane-outline"}
              size={18}
              color={colors.canvas}
            />
            <Text style={styles.applyText}>{applyLabel}</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

/** 参数缺失（深链/分享链接残缺）：可返回招花列表的空态 */
function MissingJob() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="岗位详情" backTo="/jobs" />
      <View style={styles.centerBox}>
        <EmptyState
          icon="briefcase-outline"
          title="缺少岗位编号"
          hint="请从招花列表或收藏夹点进来。"
          actionLabel="返回招花"
          onAction={() => router.replace("/jobs" as never)}
          pattern="none"
        />
      </View>
    </View>
  );
}

/** 长文段落：超过约 6 行默认收起（判长用字符数/行数粗判，避免 Text onLayout 计行成本） */
function CollapsibleParagraph({ text, lines = 6 }: { text: string; lines?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 120 || text.split("\n").length > lines;
  return (
    <View style={styles.paraWrap}>
      <Text style={styles.paraText} numberOfLines={expanded ? undefined : lines}>
        {text}
      </Text>
      {long ? (
        <PressableScale
          hitSlop={4}
          onPress={() => setExpanded((value) => !value)}
          style={styles.paraToggleHit}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "收起" : "展开全文"}
        >
          <Text style={styles.paraToggle}>{expanded ? "收起" : "展开全文"}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    scroll: { flex: 1 },
    content: { padding: spacing.lg, gap: spacing.md },
    centerBox: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.lg },

    /** 头部是详情页唯一的大卡（Card hero：radius.panel + 1px 描边 + 轻投影） */
    heroCard: { gap: spacing.md },
    heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    logo: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: { ...typography.title2, color: colors.canvas, fontWeight: "800" },
    heroMain: { flex: 1, minWidth: 0, gap: 3 },
    title: { ...typography.hero, color: colors.text },
    company: { ...typography.meta, color: colors.textSecondary },
    salaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    salary: { ...typography.hero, color: colors.accentStrong },

    metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    metaItem: {
      width: "48%",
      flexGrow: 1,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.control,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 2,
    },
    metaLabel: { ...typography.meta, fontWeight: "700", color: colors.textMuted },
    metaValue: { ...typography.caption, fontWeight: "700", color: colors.text },

    badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    clusterText: {
      ...typography.micro,
      color: colors.lavender,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
      overflow: "hidden",
    },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: {
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 4,
      maxWidth: "100%",
    },
    tagText: { ...typography.micro, fontWeight: "700", color: colors.primary },
    originalLink: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.control,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
    },
    originalText: {
      ...typography.callout,
      fontWeight: "700",
      color: colors.primary,
      flex: 1,
    },

    /** Card 已带 radius.card + 1px 描边 + 轻投影；这里只调节奏 */
    sectionCard: { gap: spacing.sm },
    /** SectionTitle 自带 21 上边距，卡片内收到 4（与 Card 的 gap 组成 14 的节奏） */
    sectionTitle: { marginTop: spacing.xs, marginBottom: 0 },
    sectionTitleNoGap: { marginTop: 0, marginBottom: 0 },
    sectionHint: { ...typography.meta, color: colors.textMuted },

    paraWrap: { gap: 2 },
    paraText: { ...typography.callout, color: colors.text },
    paraToggleHit: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
    paraToggle: { ...typography.caption, fontWeight: "700", color: colors.primary },

    matchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
    matchBadge: {
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    matchText: { ...typography.caption, fontWeight: "800", color: colors.primary },
    planMeta: { ...typography.meta, color: colors.textMuted },
    mutedText: { ...typography.meta, color: colors.textMuted },
    /** 匹配度条：与 v2 ProgressBar 同视觉（6pt、pill、surfaceMuted 轨道） */
    matchTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
      marginTop: spacing.xs,
    },
    matchFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },

    phaseBox: { backgroundColor: colors.surfaceMuted, borderRadius: radius.control, padding: 12, gap: 4 },
    phaseHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
    phaseTitle: { ...typography.caption, fontWeight: "800", color: colors.text, flex: 1 },
    /** 阶段学时：v2 软胶囊（与「匹配 %」徽章同语法） */
    phaseHours: {
      ...typography.meta,
      fontWeight: "800",
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: "hidden",
    },
    phaseSkill: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },

    /** 次 CTA：v2 软胶囊（主 CTA 留给吸底「投递」） */
    enrollButton: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
    },
    enrollText: { ...typography.callout, fontWeight: "800", color: colors.primary },
    buttonBusy: { opacity: 0.6 },

    degradeBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.control,
      padding: spacing.md,
    },
    degradeText: { ...typography.meta, color: colors.textSecondary, flex: 1, lineHeight: 18 },
    degradeAction: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
    },
    degradeActionText: { ...typography.caption, fontWeight: "800", color: colors.primary },

    actionBar: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surfaceStrong,
      borderTopWidth: StyleSheet.hairlineWidth * 2,
      borderTopColor: colors.border,
      gap: 6,
      ...shadows.floating,
    },
    toast: { marginBottom: 2 },
    actionHint: { ...typography.meta, color: colors.textMuted, textAlign: "center" },
    actionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    /** 收藏：次级胶囊（44+ 热区） */
    favoriteButton: {
      minHeight: 50,
      minWidth: 100,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: spacing.lg,
    },
    favoriteButtonActive: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
    favoriteText: { ...typography.callout, fontWeight: "700", color: colors.textSecondary },
    favoriteTextActive: { color: colors.danger },
    /** 主 CTA：primary 胶囊 + 品牌投影 */
    applyButton: {
      flex: 1,
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      ...shadows.brand,
    },
    applyText: { ...typography.callout, fontWeight: "800", color: colors.canvas },
  });
