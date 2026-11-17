import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";

import type { JobDetailSeed } from "@/components/job-detail-modal";
import { useLargeTitleHeader } from "@/components/screen-header";
import { toggleJobFavorite } from "@/lib/jobs";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import {
  addRadarFilterPreset,
  applyRadarFilter,
  buildRadarOverview,
  clearRadarFilterKey,
  createRadarPreset,
  deserializeRadarPresets,
  EMPTY_RADAR_FILTER,
  filterRadar,
  isSameRadarFilter,
  normalizeRadarFilter,
  parseRadarReasonExpanded,
  radarActiveFilterCount,
  radarFacets,
  radarFilterChips,
  RADAR_PAGE_SIZE,
  RADAR_PRESET_STORAGE_KEY,
  RADAR_REASON_STORAGE_KEY,
  radarVisibleSlice,
  removeRadarFilterChip,
  removeRadarFilterPreset,
  renameRadarFilterPreset,
  serializeRadarPresets,
  serializeRadarReasonExpanded,
  toggleRadarFilterValue,
  type RadarFilter,
  type RadarFilterChip,
  type RadarFilterPreset,
  type RadarSort,
} from "@/lib/radar-filter";

import { makeStyles } from "./radar-styles";
import { TARGET_ROLE_MAX_LENGTH, type RadarJob, type RadarResponse } from "./radar-widgets";

/** 一次拉全候选集，筛选/排序在本地即时完成 */
const FETCH_LIMIT = 200;

/**
 * 岗位雷达的取数 / 副作用 / 派生值 / 回调（从 app/radar.tsx 整段切片）。
 *
 * 零行为变更：hook 调用顺序、effect 时序、请求与缓存逻辑、惰性默认值全部与拆分前逐行一致；
 * 视图层只消费这里返回的页面模型（显式 props 传给 components/radar/ 下的区块组件）。
 */
