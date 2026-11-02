/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { recordCrumb } from "@/lib/crash-capture";
import { FilterRefreshBar } from "@/components/filter-refresh-bar";
import { BottomSheet } from "@/components/bottom-sheet";
import { ChipGroup, SheetSearchField, SheetSection, SheetStickyCta } from "@/components/sheet";
import { JobDetailModal } from "@/components/job-detail-modal";
import { PressableScale } from "@/components/pressable-scale";
import { PagerBar } from "@/components/pager-bar";
import { JobNewBadge, JobSourceBadge, avatarColorOf, jobSalaryText } from "@/components/job-bits";
import { haptics } from "@/lib/haptics";
import { typography } from "@/theme/tokens";
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
import type { JobPostingListItem, JobStats } from "@learn-workbench/shared/schemas";
import {
  HOT_CITIES,
  PROVINCE_CITIES,
  cityProvinceLabel,
  getCitiesOfProvince,
  jobSourceLabels,
} from "@learn-workbench/shared/labels";
import { formatRelativeTime } from "@learn-workbench/shared/dates";

const PAGE_SIZE = 12;
/**
 * P13（2026-11）：城市筛选改「省份 → 城市」二级。
 * 一级 chip 用 shared 的 PROVINCE_CITIES（含直辖市「北京市」），二级 chip 只显示选中省的城市；
 * 「热门」是一级里的虚拟分组，内容来自 shared 的 HOT_CITIES —— 不再有「更多城市」把 40 个城市一锅端。
 */
const HOT_PROVINCE_KEY = "__hot__";
const CATEGORY_OPTIONS = [
  { id: "", label: "全部" },
  { id: "internet", label: "互联网" },
  { id: "gongkao,gongbian", label: "考公考编" },
  { id: "yangqi", label: "央国企" },
];
// v20-J1：平台来源色 / 头像底色 / 薪资文案 / 鲜度与 NEW 徽章已收进 components/job-bits.tsx 单源。

