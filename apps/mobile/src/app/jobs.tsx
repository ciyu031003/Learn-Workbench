/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Card } from "@/components/card";
import { JobDetailModal } from "@/components/job-detail-modal";
import {
  fetchJobStats,
  fetchJobs,
  runCrawler as runCrawlerApi,
  toggleJobFavorite,
  type JobListResult,
} from "@/lib/jobs";
import { useAppStore } from "@/store/app-store";
import { formatRelativeTime, jobSourceLabels, type JobPostingListItem, type JobSource, type JobStats } from "@learn-workbench/shared";

const PAGE_SIZE = 20;
const CITY_OPTIONS = ["全部", "上海", "北京", "深圳", "杭州", "成都", "广州", "乌鲁木齐"];
const CATEGORY_OPTIONS = [
  { id: "", label: "全部" },
  { id: "internet", label: "互联网" },
  { id: "gongkao,gongbian", label: "考公考编" },
  { id: "yangqi", label: "央国企" },
];
const SOURCE_COLORS: Record<string, string> = {
  lagou: "#10b981",
  liepin: "#0ea5e9",
  zhilian: "#4f46e5",
  job51: "#f97316",
  boss: "#f43f5e",
};
const AVATAR_COLORS = ["#10b981", "#0ea5e9", "#8b5cf6", "#f97316", "#f43f5e", "#f59e0b"];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function salaryText(job: JobPostingListItem): string {
  if (job.salaryText) return job.salaryText;
  if (job.salaryMin != null && job.salaryMax != null) return job.salaryMin + "-" + job.salaryMax + "K";
  if (job.salaryMin != null) return job.salaryMin + "K 起";
  if (job.salaryMax != null) return "最高 " + job.salaryMax + "K";
  return "面议";
}

function ScalePressable({
  onPress,
  children,
  style,
  hitSlop,
  disabled,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: object;
  hitSlop?: number;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.92, { damping: 16, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 260 });
      }}
      hitSlop={hitSlop}
      disabled={disabled}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

function GearButton({ onPress }: { onPress: () => void }) {
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: rotate.value + "deg" }, { scale: scale.value }],
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        rotate.value = withTiming(-90, { duration: 180 });
        scale.value = withSpring(0.9, { damping: 14, stiffness: 260 });
      }}
      onPressOut={() => {
        rotate.value = withTiming(0, { duration: 180 });
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      }}
      style={[styles.gearBtn, animatedStyle]}
    >
      <Ionicons name="settings-outline" size={20} color="#ffffff" />
    </AnimatedPressable>
  );
}

