import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { EmptyState } from "@/components/empty-state";
import { JobDetailModal } from "@/components/job-detail-modal";
import { PressableScale } from "@/components/pressable-scale";
import { ScreenHeaderStickyBar } from "@/components/screen-header";
import { SkeletonBlock, SkeletonCard } from "@/components/skeleton";
import { ThemedIcon } from "@/components/themed-icon";
import { FilterSheet } from "@/components/radar/radar-filter-sheet";
import { RadarJobCard } from "@/components/radar/radar-job-card";
import { RadarOverviewCard } from "@/components/radar/radar-overview-card";
import { RadarPageHead } from "@/components/radar/radar-page-head";
import { TargetRoleRow, TargetRoleSheet } from "@/components/radar/radar-target-role";
import { useRadarScreen } from "@/components/radar/use-radar-screen";
import { DURATION } from "@/lib/motion";
import { shouldStagger, staggerDelay } from "@/lib/stagger";
import { RADAR_SORT_LABELS, RADAR_SORT_ORDER, radarPresetName } from "@/lib/radar-filter";

/**
 * 岗位雷达（移动端）：纯组合层。
 *
 * 取数 / 副作用 / 派生值 / 回调在 components/radar/use-radar-screen.ts，
 * 样式表在 components/radar/radar-styles.ts，区块组件在 components/radar/ 下。
 * 本文件只按原顺序摆三层：① 页头 → ② 概览 / 目标岗位 / 筛选控制 / 结果列表 → ③ 两个弹层 + 详情弹层。
 * 弹层层级未变：JobDetailModal 仍在滚动容器内，筛选/目标岗位弹层仍是 root 的直接子节点。
 */
