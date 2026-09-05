/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { radius } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import {
  fetchJobStats,
  fetchJobs,
  runCrawler as runCrawlerApi,
  toggleJobFavorite,
  type JobListResult,
} from "@/lib/jobs";
import { useAppStore } from "@/store/app-store";
import { formatRelativeTime, jobFreshness, jobSourceLabels, type JobPostingListItem, type JobSource, type JobStats } from "@learn-workbench/shared";

const PAGE_SIZE = 12;
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
      <Ionicons name="settings-outline" size={20} color={colors.primary} />
    </AnimatedPressable>
  );
}

function FreshnessBadge({ job }: { job: JobPostingListItem }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const f = jobFreshness(
    job.publishedAt ?? null,
    job.fetchedAt,
    job.deadlineAt ?? null,
    job.channel === "announcement" ? "announcement" : "job"
  );
  const color =
    f.level === "just" || f.level === "within3"
      ? "#047857"
      : f.level === "within7"
        ? "#b45309"
        : f.level === "stale"
          ? "#b91c1c"
          : colors.textMuted;
  const bg =
    f.level === "just" || f.level === "within3"
      ? "rgba(16,185,129,0.14)"
      : f.level === "within7"
        ? "rgba(245,158,11,0.16)"
        : f.level === "stale"
          ? "rgba(239,68,68,0.14)"
          : "rgba(24,24,27,0.06)";
  return (
    <View style={[styles.freshBadge, { backgroundColor: bg }]}>
      <Text style={[styles.freshText, { color }]}>{f.emoji} {f.label}</Text>
    </View>
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        {job.channel !== "announcement" ? <FreshnessBadge job={job} /> : null}
        {job.clusterSources && job.clusterSources.length > 1 ? (
          <Text style={styles.clusterText} numberOfLines={1}>
            🔁 {job.clusterSources.map((s) => jobSourceLabels[s] ?? s).join("/")}
          </Text>
        ) : null}
        <Text style={styles.time}>{formatRelativeTime(job.publishedAt)}</Text>
        <Pressable hitSlop={10} onPress={() => onToggleFavorite(job)}>
          <Ionicons name={job.isFav ? "heart" : "heart-outline"} size={18} color={job.isFav ? "#f43f5e" : "#8b8b94"} />
        </Pressable>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
    </AnimatedPressable>
  );
}

const SALARY_PRESETS = [
  { label: "不限", min: null, max: null },
  { label: "10K 以下", min: null, max: 10 },
  { label: "10-20K", min: 10, max: 20 },
  { label: "20-30K", min: 20, max: 30 },
  { label: "30K 以上", min: 30, max: null },
] as const;
const EDU_OPTIONS = ["大专", "本科", "硕士", "博士"];
const EXP_OPTIONS = ["应届", "1-3年", "3-5年", "5-10年", "10年以上"];
const PUBLISHED_OPTIONS = [
  { value: "", label: "不限时间" },
  { value: "today", label: "今天" },
  { value: "3d", label: "3 天内" },
  { value: "7d", label: "7 天内" },
] as const;

