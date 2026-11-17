import Animated from "react-native-reanimated";
import { RefreshControl, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { FilterRefreshBar } from "@/components/filter-refresh-bar";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { SkeletonCard } from "@/components/skeleton";
import { InlineToast } from "@/components/toast";
import { MarketDecisionCard } from "@/components/market/market-decision-card";
import { MarketDistributionCard } from "@/components/market/market-distribution-card";
import { MarketKpiGrid } from "@/components/market/market-kpi-grid";
import { MarketPageHead } from "@/components/market/market-page-head";
import { MarketPersonalCard } from "@/components/market/market-personal-card";
import {
  MarketAuthSheet,
  MarketDecisionSheet,
  MarketFilterSheet,
} from "@/components/market/market-sheets";
import { MarketTrendCard } from "@/components/market/market-trend-card";
import { Chip } from "@/components/market/market-widgets";
import { useMarketScreen } from "@/components/market/use-market-screen";

/**
 * 市场分析（移动端）：纯组合层。
 *
 * 取数 / 副作用 / 派生值 / 回调在 components/market/use-market-screen.ts，
 * 样式表在 components/market/market-styles.ts，区块组件在 components/market/ 下。
 * 本文件只按原顺序摆四段：① 页头（大标题 / 范围 / 搜索）→ ② 筛选 chip 行 + toast/刷新条
 * → ③ 四张数据卡（KPI / 趋势 / 分布 / 个人位置 / What If）→ ④ 三个弹层（筛选 / 目标 / 登录）。
 * 入场错峰编号 0 / 1 / 2 / 3 / 4 与拆分前一致；弹层仍挂在 root 下同一层。
 */
export default function MarketScreen() {
  const {
    styles,
    headerScroll,
    tabBarSpace,
    pullControl,
    entrance,
    load,
    data,
    summary,
    dist,
    loading,
    error,
    filterRefreshing,
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
    personal,
    enrolling,
    enroll,
    authOpen,
    setAuthOpen,
    handleAuthed,
    decision,
    decisionTarget,
    decisionLoading,
    decisionError,
    decisionPicker,
    setDecisionPicker,
    pickDecisionOptions,
    chooseDecisionOption,
    retryDecision,
    toast,
    toastKind,
  } = useMarketScreen();

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏在滚动容器之外才能真吸顶 */}
      <ScreenHeaderStickyBar title="市场分析" scrollY={headerScroll.scrollY} />
    <Animated.ScrollView
      onScroll={headerScroll.onScroll}
      scrollEventThrottle={16}
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
      refreshControl={<RefreshControl {...pullControl} />}
    >
      <MarketPageHead
        summaryTotal={summary?.total}
        range={filters.range}
        onRangeChange={changeRange}
        search={search}
        onChangeSearch={setSearch}
        onSubmitSearch={submitSearch}
        onClearSearch={clearSearchQuery}
      />

      <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filterLabels.map((item) => (
          <Chip
            key={item.key}
            styles={styles}
            label={item.value ? `${item.label}: ${item.value}` : item.label}
            active={!!item.value}
            onPress={() => setFilterOpen(item.key)}
          />
        ))}
        <Chip
          styles={styles}
          label="重置筛选"
          onPress={resetAllFilters}
        />
      </Animated.ScrollView>

      {toast ? <InlineToast message={toast} kind={toastKind} style={styles.toast} /> : null}
      {filterRefreshing ? <FilterRefreshBar /> : null}

      {loading ? (
        /* v20-C1：首载骨架（与全 App 等待语言一致） */
        <View style={styles.body}>
          <SkeletonCard count={3} />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="市场数据加载失败"
          hint={error}
          actionLabel="重试"
          onAction={() => void load()}
        />
      ) : !data || !summary || summary.total === 0 ? (
        <EmptyState
          icon="trending-up-outline"
          title="暂无招聘数据"
          hint="先抓取一些职位，市场趋势与个人位置才会出现。"
        />
      ) : (
        <View style={styles.body}>
          {/* v20-C2：四张卡入场错峰（useScreenEntrance 统一节奏） */}
          <Animated.View entering={entrance(0)}>
          <MarketKpiGrid summary={summary} />
          </Animated.View>

          <Animated.View entering={entrance(1)}>
          <MarketTrendCard timeSeries={data.timeSeries} />
          </Animated.View>

          <Animated.View entering={entrance(2)}>
          <MarketDistributionCard dist={dist} />
          </Animated.View>

          <Animated.View entering={entrance(3)}>
          <MarketPersonalCard
            personal={personal}
            enrolling={enrolling}
            onEnroll={(gap) => void enroll(gap)}
            onOpenAuth={() => setAuthOpen(true)}
          />
          </Animated.View>

          <Animated.View entering={entrance(4)}>
          <MarketDecisionCard
            decision={decision}
            decisionLoading={decisionLoading}
            decisionError={decisionError}
            decisionTarget={decisionTarget}
            onPickCity={() => setDecisionPicker("city")}
            onPickFunction={() => setDecisionPicker("function")}
            onRetry={retryDecision}
          />
          </Animated.View>
        </View>
      )}

      <MarketFilterSheet
        filterOpen={filterOpen}
        onCloseFilter={() => setFilterOpen(null)}
        filterOptions={filterOpen ? pickFilterOptions(filterOpen) : []}
        filterValue={filterOpen ? filterValueOf(filterOpen) : ""}
        onSelectFilter={chooseFilterOption}
      />

      <MarketDecisionSheet
        decisionPicker={decisionPicker}
        onCloseDecisionPicker={() => setDecisionPicker(null)}
        decisionOptions={pickDecisionOptions}
        decisionSelected={decisionPicker === "city" ? [decisionTarget.city] : [decisionTarget.functionKey]}
        onSelectDecisionOption={chooseDecisionOption}
      />

      <MarketAuthSheet
        authOpen={authOpen}
        onCloseAuth={() => setAuthOpen(false)}
        onAuthed={handleAuthed}
      />
    </Animated.ScrollView>
    </View>
  );
}