export function useRadarScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduced = useReducedMotion();
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const { editTarget } = useLocalSearchParams<{ editTarget?: string }>();
  const [data, setData] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  /** 已应用的筛选与弹层里的草稿（关闭不丢草稿，应用才生效） */
  const [filter, setFilter] = useState<RadarFilter>(EMPTY_RADAR_FILTER);
  const [draft, setDraft] = useState<RadarFilter>(EMPTY_RADAR_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sort, setSort] = useState<RadarSort>("match_desc");
  const [visibleSize, setVisibleSize] = useState(RADAR_PAGE_SIZE);
  const [expandedJobs, setExpandedJobs] = useState<ReadonlySet<number>>(() => new Set());
  const [detailJob, setDetailJob] = useState<JobDetailSeed | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  /** 相对时间基准（挂载时取一次，避免每帧 Date.now 触发无谓重渲染） */
  const [now] = useState(() => Date.now());
  /** v1.62 P1-4：我的筛选预设（AsyncStorage，≤5 个） */
  const [presets, setPresets] = useState<RadarFilterPreset[]>([]);
  /** 匹配理由默认折叠状态（全局一个开关，持久化） */
  const [reasonExpanded, setReasonExpanded] = useState(false);
  /** P3-3B：目标岗位编辑弹层（保存后 PUT /api/profile/info 并带 target 重算雷达） */
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const [targetSaving, setTargetSaving] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);

  /**
   * 拉取雷达数据。
   * targetOverride：显式按目标岗位重算（保存后调用）；不传时由 Web 侧回落 user_settings.target_role。
   */
  const load = useCallback(async (targetOverride?: string | null) => {
    setLoading(true);
    setLoadError(false);
    try {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const target = targetOverride?.trim();
      const targetQuery = target ? `&target=${encodeURIComponent(target)}` : "";
      const response = await fetch(`${getApiUrl()}/api/jobs/radar?limit=${FETCH_LIMIT}${targetQuery}`, { headers });
      if (response.ok) setData((await response.json()) as RadarResponse);
      else setLoadError(true);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const { control: pullControl } = usePullRefresh(load, { stickyHeader: true });

  const top = useMemo(() => data?.top ?? [], [data?.top]);
  const facets = useMemo(() => radarFacets(top), [top]);
  const overview = useMemo(
    () => buildRadarOverview(top, { total: data?.total, counts: data?.counts, now }),
    [top, data?.total, data?.counts, now],
  );
  const filtered = useMemo(() => applyRadarFilter(top, filter, sort), [top, filter, sort]);
  const slice = useMemo(() => radarVisibleSlice(filtered, visibleSize), [filtered, visibleSize]);
  const activeCount = radarActiveFilterCount(filter);
  const chips = useMemo(() => radarFilterChips(filter), [filter]);
  const previewCount = useMemo(() => filterRadar(top, draft).length, [top, draft]);

  /** 修改已应用条件后统一回到第一页（避免停在旧的滚动深度） */
  const applyFilter = (next: RadarFilter) => {
    setFilter(next);
    setVisibleSize(RADAR_PAGE_SIZE);
  };

  const openSheet = () => {
    haptics.soft();
    setDraft(filter);
    setSheetOpen(true);
  };

  const resetAll = () => {
    haptics.soft();
    applyFilter(EMPTY_RADAR_FILTER);
  };

  const removeChip = (chip: RadarFilterChip) => {
    haptics.soft();
    applyFilter(removeRadarFilterChip(filter, chip));
  };

  const changeSort = (next: RadarSort) => {
    if (next === sort) return;
    haptics.soft();
    setSort(next);
    setVisibleSize(RADAR_PAGE_SIZE);
  };

  const loadMore = () => {
    haptics.soft();
    setVisibleSize(slice.nextSize);
  };

  /* ---------------- v1.62 P1-4：筛选预设 & 理由折叠（AsyncStorage） ---------------- */

  /** 启动时读取预设与理由折叠状态；脏数据由纯函数兜底（失败不阻塞页面） */
  useEffect(() => {
    let alive = true;
    // v3 存储接口是 getMany（返回 key → 值对象），替代旧版 multiGet
    AsyncStorage.getMany([RADAR_PRESET_STORAGE_KEY, RADAR_REASON_STORAGE_KEY])
      .then((stored) => {
        if (!alive) return;
        setPresets(deserializeRadarPresets(stored[RADAR_PRESET_STORAGE_KEY] ?? null));
        setReasonExpanded(parseRadarReasonExpanded(stored[RADAR_REASON_STORAGE_KEY] ?? null));
      })
      .catch(() => {
        // 存储不可用：保持默认（无预设 / 折叠）
      });
    return () => {
      alive = false;
    };
  }, []);

  const persistPresets = (next: RadarFilterPreset[]) => {
    setPresets(next);
    void AsyncStorage.setItem(RADAR_PRESET_STORAGE_KEY, serializeRadarPresets(next)).catch(() => {});
  };

  /** 保存当前已应用的筛选（页面胶囊区） */
  const savePreset = (source: RadarFilter = filter) => {
    if (radarActiveFilterCount(source) === 0) return;
    haptics.success();
    persistPresets(addRadarFilterPreset(presets, createRadarPreset(source, { now: Date.now() })));
  };

  /** 应用预设：一次性回填草稿并立即生效（回到第一页） */
  const applyPreset = (id: string) => {
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    haptics.soft();
    const next = normalizeRadarFilter(preset.filter);
    setDraft(next);
    applyFilter(next);
  };

  const deletePreset = (id: string) => {
    haptics.soft();
    persistPresets(removeRadarFilterPreset(presets, id));
  };

  const renamePreset = (id: string, name: string) => {
    haptics.soft();
    persistPresets(renameRadarFilterPreset(presets, id, name));
  };

  const toggleReasonExpanded = () => {
    haptics.soft();
    const next = !reasonExpanded;
    setReasonExpanded(next);
    void AsyncStorage.setItem(RADAR_REASON_STORAGE_KEY, serializeRadarReasonExpanded(next)).catch(() => {});
  };

  const presetMatchesCurrent = presets.some((preset) => isSameRadarFilter(preset.filter, filter));
  const canSaveCurrentPreset = activeCount > 0 && !presetMatchesCurrent;

  const toggleExpanded = (jobId: number) => {
    haptics.soft();
    setExpandedJobs((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  /** 雷达条目 → 详情弹层种子（缺的字段由弹层内 fetchJobDetail 拉全量补齐） */
  const openJob = (job: RadarJob) => {
    haptics.light();
    setDetailJob({
      id: String(job.jobId),
      title: job.title,
      company: job.company,
      city: job.city || undefined,
      education: job.education || undefined,
      salaryText: job.salaryText || undefined,
      url: job.url || undefined,
      channel: "job",
    });
    setDetailVisible(true);
  };

  const toggleFavorite = async (seed: JobDetailSeed) => {
    if (!token) {
      Alert.alert("请先登录", "收藏功能需要登录后使用。");
      return;
    }
    try {
      const favorited = await toggleJobFavorite(seed.id);
      if (favorited) haptics.success();
      else haptics.soft();
    } catch {
      Alert.alert("收藏失败", "请稍后重试");
    }
  };

  /* ---------------- P3-3B：目标岗位编辑与重算 ---------------- */

  const openTargetSheet = () => {
    haptics.soft();
    setTargetDraft(data?.targetRole ?? "");
    setTargetError(null);
    setTargetSheetOpen(true);
  };

  const requestedTargetEdit = useRef(false);
  useEffect(() => {
    if (editTarget !== "1" || loading || requestedTargetEdit.current) return;
    requestedTargetEdit.current = true;
    setTargetDraft(data?.targetRole ?? "");
    setTargetError(null);
    setTargetSheetOpen(true);
  }, [editTarget, loading, data?.targetRole]);

  /**
   * 保存目标岗位：先乐观更新标题与「目标岗位」行，PUT 成功后再带 target 重算雷达；
   * 未登录先提示登录（本地不保存，避免和云端不一致）；失败回滚旧值并在弹层内提示。
   */
  const saveTargetRole = async (nextRole: string) => {
    if (!token) {
      setTargetError("请先登录后再保存目标岗位");
      Alert.alert("请先登录", "目标岗位会保存到云端并用于雷达重算，请先登录。");
      return;
    }
    const trimmed = nextRole.trim().slice(0, TARGET_ROLE_MAX_LENGTH);
    const previous = data?.targetRole ?? null;
    // 值没变就只关弹层，不产生无谓请求
    if (trimmed === (previous ?? "")) {
      setTargetSheetOpen(false);
      return;
    }
    setTargetSaving(true);
    setTargetError(null);
    // 乐观更新：弹层关闭前标题/行先反映新目标岗位
    setData((current) => (current ? { ...current, targetRole: trimmed || null } : current));
    try {
      const response = await fetch(`${getApiUrl()}/api/profile/info`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetRole: trimmed }),
      });
      if (!response.ok) throw new Error(String(response.status));
      haptics.success();
      setTargetSheetOpen(false);
      // 带 target 重新请求：按新目标岗位重算岗位契合与排序
      await load(trimmed);
    } catch {
      // 失败回滚：没存上就不能继续用新值算分
      setData((current) => (current ? { ...current, targetRole: previous } : current));
      haptics.error();
      setTargetError("保存失败，已恢复原目标岗位，请稍后重试");
    } finally {
      setTargetSaving(false);
    }
  };

  const clearTargetRole = () => {
    haptics.soft();
    setTargetDraft("");
    void saveTargetRole("");
  };

  const showSkeleton = loading && top.length === 0;
  const showError = !loading && loadError && top.length === 0;
  const showNoProfile = !loading && !loadError && top.length === 0;
  const showEmpty = !loading && top.length > 0 && filtered.length === 0;

  /** 筛选弹层草稿交互（原页面 JSX 内联箭头函数原样搬入）：只改草稿，不应用 */
  const toggleDraft = (group: Parameters<typeof toggleRadarFilterValue>[1], value: string) =>
    setDraft((current) => toggleRadarFilterValue(current, group, value));
  const clearDraft = (group: Parameters<typeof clearRadarFilterKey>[1]) =>
    setDraft((current) => clearRadarFilterKey(current, group));
  const resetDraft = () => setDraft(EMPTY_RADAR_FILTER);
  /** 应用草稿：触觉 → 应用（同时回到第一页）→ 关闭弹层，顺序与拆分前一致 */
  const applyDraft = () => {
    haptics.light();
    applyFilter(draft);
    setSheetOpen(false);
  };

  /** 页面模型：状态 + 派生值 + 回调，交给 radar.tsx 与各区块组件显式接收。 */
  return {
    colors,
    styles,
    reduced,
    headerScroll,
    tabBarSpace,
    pullControl,
    now,
    load,
    data,
    showSkeleton,
    showError,
    showNoProfile,
    showEmpty,
    /* 概览 / 列表 */
    overview,
    facets,
    filtered,
    slice,
    activeCount,
    chips,
    presets,
    sort,
    changeSort,
    openSheet,
    resetAll,
    removeChip,
    savePreset,
    applyPreset,
    deletePreset,
    renamePreset,
    canSaveCurrentPreset,
    loadMore,
    filter,
    reasonExpanded,
    toggleReasonExpanded,
    expandedJobs,
    toggleExpanded,
    openJob,
    detailJob,
    detailVisible,
    setDetailVisible,
    toggleFavorite,
    /* 筛选弹层 */
    sheetOpen,
    setSheetOpen,
    draft,
    previewCount,
    toggleDraft,
    clearDraft,
    resetDraft,
    applyDraft,
    /* 目标岗位弹层 */
    targetSheetOpen,
    setTargetSheetOpen,
    targetDraft,
    setTargetDraft,
    targetSaving,
    targetError,
    openTargetSheet,
    saveTargetRole,
    clearTargetRole,
  };
}
