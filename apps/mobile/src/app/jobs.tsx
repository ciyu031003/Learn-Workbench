/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import {
  ScreenHeaderLargeTitle,
  ScreenHeaderStickyBar,
  useHeaderTopInset,
  useLargeTitleHeader,
} from "@/components/screen-header";
import { SkeletonList } from "@/components/skeleton";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSection, SheetStickyCta } from "@/components/sheet";
import { JobDetailModal } from "@/components/job-detail-modal";
import {  radius, typography  } from "@/theme/tokens";
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
// 平台来源色：**仅作图表语义色**用于 6px 小色点（sourceDot），不参与页面强调色（强调色一律 colors.primary）
const SOURCE_COLORS: Record<string, string> = {
  lagou: "#10b981",
  liepin: "#0ea5e9",
  zhilian: "#4f46e5",
  job51: "#f97316",
  boss: "#f43f5e",
};
// 头像底色：同上，只用于公司 logo 圆底（小面积）
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
          : colors.surfaceMuted;
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
          <ThemedIcon name={job.isFav ? "heart" : "heart-outline"} size={18} color={job.isFav ? "#f43f5e" : "#8b8b94"} />
        </Pressable>
        <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
    </AnimatedPressable>
  );
}

/**
 * 职位卡之间的间距。
 *
 * **为什么不用 `contentContainerStyle={{ gap }}`**：FlashList v2 的 item 是绝对定位渲染的
 * （内部 `ViewHolder` 用 `position:"absolute"` + `top: layout.y`），根本没有"内容容器"，
 * 因此 `contentContainerStyle` 的 `gap`/`padding` 会被整体丢弃 —— 这正是 v1.3.5 真机反馈的
 * "每张职位卡紧紧挨着、左右也没有留白"的根因。
 * v2 会渲染 `ItemSeparatorComponent`（最后一行之后自动跳过），所以间距走这里；
 * 样式用模块级常量，保证引用恒定，避免每次 render 触发 separator 重建。
 */
const CARD_SEP_STYLE = { height: 12 } as const;

function JobCardSeparator() {
  return <View style={CARD_SEP_STYLE} />;
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
  const salaryKey = SALARY_PRESETS.find((p) => p.min === salaryMin && p.max === salaryMax)?.label ?? "";
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="高级筛选"
      subtitle="可叠加多个条件；应用后列表顶部会显示当前条件"
      icon="options-outline"
      height="84%"
      headerAction={
        <Pressable onPress={onReset} hitSlop={8} accessibilityLabel="重置筛选">
          <Text style={styles.sheetReset}>重置</Text>
        </Pressable>
      }
      footer={
        <SheetStickyCta
          label="应用筛选"
          icon="checkmark"
          onPress={onApply}
          secondaryLabel="清空全部条件"
          onSecondary={onReset}
        />
      }
      footerHint="关闭不会清空已选条件，重新打开还在"
    >
            <SheetSection title="薪资区间">
              <ChipGroup
                multiple={false}
                wrap
                options={SALARY_PRESETS.map((p) => ({ key: p.label, label: p.label }))}
                selected={salaryKey ? [salaryKey] : []}
                onToggle={(k) => {
                  const p = SALARY_PRESETS.find((x) => x.label === k);
                  if (p) onSalary(p.min, p.max);
                }}
              />
            </SheetSection>

            <SheetSection title="城市">
              <ChipGroup
                multiple={false}
                wrap
                options={CITY_OPTIONS.map((c) => ({ key: c === "全部" ? "" : c, label: c }))}
                selected={[city]}
                onToggle={(k) => onCity(k)}
              />
            </SheetSection>

            <SheetSection title="学历" hint="可多选">
              <ChipGroup wrap options={EDU_OPTIONS.map((e) => ({ key: e, label: e }))} selected={education} onToggle={onToggleEdu} />
            </SheetSection>

            <SheetSection title="经验" hint="可多选">
              <ChipGroup wrap options={EXP_OPTIONS.map((e) => ({ key: e, label: e }))} selected={experience} onToggle={onToggleExp} />
            </SheetSection>

            <SheetSection title="发布时间">
              <ChipGroup
                multiple={false}
                wrap
                options={PUBLISHED_OPTIONS.map((p) => ({ key: p.value, label: p.label }))}
                selected={[publishedWithin]}
                onToggle={(k) => onPublished(k as never)}
              />
            </SheetSection>

            <SheetSection title="技能标签" hint="点标签可移除" last>
              {skills.length > 0 ? (
                <ChipGroup
                  wrap
                  options={skills.map((s) => ({ key: s, label: `${s} ✕` }))}
                  selected={skills}
                  onToggle={onRemoveSkill}
                />
              ) : null}
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
            </SheetSection>
    </BottomSheet>
  );
}