export default function RadarScreen() {
  const {
    styles,
    colors,
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
  } = useRadarScreen();

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="岗位雷达" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView
        onScroll={headerScroll.onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...pullControl} />}
      >
        {/* v2 页头：eyebrow + pageTitle + 说明，右侧刷新控件；视觉锚点留给下方概览卡 */}
        <RadarPageHead
          targetRole={data?.targetRole ?? null}
          profileCity={data?.profileCity ?? null}
          onRefresh={() => void load()}
        />

        {showSkeleton ? (
          <>
            <SkeletonBlock variant="card" style={styles.overviewSkeleton} />
            <SkeletonCard count={3} />
          </>
        ) : showError ? (
          <EmptyState
            icon="cloud-offline-outline"
            title="雷达扫描失败"
            hint="网络似乎不太顺，稍后再试试"
            actionLabel="重新扫描"
            onAction={() => void load()}
          />
        ) : showNoProfile ? (
          <EmptyState
            icon="radio-outline"
            title={data?.hasProfile ? "暂时没有可匹配的岗位" : "还没有岗位画像"}
            hint={
              data?.hasProfile
                ? "换个城市或稍后刷新雷达；也可以在「我的资料」里补充目标岗位"
                : "先补全「我的资料」与技能，雷达才能算出匹配度"
            }
            actionLabel="刷新雷达"
            onAction={() => void load()}
          />
        ) : (
          <>
            <RadarOverviewCard overview={overview} fallback={data?.mode === "fallback"} />

            {/* 目标岗位：展示接口回传的生效值，点行编辑后按新目标岗位重算 */}
            <TargetRoleRow targetRole={data?.targetRole ?? null} onPress={openTargetSheet} />

            {/* 「我的筛选」横向 chip：点应用、点 × 删除（≤5 个，持久化） */}
            {presets.length > 0 ? (
              <View style={styles.presetRow}>
                <Text style={styles.presetLabel}>我的筛选</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.presetChips}
                  keyboardShouldPersistTaps="handled"
                >
                  {presets.map((preset) => (
                    <View key={preset.id} style={styles.presetChip}>
                      <PressableScale
                        style={styles.presetChipBody}
                        onPress={() => applyPreset(preset.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`应用筛选预设 ${preset.name}`}
                      >
                        <Text style={styles.presetChipText} numberOfLines={1}>{preset.name}</Text>
                      </PressableScale>
                      <Pressable
                        hitSlop={8}
                        onPress={() => deletePreset(preset.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`删除筛选预设 ${preset.name}`}
                      >
                        <ThemedIcon name="close" size={12} color={colors.primary} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.controlRow}>
              <View style={styles.sortGroup}>
                {RADAR_SORT_ORDER.map((key) => (
                  <PressableScale
                    key={key}
                    hitSlop={5}
                    style={[styles.sortPill, sort === key && styles.sortPillActive]}
                    onPress={() => changeSort(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sort === key }}
                    accessibilityLabel={`按${RADAR_SORT_LABELS[key]}排序`}
                  >
                    <Text style={[styles.sortText, sort === key && styles.sortTextActive]}>{RADAR_SORT_LABELS[key]}</Text>
                  </PressableScale>
                ))}
              </View>
              <PressableScale
                hitSlop={5}
                style={styles.filterBtn}
                onPress={openSheet}
                accessibilityRole="button"
                accessibilityLabel={activeCount > 0 ? `筛选，已选 ${activeCount} 项` : "筛选岗位"}
              >
                <ThemedIcon name="options-outline" size={14} color={colors.primary} />
                <Text style={styles.filterBtnText}>筛选</Text>
                {activeCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeCount}</Text>
                  </View>
                ) : null}
              </PressableScale>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultText}>
                {filtered.length} 个岗位 · 按{RADAR_SORT_LABELS[sort]}排序
              </Text>
              {activeCount > 0 ? (
                <Pressable hitSlop={8} onPress={resetAll} accessibilityRole="button" accessibilityLabel="清空筛选">
                  <Text style={styles.resetText}>重置</Text>
                </Pressable>
              ) : (
                <Text style={styles.resultHint}>共 {overview.matchedTotal} 个匹配</Text>
              )}
            </View>

            {chips.length > 0 ? (
              <View style={styles.chipsWrap}>
                {chips.map((chip) => (
                  <PressableScale
                    key={chip.group + ":" + chip.value}
                    hitSlop={8}
                    style={styles.chipActive}
                    onPress={() => removeChip(chip)}
                    accessibilityRole="button"
                    accessibilityLabel={`移除筛选 ${chip.label}`}
                  >
                    <Text style={styles.chipActiveText} numberOfLines={1}>{chip.label}</Text>
                    <ThemedIcon name="close" size={12} color={colors.primary} />
                  </PressableScale>
                ))}
                {canSaveCurrentPreset ? (
                  <PressableScale
                    hitSlop={8}
                    style={styles.saveChip}
                    onPress={() => savePreset(filter)}
                    accessibilityRole="button"
                    accessibilityLabel={`保存当前筛选为预设 ${radarPresetName(filter)}`}
                  >
                    <ThemedIcon name="bookmark-outline" size={12} color={colors.primary} />
                    <Text style={styles.saveChipText} numberOfLines={1}>保存筛选</Text>
                  </PressableScale>
                ) : null}
              </View>
            ) : null}

            {showEmpty ? (
              <EmptyState
                icon="funnel-outline"
                title="没有符合筛选的岗位"
                hint="试着放宽条件：减少城市 / 薪资 / 学历限制，或清空筛选看全部"
                actionLabel="清空筛选"
                onAction={resetAll}
              />
            ) : (
              <>
                {slice.items.map((job, index) => (
                  <Animated.View
                    key={job.jobId}
                    layout={reduced ? undefined : LinearTransition}
                    entering={
                      reduced || !shouldStagger(index, slice.items.length)
                        ? undefined
                        : FadeInDown.duration(DURATION.base).delay(staggerDelay(index))
                    }
                  >
                    <RadarJobCard
                      job={job}
                      expanded={expandedJobs.has(job.jobId)}
                      onToggleExpand={toggleExpanded}
                      reasonExpanded={reasonExpanded}
                      onToggleReason={toggleReasonExpanded}
                      onPress={openJob}
                      now={now}
                    />
                  </Animated.View>
                ))}

                {slice.hasMore ? (
                  <PressableScale
                    style={styles.loadMore}
                    onPress={loadMore}
                    accessibilityRole="button"
                    accessibilityLabel={`加载更多，还有 ${slice.total - slice.shown} 个岗位`}
                  >
                    <ThemedIcon name="chevron-down" size={16} color={colors.primary} />
                    <Text style={styles.loadMoreText}>加载更多（还有 {slice.total - slice.shown} 个）</Text>
                  </PressableScale>
                ) : slice.total > 0 ? (
                  <Text style={styles.endText}>已显示全部 {slice.total} 个岗位</Text>
                ) : null}
              </>
            )}
          </>
        )}

        <JobDetailModal
          job={detailJob}
          visible={detailVisible}
          onClose={() => setDetailVisible(false)}
          onToggleFavorite={toggleFavorite}
        />
      </Animated.ScrollView>

      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        draft={draft}
        facets={facets}
        previewCount={previewCount}
        presets={presets}
        onApplyPreset={applyPreset}
        onDeletePreset={deletePreset}
        onRenamePreset={renamePreset}
        onSavePreset={(source) => savePreset(source)}
        onToggle={toggleDraft}
        onClear={clearDraft}
        onReset={resetDraft}
        onApply={applyDraft}
      />

      <TargetRoleSheet
        visible={targetSheetOpen}
        onClose={() => setTargetSheetOpen(false)}
        draft={targetDraft}
        onChangeDraft={setTargetDraft}
        onSave={() => void saveTargetRole(targetDraft)}
        onClear={clearTargetRole}
        saving={targetSaving}
        error={targetError}
      />
    </View>
  );
}
