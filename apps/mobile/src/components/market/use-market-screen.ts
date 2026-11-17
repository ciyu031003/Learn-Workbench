/* eslint-disable react-hooks/set-state-in-effect -- 决策场景 effect 里同步置 loading/error（与拆分前一致） */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useLargeTitleHeader } from "@/components/screen-header";
import { TOAST_DEFAULT_LIFE_MS, type ToastKind } from "@/components/toast";
import { haptics } from "@/lib/haptics";
import { friendlyError } from "@/lib/friendly-error";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useScreenEntrance } from "@/lib/use-screen-entrance";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { useAppStore } from "@/store/app-store";
import {
  enrollMarketGaps,
  fetchMarketDecision,
  fetchMarketIntelligence,
  fetchMarketPersonal,
  type MarketDecisionPayload,
  type MarketFacetItem,
  type MarketIntelligenceFilters,
  type MarketIntelligencePayload,
  type MarketIntelligenceRange,
  type MarketPersonalInsights,
} from "@/lib/market";
import type { MarketGapItem } from "@learn-workbench/shared/schemas";

import { makeStyles } from "./market-styles";
import { FILTER_LABEL, type FilterKey } from "./market-widgets";

/**
 * 市场分析的取数 / 副作用 / 派生值 / 回调（从 app/market.tsx 整段切片）。
 *
 * 零行为变更：hook 调用顺序、effect 时序、请求与缓存逻辑、惰性默认值全部与拆分前逐行一致；
 * 视图层只消费这里返回的页面模型（显式 props 传给 components/market/ 下的区块组件）。
 */
