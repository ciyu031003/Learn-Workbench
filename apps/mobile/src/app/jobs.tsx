/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  useLargeTitleHeader,
} from "@/components/screen-header";
import { SkeletonList } from "@/components/skeleton";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import Animated, {
  cancelAnimation,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSearchField, SheetSection, SheetSegmented, SheetStickyCta } from "@/components/sheet";
import { JobDetailModal } from "@/components/job-detail-modal";
import { PressableScale } from "@/components/pressable-scale";
import { PagerBar } from "@/components/pager-bar";
import { StatRow } from "@/components/stat";
import { JobFreshnessBadge, JobNewBadge, JobSourceBadge, avatarColorOf, jobSalaryText } from "@/components/job-bits";
import { haptics } from "@/lib/haptics";
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
import { formatRelativeTime, jobSourceLabels, type JobPostingListItem, type JobSource, type JobStats } from "@learn-workbench/shared";

const PAGE_SIZE = 12;
const CITY_OPTIONS = ["全部", "上海", "北京", "深圳", "杭州", "成都", "广州", "乌鲁木齐"];
const CATEGORY_OPTIONS = [
  { id: "", label: "全部" },
  { id: "internet", label: "互联网" },
  { id: "gongkao,gongbian", label: "考公考编" },
  { id: "yangqi", label: "央国企" },
];
// v20-J1：平台来源色 / 头像底色 / 薪资文案 / 鲜度与 NEW 徽章已收进 components/job-bits.tsx 单源。

function JobCard({
  job,
  onPress,
  onToggleFavorite,
}: {
  job: JobPostingListItem;
  onPress: (job: JobPostingListItem) => void;
  onToggleFavorite: (job: JobPostingListItem) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  /**
   * v19-S1（真机闪退同源修复）：**FlashList item 上不允许任何依赖 index 的入场动画**。
   * 上一版用 useEffect([index]) 驱动透明度/位移，item 回收复用拿到新 index 就会重放，
   * 滚动全程反复触发 UI 线程动画；更早的 entering 版本则在原生层直接崩溃（踩坑 64422a9）。
   * 结论：虚拟化列表只保留**按压反馈**（scale），入场交给骨架屏与分页加载的既有节奏。
   */
  /**
   * 真机闪退修复（第三次，这次是列表项本身）：
   * 虚拟化列表项里**不跑任何 Reanimated 动画**。
   * 此前这里用 Animated.View + heartScale 弹簧，由 useEffect 在 item **挂载时**启动 ——
   * FlashList 滚动会不断回收并重挂 item，等于**滚动全程反复在 UI 线程启动弹簧动画**，
   * 原生层崩溃（与历史上 entering 让列表崩掉同一类问题，见踩坑 64422a9 / v19-S1）。
   * 收藏态改由颜色表达（danger / textFaint），按压反馈交给外层 PressableScale。
   */
  const heartColor = job.isFav ? colors.danger : colors.textFaint;

  return (
    <PressableScale onPress={() => onPress(job)} scaleTo={0.97} style={styles.jobCard}>
      <View style={styles.jobTop}>
        <View style={[styles.logo, { backgroundColor: avatarColorOf(job.id) }]}>
          <Text style={styles.logoText}>{job.company.trim().charAt(0).toUpperCase() || "公"}</Text>
        </View>
        <View style={styles.jobMain}>
          <View style={styles.titleRow}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {job.title}
            </Text>
            {job.channel === "announcement" ? <Text style={styles.announceBadge}>公告</Text> : null}
            {job.isNew ? <JobNewBadge /> : null}
          </View>
          <Text style={styles.salary}>{jobSalaryText(job)}</Text>
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
        <JobSourceBadge source={job.source} label={jobSourceLabels[job.source]} />
        {job.channel !== "announcement" ? (
          <JobFreshnessBadge
            publishedAt={job.publishedAt ?? null}
            fetchedAt={job.fetchedAt}
            deadlineAt={job.deadlineAt ?? null}
          />
        ) : null}
        {job.clusterSources && job.clusterSources.length > 1 ? (
          <Text style={styles.clusterText} numberOfLines={1}>
            🔁 {job.clusterSources.map((s) => jobSourceLabels[s] ?? s).join("/")}
          </Text>
        ) : null}
        <Text style={styles.time}>{formatRelativeTime(job.publishedAt)}</Text>
        <PressableScale hitSlop={10} onPress={() => onToggleFavorite(job)}>
          {/* v19-M7：心形色收进主题 token（danger=收藏 / textFaint=未收藏）；此处不做动画（见上方说明） */}
          <ThemedIcon name={job.isFav ? "heart" : "heart-outline"} size={18} color={heartColor} />
        </PressableScale>
        <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
    </PressableScale>
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

/** v20-A2：筛选刷新细进度条——筛选/排序期间**保留旧列表**，只在列表顶部脉冲一根 2pt 主色条 */
function FilterRefreshBar() {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0.35, { duration: 380 })), -1, true);
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);
  const bar = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(150)}
      style={[{ height: 2, borderRadius: 1, backgroundColor: colors.primary, marginBottom: 8 }, bar]}
    />
  );
}