function JobCard({
  job,
  index,
  onPress,
  onToggleFavorite,
}: {
  job: JobPostingListItem;
  index: number;
  onPress: (job: JobPostingListItem) => void;
  onToggleFavorite: (job: JobPostingListItem) => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withDelay(Math.min(index, 8) * 60, withTiming(1, { duration: 430 }));
    translateY.value = withDelay(Math.min(index, 8) * 60, withTiming(0, { duration: 430 }));
  }, [index, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => onPress(job)}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 240 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 240 });
      }}
      style={[styles.jobCard, animatedStyle]}
    >
      <View style={styles.jobTop}>
        <View style={[styles.logo, { backgroundColor: AVATAR_COLORS[job.id % AVATAR_COLORS.length] }]}>
          <Text style={styles.logoText}>{job.company.trim().charAt(0).toUpperCase() || "公"}</Text>
        </View>
        <View style={styles.jobMain}>
          <View style={styles.titleRow}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {job.title}
            </Text>
            {job.channel === "announcement" ? <Text style={styles.announceBadge}>公告</Text> : null}
            {job.isNew ? <Text style={styles.newBadge}>NEW</Text> : null}
          </View>
          <Text style={styles.salary}>{salaryText(job)}</Text>
          <Text style={styles.jobMeta} numberOfLines={1}>
            {job.company} · {job.city || "城市不限"} · {job.experience || "经验不限"} · {job.education || "学历不限"}
          </Text>
        </View>
      </View>

      {job.tags.length > 0 ? (
        <View style={styles.tags}>
          {job.tags.slice(0, 4).map((tag, tagIndex) => (
            <View key={tag + "-" + tagIndex} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.jobFoot}>
        <View style={styles.sourceBadge}>
          <View style={[styles.sourceDot, { backgroundColor: SOURCE_COLORS[job.source] }]} />
          <Text style={styles.sourceText}>{jobSourceLabels[job.source]}</Text>
        </View>
        <Text style={styles.time}>{formatRelativeTime(job.publishedAt)}</Text>
        <Pressable hitSlop={10} onPress={() => onToggleFavorite(job)}>
          <Ionicons name={job.isFav ? "heart" : "heart-outline"} size={18} color={job.isFav ? "#f43f5e" : "#8b8b94"} />
        </Pressable>
        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
      </View>
    </AnimatedPressable>
  );
}

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);

  const [jobs, setJobs] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"new" | "salary">("new");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedId) ?? null, [jobs, selectedId]);

  const loadJobs = useCallback(
    async (pageNumber: number, mode: "initial" | "refresh" | "more") => {
      if (mode === "initial") setInitialLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "more") setLoadingMore(true);
      try {
        const data: JobListResult = await fetchJobs({
          q: query,
          city,
          category: category || undefined,
          sort,
          page: pageNumber,
          pageSize: PAGE_SIZE,
        });
        if (mode === "more") {
          setJobs((prev) => {
            const map = new Map(prev.map((j) => [j.id, j]));
            data.jobs.forEach((j) => map.set(j.id, j));
            return Array.from(map.values());
          });
        } else {
          setJobs(data.jobs);
        }
        setTotal(data.total);
        setPage(data.page);
        setError(null);
      } catch (e) {
        if (mode !== "more") {
          setJobs([]);
          setError(e instanceof Error ? e.message : "职位列表加载失败");
        } else {
       
          setError(e instanceof Error ? e.message : "加载更多失败");
        }
      } finally {
        if (mode === "initial") setInitialLoading(false);
        if (mode === "refresh") setRefreshing(false);
        if (mode === "more") setLoadingMore(false);
      }
    },
    [query, city, category, sort]
  );

  useEffect(() => {
    loadJobs(1, "initial");
  }, [loadJobs]);

  useEffect(() => {
    let alive = true;
    fetchJobStats()
      .then((s) => {
        if (alive) setStats(s);
      })
      .catch(() => {
        // 统计接口失败时保留空态
      });
    return () => {
      alive = false;
    };
  }, []);

  const refreshJobs = useCallback(() => {
    loadJobs(1, "refresh");
  }, [loadJobs]);

  const loadMore = () => {
    if (initialLoading || loadingMore || refreshing) return;
    if (jobs.length >= total) return;
    loadJobs(page + 1, "more");
  };

  const toggleFavorite = async (job: JobPostingListItem) => {
    if (!token) {
      Alert.alert("请先登录", "收藏功能需要登录后使用。");
      return;
    }
    try {
      const favorited = await toggleJobFavorite(job.id);
      setJobs((prev) => prev.map((x) => (x.id === job.id ? { ...x, isFav: favorited } : x)));
    } catch (e) {
      Alert.alert("收藏失败", e instanceof Error ? e.message : "请稍后重试");
    }
  };

  const openJob = (job: JobPostingListItem) => {
    setSelectedId(job.id);
    setDetailVisible(true);
  };

  const runNow = async () => {
    if (!token) {
      Alert.alert("请先登录", "执行抓取任务需要先登录。");
      return;
    }
    setRunning(true);
    try {
      await runCrawlerApi();
      Alert.alert("已启动", "招聘爬虫任务已提交，稍后刷新即可看到最新职位。");
      await Promise.all([loadJobs(1, "refresh"), fetchJobStats().then(setStats).catch(() => {})]);
    } catch (e) {
      Alert.alert("启动失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setRunning(false);
    }
  };

  const renderEmpty = () => {
    if (initialLoading) {
      return (
        <View style={styles.emptyBox}>
          <ActivityIndicator color="#10b981" />
          <Text style={styles.emptyText}>正在等待花开...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyBox}>
          <Ionicons name="cloud-offline-outline" size={30} color="#9ca3af" />
          <Text style={styles.emptyText}>{error}</Text>
          <ScalePressable style={styles.emptyPrimaryBtn} onPress={() => loadJobs(1, "initial")}>
            <Text style={styles.emptyPrimaryText}>重新加载</Text>
          </ScalePressable>
        </View>
      );
    }
    return (
      <View style={styles.emptyBox}>
        <Ionicons name="flower-outline" size={34} color="#10b981" />
        <Text style={styles.emptyTitle}>还没有找到绽放的机会</Text>
        <Text style={styles.emptyText}>调整搜索条件，或立即抓取一次最新职位。</Text>
        <ScalePressable style={styles.emptyPrimaryBtn} onPress={runNow}>
          {running ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.emptyPrimaryText}>立即抓取</Text>}
        </ScalePressable>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      <View style={[styles.hero, { paddingTop: insets.top + 22 }]}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>招花</Text>
          <Text style={styles.heroSub}>让每一次机会，都像花一样准时绽放</Text>
        </View>
        <GearButton onPress={() => router.push("/settings")} />
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats ? stats.todayNew : "—"}</Text>
          <Text style={styles.statLabel}>今日新增</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats ? stats.total : "—"}</Text>
          <Text style={styles.statLabel}>在库职位</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{stats ? stats.platformCount : "—"}</Text>
          <Text style={styles.statLabel}>覆盖平台</Text>
        </Card>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="搜索职位 / 公司 / 技能"
          placeholderTextColor="#9ca3af"
          returnKeyType="search"
          onSubmitEditing={() => setQuery(searchInput.trim())}
          autoCapitalize="none"
        />
        {searchInput ? (
          <Pressable onPress={() => {
            setSearchInput("");
            setQuery("");
          }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.catRow}>
        {CATEGORY_OPTIONS.map((c) => {
          const active = category === c.id || (c.id === "" && category === "");
          return (
            <Pressable
              key={c.id || "all"}
              style={[styles.catChip, active ? styles.catChipActive : styles.catChipIdle]}
              onPress={() => {
                setCategory(c.id);
                setJobs([]);
              }}
            >
              <Text style={active ? styles.catChipTextActive : styles.catChipTextIdle}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.chipsRow}>
        {CITY_OPTIONS.map((c) => {
          const active = city === c || (c === "全部" && city === "");
          return (
            <Pressable
              key={c}
              style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
              onPress={() => setCity(c === "全部" ? "" : c)}
            >
              <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{c}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>排序</Text>
        <View style={styles.seg}>
          <Pressable style={[styles.segItem, sort === "new" ? styles.segItemActive : null]} onPress={() => setSort("new")}>
            <Text style={sort === "new" ? styles.segTextActive : styles.segText}>最新</Text>
          </Pressable>
          <Pressable style={[styles.segItem, sort === "salary" ? styles.segItemActive : null]} onPress={() => setSort("salary")}>
            <Text style={sort === "salary" ? styles.segTextActive : styles.segText}>薪资</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <JobCard job={item} index={index} onPress={openJob} onToggleFavorite={toggleFavorite} />
        )}
        contentContainerStyle={styles.content}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color="#10b981" />
              <Text style={styles.emptyText}>正在加载更多...</Text>
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshJobs}
            tintColor="#10b981"
            colors={["#10b981"]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <JobDetailModal
        job={selectedJob}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onToggleFavorite={toggleFavorite}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 6,
  },
  heroTextWrap: { flex: 1, gap: 4 },
  heroTitle: { color: "#34d399", fontSize: 30, fontWeight: "900", letterSpacing: 1 },
  heroSub: { color: "rgba(255,255,255,0.88)", fontSize: 13, lineHeight: 19 },
  gearBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.42)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, padding: 12, gap: 4 },
  statValue: { fontSize: 20, fontWeight: "900", color: "#18181b" },
  statLabel: { fontSize: 11, color: "#71717a", fontWeight: "700" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.80)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.70)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#18181b", padding: 0 },
  catRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  catChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  catChipActive: { backgroundColor: "#10b981" },
  catChipIdle: { backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.30)" },
  catChipTextActive: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  catChipTextIdle: { color: "#ffffff", fontSize: 13, fontWeight: "600" },
  chipsRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  chipActive: { backgroundColor: "#10b981" },
  chipIdle: { backgroundColor: "rgba(255,255,255,0.22)", borderWidth: 1, borderColor: "rgba(255,255,255,0.30)" },
  chipTextActive: { color: "#ffffff", fontSize: 12.5, fontWeight: "700" },
  chipTextIdle: { color: "#ffffff", fontSize: 12.5, fontWeight: "600" },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sortLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700" },
  seg: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 12, padding: 3 },
  segItem: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  segItemActive: { backgroundColor: "#10b981" },
  segText: { color: "rgba(255,255,255,0.78)", fontSize: 12.5, fontWeight: "700" },
  segTextActive: { color: "#ffffff", fontSize: 12.5, fontWeight: "800" },
  jobCard: {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: 20,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  jobTop: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  logoText: { color: "#ffffff", fontSize: 17, fontWeight: "800" },
  jobMain: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  jobTitle: { flex: 1, fontSize: 15.5, fontWeight: "800", color: "#18181b" },
  announceBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4f46e5",
    backgroundColor: "rgba(99,102,241,0.18)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.55)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  newBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    backgroundColor: "rgba(52,211,153,0.24)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.55)",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  salary: { fontSize: 16, fontWeight: "900", color: "#f97316", letterSpacing: 0.2 },
  jobMeta: { fontSize: 12, color: "#71717a", marginTop: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: {
    backgroundColor: "rgba(16,185,129,0.13)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.30)",
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, fontWeight: "700", color: "#047857" },
  jobFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(24,24,27,0.08)",
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(24,24,27,0.05)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourceText: { fontSize: 11, fontWeight: "700", color: "#52525b" },
  time: { flex: 1, marginLeft: "auto", fontSize: 11, color: "#9ca3af" },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  emptyText: { fontSize: 13, color: "rgba(255,255,255,0.78)", textAlign: "center", lineHeight: 19 },
  emptyPrimaryBtn: {
    marginTop: 6,
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  emptyPrimaryText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  footerLoading: { alignItems: "center", gap: 6, paddingVertical: 18 },
});