export function useMarketScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  /** v20-C2：四张数据卡入场错峰 */
  const entrance = useScreenEntrance();
  const token = useAppStore((s) => s.token);
  const setAuth = useAppStore((s) => s.setAuth);

  const [filters, setFilters] = useState<MarketIntelligenceFilters>({ range: 90 });
  const [data, setData] = useState<MarketIntelligencePayload | null>(null);
  const [personal, setPersonal] = useState<MarketPersonalInsights>({ loggedIn: false });
  const [decision, setDecision] = useState<MarketDecisionPayload | null>(null);
  const [decisionTarget, setDecisionTarget] = useState({ city: "", functionKey: "" });
  const [loading, setLoading] = useState(true);
  /** v20-C1：换 range/搜索时保留旧内容，只显示细进度条（不再整页闪 spinner） */
  const [filterRefreshing, setFilterRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState<FilterKey | null>(null);
  const [decisionPicker, setDecisionPicker] = useState<"city" | "function" | null>(null);
  /** v20-C3：What If 的重算中/失败态独立（失败不再伪装成"正在计算"） */
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState(false);
  const [decisionNonce, setDecisionNonce] = useState(0);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<ToastKind>("success");
  const [search, setSearch] = useState("");

  const showToast = useCallback((message: string, kind: ToastKind = "success", lifeMs = TOAST_DEFAULT_LIFE_MS) => {
    setToast(message);
    setToastKind(kind);
    setTimeout(() => setToast((current) => (current === message ? null : current)), lifeMs);
  }, []);

  const loadedOnceRef = useRef(false);

  const load = useCallback(async (refresh = false) => {
    if (!refresh) {
      // v20-C1：首载走骨架；之后的筛选变化保留旧内容 + 细进度条
      if (loadedOnceRef.current) setFilterRefreshing(true);
      else setLoading(true);
    }
    setError(null);
    try {
      const [nextData, nextPersonal] = await Promise.all([
        fetchMarketIntelligence(filters),
        fetchMarketPersonal(),
      ]);
      setData(nextData);
      setPersonal(nextPersonal);
      loadedOnceRef.current = true;
    } catch (e) {
      setError(friendlyError(e, "市场数据加载失败"));
    } finally {
      setLoading(false);
      setFilterRefreshing(false);
    }
  }, [filters]);

  // v17/v18 收尾：下拉刷新统一走 usePullRefresh（吸顶栏存在 → 偏移自动 = insets.top + 44）
  const { control: pullControl } = usePullRefresh(() => load(true), { stickyHeader: true });

  useEffect(() => {
    void load();
  }, [load, token]);

  // v20-C3：What If 重算带 loading/失败态（请求序号守卫防旧响应覆盖新响应）
  const decisionSeq = useRef(0);
  useEffect(() => {
    let seq = ++decisionSeq.current;
    let alive = true;
    setDecisionLoading(true);
    setDecisionError(false);
    fetchMarketDecision(decisionTarget.city || undefined, decisionTarget.functionKey || undefined)
      .then((payload) => {
        if (alive && seq === decisionSeq.current) setDecision(payload);
      })
      .catch(() => {
        if (alive && seq === decisionSeq.current) setDecisionError(true);
      })
      .finally(() => {
        if (alive && seq === decisionSeq.current) setDecisionLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [decisionTarget, decisionNonce]);

  const patchFilters = (patch: Partial<MarketIntelligenceFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const handleAuthed = (nextToken: string, username: string) => {
    setAuth(nextToken, username);
    setAuthOpen(false);
  };

  const enroll = async (gap: MarketGapItem) => {
    if (!gap || enrolling) return;
    setEnrolling(gap.skill);
    try {
      const created = await enrollMarketGaps([gap]);
      haptics.success();
      // v20-C4：反馈统一走页内 toast（不再 Alert 打断）
      showToast(`已创建 ${created} 项学习任务到今日计划`, "success");
      setPersonal(await fetchMarketPersonal());
    } catch (e) {
      haptics.error();
      showToast(friendlyError(e, "加入失败，请稍后重试"), "error");
    } finally {
      setEnrolling(null);
    }
  };

  const pickFilterOptions = (key: FilterKey): MarketFacetItem[] => {
    if (!data) return [];
    if (key === "industry") {
      return data.facets.industries.map((item) => ({
        key: `${item.key}`,
        label: item.label,
        count: item.count,
      }));
    }
    if (key === "city") return data.facets.cities;
    if (key === "function") return data.facets.functions;
    if (key === "seniority") return data.facets.seniorities;
    return data.facets.sources;
  };

  const setFilterOption = (key: FilterKey, value: string) => {
    if (key === "industry") {
      const [sector, subsector] = value.split(" / ");
      patchFilters({
        industrySector: value ? sector : undefined,
        industrySubsector: value && subsector ? subsector : undefined,
      });
    } else if (key === "city") {
      patchFilters({ city: value || undefined });
    } else if (key === "function") {
      patchFilters({ functionKey: value || undefined });
    } else if (key === "seniority") {
      patchFilters({ seniorityBucket: value || undefined });
    } else {
      patchFilters({ source: value || undefined });
    }
  };

  const industryValue = filters.industrySector
    ? filters.industrySubsector
      ? `${filters.industrySector} / ${filters.industrySubsector}`
      : filters.industrySector
    : "";
  const summary = data?.summary;
  const dist = data?.distributions;

  /** 某个筛选键当前选中的值（弹层里用来点亮对应胶囊） */
  const filterValueOf = (key: FilterKey): string => {
    if (key === "city") return filters.city ?? "";
    if (key === "function") return filters.functionKey ?? "";
    if (key === "industry") return industryValue;
    if (key === "seniority") return filters.seniorityBucket ?? "";
    return filters.source ?? "";
  };

  const filterLabels: { key: FilterKey; label: string; value: string }[] = (
    ["city", "function", "industry", "seniority", "source"] as FilterKey[]
  ).map((key) => ({ key, label: FILTER_LABEL[key], value: filterValueOf(key) }));

  const pickDecisionOptions = decisionPicker === "city"
    ? data?.facets.cities ?? []
    : data?.facets.functions ?? [];

  /* ---------------- 筛选 / 搜索 / 弹层回调（原页面 JSX 内联箭头函数原样搬入） ---------------- */

  const changeRange = (key: string) => patchFilters({ range: Number(key) as MarketIntelligenceRange });
  const submitSearch = () => patchFilters({ q: search.trim() || undefined });
  const clearSearchQuery = () => patchFilters({ q: undefined });
  const resetAllFilters = () => {
    setSearch("");
    setFilters({ range: filters.range ?? 90 });
  };
  /** 弹层里点选项：应用并关闭（与拆分前的行内实现同序） */
  const chooseFilterOption = (key: string) => {
    if (!filterOpen) return;
    setFilterOption(filterOpen, key);
    setFilterOpen(null);
  };
  const chooseDecisionOption = (key: string) => {
    if (decisionPicker === "city") setDecisionTarget((current) => ({ ...current, city: key }));
    else setDecisionTarget((current) => ({ ...current, functionKey: key }));
    setDecisionPicker(null);
  };
  const retryDecision = () => setDecisionNonce((n) => n + 1);

  /** 页面模型：状态 + 派生值 + 回调，交给 market.tsx 与各区块组件显式接收。 */
  return {
    styles,
    headerScroll,
    tabBarSpace,
    pullControl,
    entrance,
    load,
    /* 数据与加载态 */
    data,
    summary,
    dist,
    loading,
    error,
    filterRefreshing,
    /* 筛选 / 搜索 */
    filters,
    filterLabels,
    search,
    setSearch,
    changeRange,
    submitSearch,
    clearSearchQuery,
    resetAllFilters,
    filterOpen,
    setFilterOpen,
    filterValueOf,
    pickFilterOptions,
    chooseFilterOption,
    /* 我的市场位置 */
    personal,
    enrolling,
    enroll,
    authOpen,
    setAuthOpen,
    handleAuthed,
    /* What If */
    decision,
    decisionTarget,
    decisionLoading,
    decisionError,
    decisionPicker,
    setDecisionPicker,
    pickDecisionOptions,
    chooseDecisionOption,
    retryDecision,
    /* toast */
    toast,
    toastKind,
  };
}