function FilterBottomSheet({
  visible,
  city,
  salaryMin,
  salaryMax,
  education,
  experience,
  publishedWithin,
  skills,
  onSalary,
  onCity,
  onToggleEdu,
  onToggleExp,
  onPublished,
  onAddSkill,
  onRemoveSkill,
  onReset,
  onApply,
  onClose,
}: {
  visible: boolean;
  city: string;
  salaryMin: number | null;
  salaryMax: number | null;
  education: string[];
  experience: string[];
  publishedWithin: "" | "today" | "3d" | "7d";
  skills: string[];
  onSalary: (min: number | null, max: number | null) => void;
  onCity: (v: string) => void;
  onToggleEdu: (v: string) => void;
  onToggleExp: (v: string) => void;
  onPublished: (v: "" | "today" | "3d" | "7d") => void;
  onAddSkill: (v: string) => void;
  onRemoveSkill: (v: string) => void;
  onReset: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [draft, setDraft] = useState("");
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheetWrap}>
        <Card style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>高级筛选</Text>
            <Pressable onPress={onReset} hitSlop={8}>
              <Text style={styles.sheetReset}>重置</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: "62%" }} showsVerticalScrollIndicator={false}>
            <Text style={styles.filterGroupTitle}>薪资区间</Text>
            <View style={styles.chipWrap}>
              {SALARY_PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => onSalary(p.min, p.max)}
                  style={[styles.sheetChip, salaryMin === p.min && salaryMax === p.max ? styles.sheetChipActive : styles.sheetChipIdle]}
                >
                  <Text style={salaryMin === p.min && salaryMax === p.max ? styles.sheetChipTextActive : styles.sheetChipText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterGroupTitle}>城市</Text>
            <View style={styles.chipWrap}>
              {CITY_OPTIONS.map((c) => {
                const cVal = c === "全部" ? "" : c;
                const active = city === cVal;
                return (
                  <Pressable
                    key={c}
                    onPress={() => onCity(cVal)}
                    style={[styles.sheetChip, active ? styles.sheetChipActive : styles.sheetChipIdle]}
                  >
                    <Text style={active ? styles.sheetChipTextActive : styles.sheetChipText}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.filterGroupTitle}>学历</Text>
            <View style={styles.chipWrap}>
              {EDU_OPTIONS.map((e) => (
                <Pressable key={e} onPress={() => onToggleEdu(e)} style={[styles.sheetChip, education.includes(e) ? styles.sheetChipActive : styles.sheetChipIdle]}>
                  <Text style={education.includes(e) ? styles.sheetChipTextActive : styles.sheetChipText}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterGroupTitle}>经验</Text>
            <View style={styles.chipWrap}>
              {EXP_OPTIONS.map((e) => (
                <Pressable key={e} onPress={() => onToggleExp(e)} style={[styles.sheetChip, experience.includes(e) ? styles.sheetChipActive : styles.sheetChipIdle]}>
                  <Text style={experience.includes(e) ? styles.sheetChipTextActive : styles.sheetChipText}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterGroupTitle}>发布时间</Text>
            <View style={styles.chipWrap}>
              {PUBLISHED_OPTIONS.map((p) => (
                <Pressable key={p.value} onPress={() => onPublished(p.value as never)} style={[styles.sheetChip, publishedWithin === p.value ? styles.sheetChipActive : styles.sheetChipIdle]}>
                  <Text style={publishedWithin === p.value ? styles.sheetChipTextActive : styles.sheetChipText}>{p.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterGroupTitle}>技能标签</Text>
            <View style={styles.chipWrap}>
              {skills.map((s) => (
                <Pressable key={s} onPress={() => onRemoveSkill(s)} style={[styles.sheetChip, styles.sheetChipActive]}>
                  <Text style={styles.sheetChipTextActive}>{s} ✕</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.skillInputRow}>
              <TextInput
                style={styles.skillInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="输入技能后回车添加，如 Python"
                placeholderTextColor={colors.textFaint}
                returnKeyType="done"
                onSubmitEditing={() => {
                  const v = draft.trim();
                  if (v) onAddSkill(v);
                  setDraft("");
                }}
              />
              <Pressable
                style={styles.skillAddBtn}
                onPress={() => {
                  const v = draft.trim();
                  if (v) onAddSkill(v);
                  setDraft("");
                }}
              >
                <Text style={styles.skillAddText}>添加</Text>
              </Pressable>
            </View>
          </ScrollView>

          <Pressable style={styles.applyBtn} onPress={onApply}>
            <Text style={styles.applyText}>应用筛选</Text>
          </Pressable>
        </Card>
      </View>
    </Modal>
  );
}

export default function JobsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);

  const [jobs, setJobs] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [cityExpand, setCityExpand] = useState(false);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"new" | "salary">("new");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  // P1 多条件筛选（Bottom Sheet）
  const [filterVisible, setFilterVisible] = useState(false);
  const [salaryMin, setSalaryMin] = useState<number | null>(null);
  const [salaryMax, setSalaryMax] = useState<number | null>(null);
  const [education, setEducation] = useState<string[]>([]);
  const [experience, setExperience] = useState<string[]>([]);
  const [publishedWithin, setPublishedWithin] = useState<"" | "today" | "3d" | "7d">("");
  const [skillsFilter, setSkillsFilter] = useState<string[]>([]);
  const [skillDraft, setSkillDraft] = useState("");

  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedId) ?? null, [jobs, selectedId]);
  const listRef = useRef<FlatList<JobPostingListItem>>(null);
  const hasActiveFilter =
    salaryMin != null || salaryMax != null || education.length > 0 || experience.length > 0 || publishedWithin !== "" || skillsFilter.length > 0;

  const loadJobs = useCallback(
    async (pageNumber: number, mode: "initial" | "refresh" | "paging") => {
      if (mode === "initial") setInitialLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "paging") setPaging(true);
      try {
        const data: JobListResult = await fetchJobs({
          q: query,
          city,
          category: category || undefined,
          sort,
          page: pageNumber,
          pageSize: PAGE_SIZE,
          salaryMin: salaryMin ?? undefined,
          salaryMax: salaryMax ?? undefined,
          education: education.length > 0 ? education : undefined,
          experience: experience.length > 0 ? experience : undefined,
          publishedWithin: publishedWithin || undefined,
          skills: skillsFilter.length > 0 ? skillsFilter : undefined,
        });
        setJobs(data.jobs);
        setTotal(data.total);
        setPage(data.page);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "职位列表加载失败");
      } finally {
        if (mode === "initial") setInitialLoading(false);
        if (mode === "refresh") setRefreshing(false);
        if (mode === "paging") setPaging(false);
      }
    },
    [query, city, category, sort, salaryMin, salaryMax, education, experience, publishedWithin, skillsFilter]
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
  }, [token]);

  const refreshJobs = useCallback(() => {
    loadJobs(1, "refresh");
  }, [loadJobs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (next: number) => {
    if (next < 1 || next > totalPages || next === page || paging || initialLoading || refreshing) return;
    loadJobs(next, "paging");
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
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
          <Ionicons name="cloud-offline-outline" size={30} color={colors.textFaint} />
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

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            style={styles.searchInput}
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="搜索职位 / 公司 / 技能"
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            onSubmitEditing={() => setQuery(searchInput.trim())}
            autoCapitalize="none"
          />
          {searchInput ? (
            <Pressable onPress={() => {
              setSearchInput("");
              setQuery("");
            }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={[styles.filterBtn, hasActiveFilter ? styles.filterBtnActive : null]} onPress={() => setFilterVisible(true)}>
          <Ionicons name="options-outline" size={18} color={hasActiveFilter ? "#ffffff" : "#10b981"} />
        </Pressable>
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
        {(cityExpand ? CITY_OPTIONS : CITY_OPTIONS.slice(0, 5)).map((c) => {
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
        <Pressable
          style={[styles.chip, styles.chipMore]}
          onPress={() => setCityExpand((v) => !v)}
        >
          <Ionicons name={cityExpand ? "chevron-up" : "chevron-down"} size={14} color={colors.accentStrong} />
          <Text style={styles.chipMoreText}>
            {cityExpand ? "收起城市" : "更多城市"}
          </Text>
        </Pressable>
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

  const renderPager = () => {
    if (initialLoading || jobs.length === 0) return null;
    return (
      <View style={styles.pager}>
        <Pressable
          style={[styles.pagerBtn, (page <= 1 || paging) && styles.pagerBtnDisabled]}
          disabled={page <= 1 || paging}
          onPress={() => goToPage(page - 1)}
        >
          <Ionicons name="chevron-back" size={14} color={page <= 1 ? colors.textFaint : colors.primary} />
          <Text style={[styles.pagerBtnText, page <= 1 && styles.pagerBtnTextDisabled]}>上一页</Text>
        </Pressable>

        <View style={styles.pagerCenter}>
          {paging ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.pagerInfo}>第 {page} / {totalPages} 页</Text>
          )}
        </View>

        <Pressable
          style={[styles.pagerBtn, (page >= totalPages || paging) && styles.pagerBtnDisabled]}
          disabled={page >= totalPages || paging}
          onPress={() => goToPage(page + 1)}
        >
          <Text style={[styles.pagerBtnText, page >= totalPages && styles.pagerBtnTextDisabled]}>下一页</Text>
          <Ionicons name="chevron-forward" size={14} color={page >= totalPages ? colors.textFaint : colors.primary} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <JobCard job={item} index={index} onPress={openJob} onToggleFavorite={toggleFavorite} />
        )}
        contentContainerStyle={styles.content}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderPager}
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
      <FilterBottomSheet
        visible={filterVisible}
        city={city}
        salaryMin={salaryMin}
        salaryMax={salaryMax}
        education={education}
        experience={experience}
        publishedWithin={publishedWithin}
        skills={skillsFilter}
        onCity={setCity}
        onSalary={(min, max) => { setSalaryMin(min); setSalaryMax(max); }}
        onToggleEdu={(v) => setEducation((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
        onToggleExp={(v) => setExperience((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
        onPublished={(v) => setPublishedWithin(v)}
        onAddSkill={(v) => setSkillsFilter((prev) => (prev.includes(v) ? prev : [...prev, v]))}
        onRemoveSkill={(v) => setSkillsFilter((prev) => prev.filter((x) => x !== v))}
        onReset={() => {
          setSalaryMin(null); setSalaryMax(null);
          setEducation([]); setExperience([]);
          setPublishedWithin(""); setSkillsFilter([]);
        }}
        onApply={() => { setFilterVisible(false); loadJobs(1, "refresh"); }}
        onClose={() => setFilterVisible(false)}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 118, gap: 12 },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 6,
  },
  heroTextWrap: { flex: 1, gap: 4 },
  heroTitle: { color: colors.accent, fontSize: 30, fontWeight: "900", letterSpacing: 1 },
  heroSub: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  gearBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  statCard: { flex: 1, padding: 12, gap: 4 },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "700" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
  },
  filterBtnActive: { backgroundColor: colors.success },
  catRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  catChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  catChipActive: { backgroundColor: colors.success },
  catChipIdle: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border },
  catChipTextActive: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  catChipTextIdle: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 2 },
  chip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primary },
  chipIdle: { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border },
  chipMore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(242,140,40,0.32)",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipMoreText: { color: colors.accentStrong, fontSize: 12.5, fontWeight: "800" },
  chipTextActive: { color: "#ffffff", fontSize: 12.5, fontWeight: "700" },
  chipTextIdle: { color: colors.textMuted, fontSize: 12.5, fontWeight: "600" },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sortLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  seg: { flexDirection: "row", backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3 },
  segItem: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7 },
  segItemActive: { backgroundColor: colors.primary },
  segText: { color: colors.textMuted, fontSize: 12.5, fontWeight: "700" },
  segTextActive: { color: "#ffffff", fontSize: 12.5, fontWeight: "800" },
  jobCard: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
  jobTitle: { flex: 1, fontSize: 15.5, fontWeight: "800", color: colors.text },
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
  salary: { fontSize: 16, fontWeight: "900", color: colors.accentStrong, letterSpacing: 0.2 },
  jobMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: {
    backgroundColor: colors.successSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, fontWeight: "700", color: colors.success },
  jobFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourceText: { fontSize: 11, fontWeight: "700", color: colors.textMuted },
  freshBadge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 4,
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
    marginLeft: 4,
  },
  time: { flex: 1, marginLeft: "auto", fontSize: 11, color: colors.textFaint, textAlign: "right" },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
  emptyPrimaryBtn: {
    marginTop: 6,
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },
  emptyPrimaryText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  pager: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingVertical: 6,
  },
  pagerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    minWidth: 92,
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pagerBtnDisabled: { opacity: 0.45 },
  pagerBtnText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  pagerBtnTextDisabled: { color: colors.textMuted },
  pagerCenter: { alignItems: "center", justifyContent: "center", minWidth: 96 },
  pagerInfo: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  // ---- P1 筛选 Bottom Sheet ----
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 18, gap: 14, maxHeight: "80%" },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(24,24,27,0.15)", alignSelf: "center", marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  sheetReset: { fontSize: 13, fontWeight: "700", color: "#10b981" },
  filterGroupTitle: { fontSize: 13, fontWeight: "800", color: colors.text, marginTop: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sheetChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  sheetChipActive: { backgroundColor: "#10b981" },
  sheetChipIdle: { backgroundColor: "rgba(24,24,27,0.06)", borderWidth: 1, borderColor: "rgba(24,24,27,0.12)" },
  sheetChipText: { fontSize: 12.5, fontWeight: "700", color: colors.textMuted },
  sheetChipTextActive: { fontSize: 12.5, fontWeight: "800", color: "#ffffff" },
  skillInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  skillInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(24,24,27,0.05)",
    fontSize: 13,
    color: colors.text,
  },
  skillAddBtn: { backgroundColor: "#10b981", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  skillAddText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  applyBtn: {
    backgroundColor: "#10b981",
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
  },
  applyText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
});