/** v20-A5：搜索行独立组件——输入态内聚，打字不再整列表头重渲染 */
function JobsSearchRow({
  filterActive,
  onOpenFilter,
  onSearch,
}: {
  filterActive: boolean;
  onOpenFilter: () => void;
  onSearch: (q: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState("");
  return (
    <View style={styles.searchRow}>
      <SheetSearchField
        value={text}
        onChangeText={setText}
        placeholder="搜索职位 / 公司 / 技能"
        autoCapitalize="none"
        onSubmit={() => onSearch(text.trim())}
        onClear={() => onSearch("")}
        style={{ flex: 1 }}
      />
      <PressableScale
        style={[styles.filterBtn, filterActive ? styles.filterBtnActive : null]}
        scaleTo={0.92}
        onPress={onOpenFilter}
        accessibilityLabel="高级筛选"
      >
        <ThemedIcon name="options-outline" size={18} color={filterActive ? "#ffffff" : colors.primary} />
      </PressableScale>
    </View>
  );
}

/** 回显 chip 的视图模型（v20-A1） */
export interface JobFilterChipVM {
  key: string;
  label: string;
  onRemove: () => void;
}

/** v20-A5：列表头独立组件（FlashList ListHeaderComponent 传**组件类型**，避免闭包每次换身份） */
function JobsListHeader({
  stats,
  category,
  city,
  cityExpand,
  sort,
  filterChips,
  hasActiveFilter,
  filterRefreshing,
  onCategory,
  onCity,
  onCityExpand,
  onSort,
  onRemoveFilter,
  onClearFilters,
  onOpenFilter,
  onSearch,
}: {
  stats: JobStats | null;
  category: string;
  city: string;
  cityExpand: boolean;
  sort: "new" | "salary";
  filterChips: JobFilterChipVM[];
  hasActiveFilter: boolean;
  filterRefreshing: boolean;
  onCategory: (id: string) => void;
  onCity: (city: string) => void;
  onCityExpand: () => void;
  onSort: (s: "new" | "salary") => void;
  onRemoveFilter: (key: string) => void;
  onClearFilters: () => void;
  onOpenFilter: () => void;
  onSearch: (q: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.listSide}>
      {/* v17-C2b：大标题留在滚动内容【内】随内容滚走；紧凑栏在 FlashList【外】真吸顶 */}
      <ScreenHeaderLargeTitle title="招花" subtitle="让每一次机会，都像花一样准时绽放" />

      {filterRefreshing ? <FilterRefreshBar /> : null}

      {/* v20-A3：统计三卡收成一行 StatRow（首屏让位给职位卡；v20-J3 数字滚动内建） */}
      <StatRow
        style={styles.statsRow}
        items={
          stats
            ? [
                { key: "new", value: stats.todayNew, label: "今日新增" },
                { key: "total", value: stats.total, label: "在库职位" },
                { key: "platforms", value: stats.platformCount, label: "覆盖平台" },
              ]
            : []
        }
      />

      <JobsSearchRow filterActive={hasActiveFilter} onOpenFilter={onOpenFilter} onSearch={onSearch} />

      {/* v20-A1：当前筛选条件回显（单项可移除 + 一键清空），兑现筛选弹层副标题的承诺 */}
      {filterChips.length > 0 ? (
        <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.echoRow}>
          {filterChips.map((chip) => (
            <PressableScale
              key={chip.key}
              scaleTo={0.94}
              style={styles.echoChip}
              onPress={() => {
                haptics.warning();
                onRemoveFilter(chip.key);
              }}
              accessibilityLabel={`移除筛选条件 ${chip.label}`}
            >
              <Text style={styles.echoChipText} numberOfLines={1}>
                {chip.label}
              </Text>
              <ThemedIcon name="close" size={13} color={colors.textSecondary} />
            </PressableScale>
          ))}
          <PressableScale scaleTo={0.94} style={styles.echoClear} onPress={onClearFilters} accessibilityLabel="清空全部筛选">
            <Text style={styles.echoClearText}>清空</Text>
          </PressableScale>
        </Animated.ScrollView>
      ) : null}

      <View style={styles.catRow}>
        {CATEGORY_OPTIONS.map((c) => {
          const active = category === c.id || (c.id === "" && category === "");
          return (
            <PressableScale
              key={c.id || "all"}
              scaleTo={0.94}
              style={[styles.catChip, active ? styles.catChipActive : styles.catChipIdle]}
              onPress={() => {
                haptics.soft();
                onCategory(c.id);
              }}
            >
              <Text style={active ? styles.catChipTextActive : styles.catChipTextIdle}>{c.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View style={styles.chipsRow}>
        {(cityExpand ? CITY_OPTIONS : CITY_OPTIONS.slice(0, 5)).map((c) => {
          const active = city === c || (c === "全部" && city === "");
          return (
            <PressableScale
              key={c}
              scaleTo={0.94}
              style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
              onPress={() => {
                haptics.soft();
                onCity(c === "全部" ? "" : c);
              }}
            >
              <Text style={active ? styles.chipTextActive : styles.chipTextIdle}>{c}</Text>
            </PressableScale>
          );
        })}
        <PressableScale scaleTo={0.94} style={[styles.chip, styles.chipMore]} onPress={onCityExpand}>
          <ThemedIcon name={cityExpand ? "chevron-up" : "chevron-down"} size={14} color={colors.accentStrong} />
          <Text style={styles.chipMoreText}>{cityExpand ? "收起城市" : "更多城市"}</Text>
        </PressableScale>
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>排序</Text>
        {/* v20-A4：手写 seg 换 SheetSegmented（滑动指示器 + 触觉） */}
        <SheetSegmented
          options={[
            { key: "new", label: "最新" },
            { key: "salary", label: "薪资" },
          ]}
          value={sort}
          onChange={(k) => onSort(k as "new" | "salary")}
        />
      </View>
    </View>
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
  /** v17-D（R8）：入场错峰；减弱动态时不做（任务纪律：每屏封顶 12 项、只在首帧入场） */
  const tabBarSpace = useTabBarSpace();
  // v17-C2b：吸顶紧凑栏的滚动驱动（下拉刷新偏移已由 usePullRefresh 统一计算）
  const headerScroll = useLargeTitleHeader();
  const token = useAppStore((s) => s.token);

  const [jobs, setJobs] = useState<JobPostingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [filterRefreshing, setFilterRefreshing] = useState(false);
  const [paging, setPaging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedId) ?? null, [jobs, selectedId]);
  const listRef = useRef<FlashListRef<JobPostingListItem>>(null);
  const hasActiveFilter =
    salaryMin != null || salaryMax != null || education.length > 0 || experience.length > 0 || publishedWithin !== "" || skillsFilter.length > 0;

  const loadJobs = useCallback(
    async (pageNumber: number, mode: "initial" | "refresh" | "paging" | "filters") => {
      if (mode === "initial") setInitialLoading(true);
      if (mode === "refresh") setRefreshing(true);
      if (mode === "paging") setPaging(true);
      if (mode === "filters") setFilterRefreshing(true);
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
        if (mode === "filters") setFilterRefreshing(false);
      }
    },
    [query, city, category, sort, salaryMin, salaryMax, education, experience, publishedWithin, skillsFilter]
  );

  /**
   * v20-A2：首次加载走骨架；之后的筛选/排序/分类变化**保留旧列表**（顶部细进度条），
   * 不再整列表换骨架闪屏。
   */
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    loadJobs(1, loadedOnceRef.current ? "filters" : "initial");
    loadedOnceRef.current = true;
  }, [loadJobs]);

  /** v20-A1：当前筛选条件的回显 chips（单项移除即触发 effect 自动重查） */
  const filterChips = useMemo<JobFilterChipVM[]>(() => {
    const chips: JobFilterChipVM[] = [];
    if (salaryMin != null || salaryMax != null) {
      const preset = SALARY_PRESETS.find((p) => p.min === salaryMin && p.max === salaryMax);
      const label =
        preset && preset.label !== "不限"
          ? preset.label
          : `${salaryMin ?? ""}-${salaryMax ?? ""}K`;
      chips.push({
        key: "salary",
        label: `薪资 ${label}`,
        onRemove: () => {
          setSalaryMin(null);
          setSalaryMax(null);
        },
      });
    }
    for (const e of education) {
      chips.push({ key: `edu-${e}`, label: e, onRemove: () => setEducation((p) => p.filter((x) => x !== e)) });
    }
    for (const e of experience) {
      chips.push({ key: `exp-${e}`, label: e, onRemove: () => setExperience((p) => p.filter((x) => x !== e)) });
    }
    if (publishedWithin) {
      const opt = PUBLISHED_OPTIONS.find((o) => o.value === publishedWithin);
      chips.push({ key: "published", label: opt?.label ?? "发布时间", onRemove: () => setPublishedWithin("") });
    }
    for (const s of skillsFilter) {
      chips.push({ key: `skill-${s}`, label: s, onRemove: () => setSkillsFilter((p) => p.filter((x) => x !== s)) });
    }
    return chips;
  }, [salaryMin, salaryMax, education, experience, publishedWithin, skillsFilter]);

  const removeFilterChip = useCallback((key: string) => {
    const chip = filterChips.find((c) => c.key === key);
    chip?.onRemove();
  }, [filterChips]);

  const clearFilterChips = useCallback(() => {
    setSalaryMin(null);
    setSalaryMax(null);
    setEducation([]);
    setExperience([]);
    setPublishedWithin("");
    setSkillsFilter([]);
  }, []);

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

  // v17/v18 收尾：下拉刷新统一走 usePullRefresh（吸顶栏存在 → 偏移自动 = insets.top + 44）
  const { control: pullControl } = usePullRefresh(refreshJobs, { stickyHeader: true });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goToPage = (next: number) => {
    if (next < 1 || next > totalPages || next === page || paging || initialLoading || refreshing) return;
    loadJobs(next, "paging");
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  // v20-B1：参数放宽为 { id }（详情弹层的种子入参也走同一条收藏链路）
  const toggleFavorite = async (job: { id: number }) => {
    if (!token) {
      Alert.alert("请先登录", "收藏功能需要登录后使用。");
      return;
    }
    try {
      const favorited = await toggleJobFavorite(job.id);
      // v19-M5：收藏语义化触觉（收藏成功 success / 取消 soft）
      if (favorited) haptics.success();
      else haptics.soft();
      setJobs((prev) => prev.map((x) => (x.id === job.id ? { ...x, isFav: favorited } : x)));
    } catch (e) {
      Alert.alert("收藏失败", e instanceof Error ? e.message : "请稍后重试");
    }
  };

  const openJob = (job: JobPostingListItem) => {
    haptics.light();
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

  // v20-A5：列表头收进 JobsListHeader 组件（搜索态内聚 + 传组件类型，输入不再整头重渲染）
  const header = (
    <JobsListHeader
      stats={stats}
      category={category}
      city={city}
      cityExpand={cityExpand}
      sort={sort}
      filterChips={filterChips}
      hasActiveFilter={hasActiveFilter}
      filterRefreshing={filterRefreshing}
      onCategory={setCategory}
      onCity={setCity}
      onCityExpand={() => setCityExpand((v) => !v)}
      onSort={setSort}
      onRemoveFilter={removeFilterChip}
      onClearFilters={clearFilterChips}
      onOpenFilter={() => setFilterVisible(true)}
      onSearch={setQuery}
    />
  );

  const renderPager = () => {
    if (initialLoading || jobs.length === 0) return null;
    return (
      <View style={styles.listSide}>
        {/* v20-J2：分页条收单源（0 基 API，jobs 1 基在此换算） */}
        <PagerBar
          page={page - 1}
          pageCount={totalPages}
          from={(page - 1) * PAGE_SIZE + 1}
          to={Math.min(total, page * PAGE_SIZE)}
          total={total}
          unit="个"
          loading={paging}
          onPageChange={(p) => goToPage(p + 1)}
        />
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
          所以 padding/gap 必须由 item wrapper、separator、header/footer 自己给（见 styles.listSide / CARD_SEP_STYLE）。 */}
      <FlashList
        ref={listRef}
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          /* 真机闪退修复：不要在 FlashList 的 item 上挂 Reanimated 的 entering 动画 ——
             v2 的 item 是绝对定位并会回收复用，回收发生在动画进行中时会在原生层崩
             （真机表现为「点开岗位详情后滑动列表就闪退」）。
             入场错峰只保留在非虚拟化列表（见 radar / interview）。 */
          <View style={styles.listSide}>
            <JobCard job={item} onPress={openJob} onToggleFavorite={toggleFavorite} />
          </View>
        )}
        ItemSeparatorComponent={JobCardSeparator}
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderPager}
        refreshControl={<RefreshControl {...pullControl} />}
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
        onApply={() => setFilterVisible(false)}
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
  statsRow: { marginBottom: 4 },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // v20-A1：当前筛选条件回显 chips
  echoRow: { gap: 8, paddingVertical: 2, alignItems: "center" },
  echoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
  },
  echoChipText: { ...typography.caption, color: colors.primary, maxWidth: 160 },
  echoClear: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
  },
  echoClearText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
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
  // v20-A6：三档 chip 字号收敛到 caption
  catChipTextActive: { color: "#ffffff", ...typography.caption, fontWeight: "800" },
  catChipTextIdle: { color: colors.textSecondary, ...typography.caption, fontWeight: "600" },
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
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipMoreText: { color: colors.accentStrong, ...typography.caption, fontWeight: "800" },
  chipTextActive: { color: "#ffffff", ...typography.caption, fontWeight: "700" },
  chipTextIdle: { color: colors.textSecondary, ...typography.caption, fontWeight: "600" },
  sortRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sortLabel: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
  jobCard: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 15,
    shadowColor: "#1C2430",
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
    shadowColor: "#1C2430",
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  logoText: { ...typography.headline, color: "#ffffff",  fontWeight: "800" },
  jobMain: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  jobTitle: { ...typography.headline, fontWeight: "800", flex: 1, color: colors.text },
  announceBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
  },
  salary: { ...typography.headline, fontWeight: "900", color: colors.accentStrong, letterSpacing: 0.2 },
  jobMeta: { ...typography.caption, fontWeight: "400", color: colors.textSecondary, marginTop: 1 },
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
  clusterText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "700",
    color: colors.lavender,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 4,
  },
  time: { flex: 1, marginLeft: "auto", fontSize: 11, color: colors.textFaint, textAlign: "right" },
  skeletonWrap: { paddingHorizontal: 16, paddingTop: 8 },
  // v20-J2：分页条与旧 sheet 样式已收进 components/pager-bar.tsx 与 sheet/*（v20-J1）；此处仅保留在用的表单件
  sheetReset: { fontSize: 13, fontWeight: "700", color: colors.primary },
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
});