/**
 * P1-2（v1.62）：压缩版岗位卡，目标高度 ≤132pt（实测约 96pt）。
 *
 * 三层信息：① 岗位名（单行）+ 右对齐薪资；② 公司 · 城市 · 经验 · 学历（单行省略）；
 * ③ 来源 / NEW 或公告 / 最多 2 个标签 + 弱化的更新时间 + 收藏。Logo 缩到 40，
 * 去掉底部分隔上边框、「多平台合并来源」串等二次元信息（详情弹层里仍有）。
 *
 * 硬约束（勿改，见踩坑 92 / v19-S1 / v1.32.0）：FlashList item 子树内**不允许任何
 * Reanimated 组件或动画**——按压反馈只用 Pressable 的 pressed 静态样式（transform/opacity），
 * 也不许出现依赖 index 的入场动画。
 */
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
  const heartColor = job.isFav ? colors.danger : colors.textFaint;
  const tags = job.tags.slice(0, 2);
  const isAnnouncement = job.channel === "announcement";

  return (
    <Pressable
      onPress={() => onPress(job)}
      style={({ pressed }) => [styles.jobCard, pressed ? styles.jobCardPressed : null]}
    >
      <View style={styles.jobTop}>
        <View style={[styles.logo, { backgroundColor: avatarColorOf(job.id) }]}>
          <Text style={styles.logoText}>{job.company.trim().charAt(0).toUpperCase() || "公"}</Text>
        </View>
        <View style={styles.jobMain}>
          <View style={styles.titleRow}>
            <Text style={styles.jobTitle} numberOfLines={1}>
              {job.title}
            </Text>
            <Text style={styles.salary} numberOfLines={1}>
              {jobSalaryText(job)}
            </Text>
          </View>
          <Text style={styles.jobMeta} numberOfLines={1}>
            {job.company} · {job.city || "城市不限"} · {job.experience || "经验不限"} · {job.education || "学历不限"}
          </Text>
        </View>
      </View>

      <View style={styles.jobFoot}>
        <View style={styles.footTags}>
          <JobSourceBadge source={job.source} label={jobSourceLabels[job.source]} />
          {isAnnouncement ? (
            <Text style={styles.footFlag}>公告</Text>
          ) : job.isNew ? (
            <JobNewBadge />
          ) : null}
          {tags.map((tag, tagIndex) => (
            <View key={tag + "-" + tagIndex} style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.time} numberOfLines={1}>
          {formatRelativeTime(job.publishedAt)}
        </Text>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={job.isFav ? "取消收藏" : "收藏该岗位"}
          accessibilityState={{ selected: job.isFav }}
          onPress={() => onToggleFavorite(job)}
          style={({ pressed }) => (pressed ? styles.pressedFaint : null)}
        >
          {/* v19-M7：心形色收进主题 token（danger=收藏 / textFaint=未收藏）；此处不做动画 */}
          <ThemedIcon name={job.isFav ? "heart" : "heart-outline"} size={18} color={heartColor} />
        </Pressable>
      </View>
    </Pressable>
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
 * P1-2：间距 12 → 10，配合压缩卡把首屏铺到 ≥5 条。
 */
const CARD_SEP_STYLE = { height: 10 } as const;

function JobCardSeparator() {
  return <View style={CARD_SEP_STYLE} />;
}

/** v20-A5：搜索行独立组件——输入态内聚，打字不再整列表头重渲染。P1-2：收起筛选按钮，筛选统一走下方一行 chips */
function JobsSearchRow({ onSearch }: { onSearch: (q: string) => void }) {
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
    </View>
  );
}

/** P1-2：一级筛选 chips 的单枚外观（城市 / 方向 / 排序 / 更多筛选共用） */
function FilterBarChip({
  label,
  icon,
  ios,
  active,
  badge,
  chevron = false,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof ThemedIcon>["name"];
  ios?: string;
  active: boolean;
  badge?: number;
  chevron?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const fg = active ? "#ffffff" : colors.textSecondary;
  return (
    <PressableScale
      scaleTo={0.96}
      hitSlop={6}
      style={[styles.filterChip, active ? styles.filterChipActive : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
    >
      <ThemedIcon ios={ios} name={icon} size={14} color={fg} />
      <Text style={active ? styles.filterChipTextActive : styles.filterChipText} numberOfLines={1}>
        {label}
      </Text>
      {typeof badge === "number" && badge > 0 ? (
        <View style={[styles.filterCountBadge, active ? styles.filterCountBadgeActive : null]}>
          <Text style={styles.filterCountText}>{badge}</Text>
        </View>
      ) : null}
      {chevron ? <ThemedIcon name="chevron-down" size={12} color={active ? "#ffffff" : colors.textFaint} /> : null}
    </PressableScale>
  );
}

/**
 * P1-2：主页面顶部**只留一行**筛选 chips —— 城市（省 · 市回显）/ 方向 / 排序 / 更多筛选。
 * 城市与方向点开走 BottomSheet（省市二级交互保留在弹层里），排序两态直接切换，
 * 薪资/学历/经验/发布时间/技能等高级条件全部收进「更多筛选」弹层。
 */
function JobsListHeader({
  stats,
  category,
  city,
  sort,
  filterCount,
  filterRefreshing,
  onOpenCity,
  onOpenDirection,
  onSort,
  onOpenFilter,
  onSearch,
}: {
  stats: JobStats | null;
  category: string;
  city: string;
  sort: "new" | "salary";
  filterCount: number;
  filterRefreshing: boolean;
  onOpenCity: () => void;
  onOpenDirection: () => void;
  onSort: (s: "new" | "salary") => void;
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

      {/* P1-2：原 StatRow 三卡压成一行文字统计，给首屏多让出 ~45pt（数字仍全在） */}
      {stats ? (
        <Text style={styles.statLine} numberOfLines={1}>
          今日新增 <Text style={styles.statStrong}>{stats.todayNew}</Text> · 在库{" "}
          <Text style={styles.statStrong}>{stats.total}</Text> · 覆盖{" "}
          <Text style={styles.statStrong}>{stats.platformCount}</Text> 个平台
        </Text>
      ) : null}

      <JobsSearchRow onSearch={onSearch} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBarRow}
        accessibilityLabel="筛选栏"
      >
        <FilterBarChip
          label={city ? cityProvinceLabel(city) : "城市"}
          icon="location-outline"
          ios="mappin.and.ellipse"
          active={Boolean(city)}
          chevron
          accessibilityLabel={city ? "城市：" + cityProvinceLabel(city) + "，点击更换" : "选择城市"}
          onPress={() => {
            haptics.soft();
            onOpenCity();
          }}
        />
        <FilterBarChip
          label={CATEGORY_OPTIONS.find((item) => item.id === category)?.label ?? "方向"}
          icon="pricetag-outline"
          ios="tag"
          active={category !== ""}
          chevron
          accessibilityLabel="选择岗位方向"
          onPress={() => {
            haptics.soft();
            onOpenDirection();
          }}
        />
        <FilterBarChip
          label={sort === "salary" ? "薪资优先" : "最新发布"}
          icon="swap-vertical"
          ios="arrow.up.arrow.down"
          active={sort === "salary"}
          accessibilityLabel={sort === "salary" ? "当前按薪资排序，点击切回最新" : "当前按最新排序，点击切换薪资"}
          onPress={() => {
            haptics.soft();
            onSort(sort === "salary" ? "new" : "salary");
          }}
        />
        <FilterBarChip
          label="更多筛选"
          icon="options-outline"
          ios="slider.horizontal.3"
          active={filterCount > 0}
          badge={filterCount}
          accessibilityLabel={filterCount > 0 ? "更多筛选，已选 " + filterCount + " 项" : "更多筛选"}
          onPress={() => {
            haptics.soft();
            onOpenFilter();
          }}
        />
      </ScrollView>
    </View>
  );
}

/** P1-2：城市弹层——省份一级 + 城市二级（沿用 P13 的分组与「省 · 市」回显） */
function CityFilterSheet({
  visible,
  city,
  province,
  onCity,
  onProvince,
  onClose,
}: {
  visible: boolean;
  city: string;
  province: string;
  onCity: (v: string) => void;
  onProvince: (v: string) => void;
  onClose: () => void;
}) {
  const cityOptions = province === "" || province === HOT_PROVINCE_KEY ? HOT_CITIES : getCitiesOfProvince(province);
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="选择城市"
      subtitle="先选省份，再选城市；「不限」清空城市条件"
      icon="location-outline"
      height="80%"
      footer={<SheetStickyCta label="完成" icon="checkmark" onPress={onClose} />}
      footerHint="选择即时生效，关掉弹层不会丢条件"
    >
      <SheetSection title="省份">
        <ChipGroup
          multiple={false}
          wrap
          options={[
            { key: "", label: "不限" },
            { key: HOT_PROVINCE_KEY, label: "热门" },
            ...PROVINCE_CITIES.map((group) => ({ key: group.province, label: group.province })),
          ]}
          selected={[province]}
          onToggle={(k) => onProvince(k)}
        />
      </SheetSection>
      <SheetSection
        title={province === "" || province === HOT_PROVINCE_KEY ? "热门城市" : province}
        hint={city ? "已选：" + cityProvinceLabel(city) : "点城市即时筛选"}
        last
      >
        <ChipGroup
          multiple={false}
          wrap
          options={[{ key: "", label: "不限城市" }, ...cityOptions.map((c) => ({ key: c, label: c }))]}
          selected={[city]}
          onToggle={(k) => onCity(city === k ? "" : k)}
        />
      </SheetSection>
    </BottomSheet>
  );
}

/** P1-2：方向弹层（原来占一整行的四个分类 chip 收进这里） */
function DirectionFilterSheet({
  visible,
  category,
  onCategory,
  onClose,
}: {
  visible: boolean;
  category: string;
  onCategory: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="岗位方向"
      subtitle="按大类筛选职位，选择即时生效"
      icon="pricetag-outline"
      height="46%"
      footer={<SheetStickyCta label="完成" icon="checkmark" onPress={onClose} />}
    >
      <SheetSection title="方向" last>
        <ChipGroup
          multiple={false}
          wrap
          options={CATEGORY_OPTIONS.map((item) => ({ key: item.id, label: item.label }))}
          selected={[category]}
          onToggle={(k) => {
            onCategory(k);
            onClose();
          }}
        />
      </SheetSection>
    </BottomSheet>
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
  salaryMin,
  salaryMax,
  education,
  experience,
  publishedWithin,
  skills,
  onSalary,
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
  salaryMin: number | null;
  salaryMax: number | null;
  education: string[];
  experience: string[];
  publishedWithin: "" | "today" | "3d" | "7d";
  skills: string[];
  onSalary: (min: number | null, max: number | null) => void;
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
      subtitle="可叠加多个条件；顶部「更多筛选」徽标会显示已选条数"
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
      footerHint="城市不在本弹层：点上方的「城市」chip 单独选省/市"
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
                  options={skills.map((s) => ({ key: s, label: s }))}
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
  // P13：一级筛选（省/直辖市/热门），二级才是城市；城市仍然是发给 API 的筛选值
  const [province, setProvince] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"new" | "salary">("new");
  // S5-4：id 契约统一 string（与 API 响应一致，避免 bigint 精度丢失）
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  // P1 多条件筛选（Bottom Sheet）
  const [filterVisible, setFilterVisible] = useState(false);
  // P1-2：城市/方向改成独立弹层，主页面只留一行 chips
  const [citySheetVisible, setCitySheetVisible] = useState(false);
  const [directionSheetVisible, setDirectionSheetVisible] = useState(false);
  const [salaryMin, setSalaryMin] = useState<number | null>(null);
  const [salaryMax, setSalaryMax] = useState<number | null>(null);
  const [education, setEducation] = useState<string[]>([]);
  const [experience, setExperience] = useState<string[]>([]);
  const [publishedWithin, setPublishedWithin] = useState<"" | "today" | "3d" | "7d">("");
  const [skillsFilter, setSkillsFilter] = useState<string[]>([]);
  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedId) ?? null, [jobs, selectedId]);
  const listRef = useRef<FlashListRef<JobPostingListItem>>(null);
  /**
   * v1.32.0 崩溃取证：记录"崩溃前滚到了第几屏"。
   * 身份用 ref 固定（FlashList 会因回调换身份而整列表重渲染），
   * 且**不做任何 setState / 动画** —— 面包屑写模块级缓冲 + 防抖落盘（lib/crash-capture.ts），
   * 不参与 React 渲染，避免它自己变成新的闪退源（踩坑 92）。
   */
  const onViewableItemsChanged = useCallback((info: { viewableItems: Array<{ index?: number | null }> }) => {
    const idx = info.viewableItems.map((v) => v.index).filter((i): i is number => typeof i === "number");
    if (idx.length === 0) return;
    recordCrumb("scroll", { first: Math.min(...idx), last: Math.max(...idx), visible: idx.length });
  }, []);
  /** P1-2：「更多筛选」chip 的计数徽标——已叠加的高级条件条数（城市/方向/排序各自有 chip，不重复计） */
  const advancedFilterCount =
    (salaryMin != null ? 1 : 0) +
    (salaryMax != null ? 1 : 0) +
    education.length +
    experience.length +
    (publishedWithin !== "" ? 1 : 0) +
    skillsFilter.length;

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
        // v1.32.0 崩溃取证：抓取结果也入库（崩溃前最后一次筛选/分页的口径）
        recordCrumb("fetch", {
          mode,
          count: data.jobs.length,
          total: data.total,
          page: data.page,
          q: String(query ?? "").slice(0, 40),
          city,
          category: category || null,
          sort,
        });
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

  // P1-2：筛选回显从「独立回显 chip 行」收敛进主页面唯一一行筛选 chips ——
  // 城市在「城市」chip 里显示「省 · 市」，其余高级条件用「更多筛选」的计数徽标提示，
  // 因此不再单独维护 filterChips 列表（清空条件统一走高级筛选弹层的「清空全部条件」）。

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
  const toggleFavorite = async (job: { id: string }) => {
    recordCrumb("action", { name: "toggle-fav", id: job.id });
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
    // v1.32.0 崩溃取证：真机反馈是"点开岗位详情后滑动列表就闪退"，这一条必须留痕
    recordCrumb("action", { name: "open-job", id: job.id, title: String(job.title ?? "").slice(0, 40) });
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

  /**
   * P13：切换一级省份。若当前已选城市不属于新省份分组，则连带清空城市条件，
   * 避免出现「一级显示广东、二级还留着杭州」的错配。
   */
  const changeProvince = useCallback((next: string) => {
    setProvince(next);
    setCity((prev) => {
      if (!prev) return "";
      const group = next === HOT_PROVINCE_KEY ? HOT_CITIES : next ? getCitiesOfProvince(next) : [];
      return group.includes(prev) ? prev : "";
    });
  }, []);

  // v20-A5：列表头收进 JobsListHeader 组件（搜索态内聚 + 传组件类型，输入不再整头重渲染）
  const header = (
    <JobsListHeader
      stats={stats}
      category={category}
      city={city}
      sort={sort}
      filterCount={advancedFilterCount}
      filterRefreshing={filterRefreshing}
      onOpenCity={() => setCitySheetVisible(true)}
      onOpenDirection={() => setDirectionSheetVisible(true)}
      onSort={setSort}
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
        // ⚠️ v1.32.2：FlashList 必须用 onScrollJS —— FlashList v2 内部是 `props.onScroll?.(event)`
        // 直接调用，而 Reanimated 的 onScroll 是 {workletEventHandler} 对象 →
        // TypeError: undefined is not a function → fatal → 进程死（招花下滑闪退的真根因）
        onScroll={headerScroll.onScrollJS}
        scrollEventThrottle={16}
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        onViewableItemsChanged={onViewableItemsChanged}
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
        salaryMin={salaryMin}
        salaryMax={salaryMax}
        education={education}
        experience={experience}
        publishedWithin={publishedWithin}
        skills={skillsFilter}
        onSalary={(min, max) => { setSalaryMin(min); setSalaryMax(max); }}
        onToggleEdu={(v) => setEducation((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
        onToggleExp={(v) => setExperience((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
        onPublished={(v) => setPublishedWithin(v)}
        onAddSkill={(v) => setSkillsFilter((prev) => (prev.includes(v) ? prev : [...prev, v]))}
        onRemoveSkill={(v) => setSkillsFilter((prev) => prev.filter((x) => x !== v))}
        onReset={() => {
          setCity(""); setProvince("");
          setSalaryMin(null); setSalaryMax(null);
          setEducation([]); setExperience([]);
          setPublishedWithin(""); setSkillsFilter([]);
        }}
        onApply={() => setFilterVisible(false)}
        onClose={() => setFilterVisible(false)}
      />
      <CityFilterSheet
        visible={citySheetVisible}
        city={city}
        province={province}
        onCity={setCity}
        onProvince={changeProvince}
        onClose={() => setCitySheetVisible(false)}
      />
      <DirectionFilterSheet
        visible={directionSheetVisible}
        category={category}
        onCategory={setCategory}
        onClose={() => setDirectionSheetVisible(false)}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1 },
  /** 列表左右留白：FlashList v2 忽略 contentContainerStyle 的 padding，必须逐处显式给 */
  listSide: { paddingHorizontal: 16 },
  // P1-2：一行文字统计（替代原 StatRow 三卡）
  statLine: { ...typography.micro, fontWeight: "400", color: colors.textMuted, paddingTop: 2 },
  statStrong: { ...typography.micro, fontWeight: "800", color: colors.text },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // P1-2：主页面唯一一行筛选 chips（城市 / 方向 / 排序 / 更多筛选），横向滚动
  filterBarRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, paddingBottom: 2 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 210,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.caption, fontWeight: "700", color: colors.textSecondary },
  filterChipTextActive: { ...typography.caption, fontWeight: "800", color: "#ffffff" },
  filterCountBadge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  filterCountBadgeActive: { backgroundColor: "#ffffff" },
  filterCountText: { ...typography.micro, color: colors.primary, fontWeight: "800" },
  // P1-2：压缩版岗位卡 —— 上 40pt logo 行 + 下 26pt 徽章/标签行，实测高度约 97pt（目标 ≤132pt）
  jobCard: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 11,
    shadowColor: "#1C2430",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /**
   * v1.32.0：零 Reanimated 的按压反馈（静态 transform + opacity，不走 worklet/共享值）。
   * 虚拟化列表 item 里一旦出现 Reanimated 动画，按下→滚动/回收就会在 UI 线程重启动画并崩原生层（踩坑 92）。
   */
  jobCardPressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  pressedFaint: { opacity: 0.5 },
  jobTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1C2430",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  logoText: { ...typography.callout, color: "#ffffff", fontWeight: "800" },
  jobMain: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  jobTitle: { ...typography.callout, fontWeight: "800", flex: 1, color: colors.text },
  salary: { ...typography.callout, fontWeight: "900", color: colors.accentStrong },
  jobMeta: { ...typography.micro, fontWeight: "400", color: colors.textSecondary },
  jobFoot: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 9 },
  footTags: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0, overflow: "hidden" },
  footFlag: {
    ...typography.micro,
    fontWeight: "800",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: "hidden",
    flexShrink: 0,
  },
  tag: {
    flexShrink: 1,
    maxWidth: 104,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: { ...typography.micro, fontWeight: "700", color: colors.primary },
  time: { ...typography.micro, fontWeight: "400", color: colors.textFaint, textAlign: "right" },
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
