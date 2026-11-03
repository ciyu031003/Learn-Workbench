/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { PagerBar } from "@/components/pager-bar";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { SkeletonList } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import { JobSourceBadge, avatarColorOf, jobSalaryText } from "@/components/job-bits";
import { haptics } from "@/lib/haptics";
import { JobApiError, fetchFavoriteJobs, toggleJobFavorite } from "@/lib/jobs";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import type { JobPostingListItem } from "@learn-workbench/shared/schemas";
import { jobSourceLabels } from "@learn-workbench/shared/labels";
import { formatRelativeTime } from "@learn-workbench/shared/dates";

/**
 * 招花 · 我的收藏（P3-3A）。
 *
 * 数据：GET /api/jobs/favorites?page=&pageSize=&sort=（登录用户分页）。
 * 交互：
 * - 点卡片进 /job-detail（详情页负责收藏/投递，回到本页时 useFocusRefresh 自动刷新）；
 * - 行内「取消收藏」走 POST /api/jobs/:id/favorite，本地先移除（乐观），失败回滚；
 * - 未登录 / 登录过期（401）/ 离线分别给三种可操作空态，不做静默空白。
 */

const PAGE_SIZE = 12;

export default function JobsFavoritesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((state) => state.token);

  const [jobs, setJobs] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"new" | "salary">("new");
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 401：登录过期与「从未登录」一样走登录引导，不显示成网络错误 */
  const [needLogin, setNeedLogin] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  /** 首帧的聚焦与 useEffect 首次加载重复，聚焦刷新从第二次进入开始 */
  const firstFocusRef = useRef(true);

  const load = useCallback(
    async (targetPage: number, mode: "initial" | "refresh" | "paging") => {
      if (!token) {
        setJobs([]);
        setTotal(0);
        setLoading(false);
        setError(null);
        setNeedLogin(true);
        return;
      }
      if (mode === "initial") setLoading(true);
      if (mode === "paging") setPaging(true);
      try {
        const data = await fetchFavoriteJobs({ page: targetPage, pageSize: PAGE_SIZE, sort });
        setJobs(data.jobs);
        setTotal(data.total);
        setPage(data.page);
        setError(null);
        setNeedLogin(false);
      } catch (e) {
        if (e instanceof JobApiError && e.status === 401) {
          setNeedLogin(true);
          setJobs([]);
          setTotal(0);
          setError(null);
        } else {
          setError(e instanceof Error ? e.message : "收藏列表加载失败");
        }
      } finally {
        setLoading(false);
        setPaging(false);
      }
    },
    [token, sort],
  );

  // 登录态 / 排序变化时从第 1 页重取
  useEffect(() => {
    void load(1, "initial");
  }, [load]);

  // 从详情页（可能刚取消收藏或投递）回到本页时刷新当前页
  useFocusRefresh(
    useCallback(() => {
      if (firstFocusRef.current) {
        firstFocusRef.current = false;
        return;
      }
      void load(page, "refresh");
    }, [load, page]),
  );

  const { control: pullControl } = usePullRefresh(() => load(page, "refresh"));

  const openDetail = (job: JobPostingListItem) => {
    haptics.light();
    router.push(("/job-detail?id=" + encodeURIComponent(job.id)) as never);
  };

  const removeFavorite = async (job: JobPostingListItem) => {
    if (removingId) return;
    const snapshotJobs = jobs;
    const snapshotTotal = total;
    setRemovingId(job.id);
    setJobs((previous) => previous.filter((item) => item.id !== job.id));
    setTotal((previous) => Math.max(0, previous - 1));
    haptics.soft();
    try {
      const favorited = await toggleJobFavorite(job.id);
      if (favorited) {
        // 服务端仍是已收藏（并发/状态漂移）：回滚并重新对齐
        setJobs(snapshotJobs);
        setTotal(snapshotTotal);
        void load(page, "refresh");
        return;
      }
      // 当前页被清空时退回上一页，避免停在空白页
      if (snapshotJobs.length === 1) void load(page > 1 ? page - 1 : 1, "initial");
      else void load(page, "refresh");
    } catch (e) {
      setJobs(snapshotJobs);
      setTotal(snapshotTotal);
      Alert.alert("取消收藏失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setRemovingId(null);
    }
  };

  const changeSort = (next: "new" | "salary") => {
    if (next === sort) return;
    haptics.soft();
    setSort(next);
    setPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderItem = ({ item }: { item: JobPostingListItem }) => {
    const meta = [
      item.company,
      item.city || "城市不限",
      item.experience || "经验不限",
      item.education || "学历不限",
    ]
      .filter(Boolean)
      .join(" · ");
    return (
      <Card style={styles.card}>
        <View style={styles.cardRow}>
          {/* 卡片主体：进详情 */}
          <Pressable
            onPress={() => openDetail(item)}
            style={({ pressed }) => [styles.cardMain, pressed ? styles.cardPressed : null]}
            accessibilityRole="button"
            accessibilityLabel={"查看岗位详情：" + item.title}
          >
            <View style={styles.cardTop}>
              <View style={[styles.logo, { backgroundColor: avatarColorOf(item.id) }]}>
                <Text style={styles.logoText}>{item.company.trim().charAt(0).toUpperCase() || "公"}</Text>
              </View>
              <View style={styles.cardTitleBox}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.salary} numberOfLines={1}>
                    {jobSalaryText(item)}
                  </Text>
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {meta}
                </Text>
              </View>
            </View>
            <View style={styles.footRow}>
              <JobSourceBadge source={item.source} label={jobSourceLabels[item.source] ?? item.source} />
              <Text style={styles.time} numberOfLines={1}>
                {formatRelativeTime(item.publishedAt)}
              </Text>
            </View>
          </Pressable>

          {/* 行内取消收藏：与卡片主体分开，避免误触进详情 */}
          <PressableScale
            hitSlop={8}
            disabled={removingId === item.id}
            onPress={() => void removeFavorite(item)}
            style={styles.removeButton}
            accessibilityRole="button"
            accessibilityLabel={"取消收藏：" + item.title}
          >
            <ThemedIcon name="heart" size={19} color={colors.danger} />
            <Text style={styles.removeText}>
              {removingId === item.id ? "取消中" : "取消收藏"}
            </Text>
          </PressableScale>
        </View>
      </Card>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyBox}>
          <SkeletonList count={4} />
        </View>
      );
    }
    if (needLogin) {
      return (
        <EmptyState
          icon="lock-closed-outline"
          title="登录后查看我的收藏"
          hint="收藏的岗位会集中在这里，点开即可投递并跟进进度。"
          actionLabel="去登录"
          onAction={() => router.push("/settings" as never)}
          pattern="none"
        />
      );
    }
    if (error) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="收藏列表加载失败"
          hint={error}
          actionLabel="重新加载"
          onAction={() => void load(1, "initial")}
          pattern="none"
        />
      );
    }
    return (
      <EmptyState
        icon="heart-outline"
        title="还没有收藏岗位"
        hint="在招花列表点爱心收藏，随时回到这里投递。"
        actionLabel="去招花看看"
        onAction={() => router.replace("/jobs" as never)}
        pattern="none"
      />
    );
  };

  return (
    <View style={styles.root}>
      {/* 吸顶栏放在列表外；大标题随内容滚走 */}
      <ScreenHeaderStickyBar title="我的收藏" backTo="/jobs" />
      {/* ⚠️ 普通 FlatList 必须用 onScrollJS（Reanimated 的 onScroll 是事件对象，不能被当函数调用） */}
      <FlatList
        onScroll={headerScroll.onScrollJS}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl {...pullControl} />}
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + spacing.lg }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeaderLargeTitle
              title="我的收藏"
              subtitle={total > 0 ? "共 " + total + " 个收藏岗位 · 点开即可投递" : "收藏的岗位会集中在这里，点开即可投递"}
            />
            <View style={styles.sortRow}>
              <SortChip label="最近收藏" active={sort === "new"} onPress={() => changeSort("new")} />
              <SortChip label="薪资优先" active={sort === "salary"} onPress={() => changeSort("salary")} />
            </View>
          </View>
        }
        ListEmptyComponent={renderEmpty()}
        ListFooterComponent={
          jobs.length > 0 ? (
            <PagerBar
              page={page - 1}
              pageCount={pageCount}
              from={(page - 1) * PAGE_SIZE + 1}
              to={Math.min(total, page * PAGE_SIZE)}
              total={total}
              unit="个"
              loading={paging}
              onPageChange={(next) => {
                if (next + 1 === page) return;
                void load(next + 1, "paging");
              }}
              style={styles.pager}
            />
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/** 排序胶囊：与招花列表筛选 chips 同款外观（本页只有两态，不做弹层） */
function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <PressableScale
      hitSlop={6}
      onPress={onPress}
      style={[styles.sortChip, active ? styles.sortChipActive : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={"按" + label + "排序"}
    >
      <ThemedIcon
        name={label === "薪资优先" ? "swap-vertical" : "time-outline"}
        size={14}
        color={active ? "#FFFFFF" : colors.textSecondary}
      />
      <Text style={active ? styles.sortChipTextActive : styles.sortChipText}>{label}</Text>
    </PressableScale>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
    header: { gap: spacing.sm, paddingBottom: spacing.md },
    sortRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    sortChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 44,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sortChipText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
    sortChipTextActive: { ...typography.caption, fontWeight: "800", color: "#FFFFFF" },

    card: { padding: spacing.md, marginBottom: spacing.md },
    cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cardMain: { flex: 1, minWidth: 0, gap: spacing.sm },
    /** 列表项子树零 Reanimated：按压反馈用静态缩放/透明度（踩坑 92 同一收口原则） */
    cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
    cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    logo: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: { ...typography.callout, fontWeight: "800", color: "#FFFFFF" },
    cardTitleBox: { flex: 1, minWidth: 0, gap: 3 },
    titleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
    title: { ...typography.callout, fontWeight: "800", color: colors.text, flex: 1 },
    salary: { ...typography.callout, fontWeight: "900", color: colors.accentStrong },
    meta: { ...typography.micro, fontWeight: "400", color: colors.textSecondary },
    footRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    time: { ...typography.micro, fontWeight: "400", color: colors.textFaint, flex: 1, textAlign: "right" },
    removeButton: {
      minHeight: 44,
      minWidth: 44,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: radius.md,
      backgroundColor: colors.dangerSoft,
      paddingHorizontal: spacing.sm,
    },
    removeText: { ...typography.micro, fontWeight: "800", color: colors.danger },

    emptyBox: { paddingVertical: spacing.xl },
    pager: { paddingTop: spacing.sm },
  });