export default function JobsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarSpace = useTabBarSpace();
  // v17-C2b：吸顶紧凑栏的滚动驱动 + 吸顶栏占位（44pt 高，用于 RefreshControl 的 progressViewOffset）
  const headerScroll = useLargeTitleHeader();
  const headerTop = useHeaderTopInset();
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
  const listRef = useRef<FlashListRef<JobPostingListItem>>(null);
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
    // 首次加载：骨架屏（感知更快，避免空白等待）
    if (initialLoading) {
      return (
        <View style={styles.skeletonWrap}>
          <SkeletonList count={5} />
        </View>
      );
    }
    if (error) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          title="加载失败"
          hint={error}
          actionLabel="重新加载"
          onAction={() => loadJobs(1, "initial")}
        />
      );
    }
    return (
      <View style={styles.listSide}>
        <EmptyState
          icon="flower-outline"
          title="还没有找到绽放的机会"
          hint="调整搜索条件，或立即抓取一次最新职位。"
          actionLabel={running ? "抓取中…" : "立即抓取"}
          onAction={runNow}
        />
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.listSide}>
      {/* v17-C2b：大标题留在滚动内容【内】随内容滚走；紧凑栏在 FlashList【外】真吸顶。
          刻意不套 styles.hero —— 那是给紧凑栏用的 flexDirection:row 容器，会把块级大标题挤成内容宽、
          副标题不再换行（且它没有顶部 padding，所以移出来也不会出现双倍留白）。 */}
      <ScreenHeaderLargeTitle title="招花" subtitle="让每一次机会，都像花一样准时绽放" />

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
          <ThemedIcon name="search" size={18} color={colors.textFaint} />
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
              <ThemedIcon name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={[styles.filterBtn, hasActiveFilter ? styles.filterBtnActive : null]} onPress={() => setFilterVisible(true)}>
          <ThemedIcon name="options-outline" size={18} color={hasActiveFilter ? "#ffffff" : colors.primary} />
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
          <ThemedIcon name={cityExpand ? "chevron-up" : "chevron-down"} size={14} color={colors.accentStrong} />
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
      <View style={[styles.pager, styles.listSide]}>
        <Pressable
          style={[styles.pagerBtn, (page <= 1 || paging) && styles.pagerBtnDisabled]}
          disabled={page <= 1 || paging}
          onPress={() => goToPage(page - 1)}
        >
          <ThemedIcon name="chevron-back" size={14} color={page <= 1 ? colors.textFaint : colors.primary} />
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
          <ThemedIcon name="chevron-forward" size={14} color={page >= totalPages ? colors.textFaint : colors.primary} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* v17-C2b（真吸顶）：紧凑栏必须是滚动容器**之外**的兄弟节点；组件内部已绝对定位在状态栏下方
          一行高度，且 pointerEvents 穿透（空白处手势落到下方列表），不会变成全屏覆盖层。 */}
      <ScreenHeaderStickyBar title="招花" backTo="/career" scrollY={headerScroll.scrollY} />
      {/* FlashList：职位列表可达数百条，回收式虚拟化（D3）；未提供 estimatedItemSize —— v2 自动测量
          注意：**FlashList v2 不消费 contentContainerStyle**（内部把 items 绝对定位，没有内容容器），
          所以 padding/gap 必须由 item wrapper、separator、header/footer 自己给（见 styles.listSide / cardSep）。 */}
      <FlashList
        ref={listRef}
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <View style={styles.listSide}>
            <JobCard job={item} index={index} onPress={openJob} onToggleFavorite={toggleFavorite} />
          </View>
        )}
        ItemSeparatorComponent={JobCardSeparator}
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderPager}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshJobs}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surfaceStrong}
            // 吸顶栏高 44 + 状态栏：不加偏移时下拉转圈会出现在吸顶栏底下被盖住
            progressViewOffset={headerTop + 44}
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
  /** 列表左右留白：FlashList v2 忽略 contentContainerStyle 的 padding，必须逐处显式给 */
  listSide: { paddingHorizontal: 16 },
  cardSep: { height: 12 },
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
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  filterBtnActive: { backgroundColor: colors.primary },
  catRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  catChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  catChipActive: { backgroundColor: colors.primary },
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
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, fontWeight: "700", color: colors.primary },
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
  skeletonWrap: { paddingHorizontal: 16, paddingTop: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
  emptyPrimaryBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
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
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: {
    ...typography.title2,
    color: colors.text,
  },
  sheetReset: { fontSize: 13, fontWeight: "700", color: colors.primary },
  filterGroupTitle: { fontSize: 13, fontWeight: "800", color: colors.text, marginTop: 4 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sheetChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  sheetChipActive: { backgroundColor: colors.primary },
  sheetChipIdle: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderStrong },
  sheetChipText: { fontSize: 12.5, fontWeight: "700", color: colors.textMuted },
  sheetChipTextActive: { fontSize: 12.5, fontWeight: "800", color: "#ffffff" },
  skillInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  skillInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
    fontSize: 13,
    color: colors.text,
  },
  skillAddBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  skillAddText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
  },
  applyText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
});
