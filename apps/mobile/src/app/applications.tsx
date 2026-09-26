/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState, useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";
import { ThemedIcon } from "@/components/themed-icon";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetListRow, SheetSection, SheetStickyCta } from "@/components/sheet";
import {
  jobApplicationStageLabels,
  type JobApplication,
  type JobApplicationStage,
} from "@learn-workbench/shared";

const STAGES: JobApplicationStage[] = [
  "favorite", "ready", "applied", "online_test", "interview1", "interview2", "offer", "hired", "closed",
];

/** 每页固定 15 张（真机反馈：不要一直往下滑找） */
const PAGE_SIZE = 15;

/** 阶段说明：让「更新阶段」抽屉里的每一行都能自解释 */
const STAGE_DESC: Record<JobApplicationStage, string> = {
  favorite: "先存下来，之后再决定要不要投",
  ready: "简历与材料已就绪，随时可投",
  applied: "已投递，等待对方回复",
  online_test: "在线测评 / 笔试环节",
  interview1: "技术面或业务初面",
  interview2: "复面 / 主管面",
  offer: "已发 Offer，谈薪与确认中",
  hired: "已入职，流程结束",
  closed: "不再跟进",
};

/** 阶段配色：用主题 token，避免硬编码；越靠近 Offer 越暖 */
function stageTint(colors: ThemeColors, stage: JobApplicationStage): string {
  switch (stage) {
    case "favorite":
      return colors.textMuted;
    case "ready":
      return colors.primary;
    case "applied":
      return colors.primaryStrong;
    case "online_test":
      return colors.accent;
    case "interview1":
    case "interview2":
      return colors.accentStrong;
    case "offer":
    case "hired":
      return colors.success;
    default:
      return colors.textFaint;
  }
}

export default function ApplicationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [apps, setApps] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  /** v16：阶段选择收进弹层（原来 9 个胶囊挤在卡片里），id=null 表示关闭 */
  const [stageSheetFor, setStageSheetFor] = useState<number | null>(null);
  /** v1.26：分页（0 基） */
  const [page, setPage] = useState(0);
  const editing = stageSheetFor === null ? null : apps.find((a) => a.id === stageSheetFor) ?? null;

  const api = (path: string, opts: RequestInit = {}) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(getApiUrl() + path, { ...opts, headers });
  };

  const load = useCallback(async () => {
    try {
      const r = await api("/api/jobs/applications");
      if (r.ok) {
        // 不在这里强制回第 1 页：改阶段/删除后刷新时保留当前页，
        // 页码越界由下面的 safePage 夹取兜底（否则每改一次阶段就被弹回首屏）
        setApps((await r.json()).applications ?? []);
      }
    } catch {
      // 离线保持
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  // 从招花收藏后回到本页要立刻看到新条目（旧实现只在挂载时拉一次）
  useFocusRefresh(load);

  const setStage = async (id: number, stage: JobApplicationStage) => {
    const r = await api("/api/jobs/applications/" + id, { method: "PUT", body: JSON.stringify({ stage }) });
    if (r.ok) await load();
  };

  const remove = async (id: number) => {
    await api("/api/jobs/applications/" + id, { method: "DELETE" });
    await load();
  };

  // ---- 分页（只影响展示条数，不动数据来源/筛选/排序）----
  const pageCount = Math.max(1, Math.ceil(apps.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = apps.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = apps.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(apps.length, safePage * PAGE_SIZE + PAGE_SIZE);

  /** 顶部阶段概览：一眼看出整条流水线的分布 */
  const stageCounts = useMemo(
    () => STAGES.map((s) => ({ stage: s, n: apps.filter((a) => a.stage === s).length })).filter((x) => x.n > 0),
    [apps]
  );

  const renderItem = ({ item }: { item: JobApplication }) => {
    const tint = stageTint(colors, item.stage);
    const idx = STAGES.indexOf(item.stage);
    const pct = idx < 0 ? 0 : Math.round(((idx + 1) / STAGES.length) * 100);
    // RN 的 DimensionValue 需要 `${number}%` 字面量类型，普通字符串拼接会被 TS 拒绝
    const pctWidth = `${pct}%` as `${number}%`;
    return (
      <Card style={styles.appCard}>
        <View style={styles.appTop}>
          <View style={styles.appMain}>
            <Text style={styles.title} numberOfLines={1}>{item.jobTitle}</Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.jobCompany || "未知公司"} · {item.jobCity || "全国"}{item.jobSalary ? " · " + item.jobSalary : ""}
            </Text>
          </View>
          <View style={[styles.stageBadge, { backgroundColor: tint + "1F", borderColor: tint + "55" }]}>
            <Text style={[styles.stageText, { color: tint }]}>{jobApplicationStageLabels[item.stage]}</Text>
          </View>
        </View>

        {/* 流水线进度：让"这条走到哪一步"一眼可见 */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: pctWidth, backgroundColor: tint }]} />
        </View>

        <Pressable onPress={() => setStageSheetFor(item.id)} style={styles.stageRow} accessibilityRole="button">
          <ThemedIcon name="swap-horizontal-outline" size={15} color={colors.textMuted} />
          <Text style={styles.stageRowLabel}>更新阶段</Text>
          <Text style={styles.stageRowValue}>{jobApplicationStageLabels[item.stage]}</Text>
          <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
        </Pressable>
      </Card>
    );
  };

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏放在 FlatList **之外**才能真吸顶；大标题留在 ListHeaderComponent 里随列表滚走 */}
      <ScreenHeaderStickyBar title="我的求职" scrollY={headerScroll.scrollY} />
      <FlatList onScroll={headerScroll.onScroll} scrollEventThrottle={16}
        data={shown}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeaderLargeTitle title="我的求职" subtitle={`共 ${apps.length} 条 · 收藏 → Offer 全流程`} />
            {stageCounts.length > 0 ? (
              <View style={styles.stageStrip}>
                {stageCounts.map((s) => (
                  <View key={s.stage} style={styles.stagePill}>
                    <View style={[styles.stageDot, { backgroundColor: stageTint(colors, s.stage) }]} />
                    <Text style={styles.stagePillText}>{jobApplicationStageLabels[s.stage]}</Text>
                    <Text style={styles.stagePillNum}>{s.n}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyBox}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={styles.emptyBox}>
              <ThemedIcon name="briefcase-outline" size={34} color={colors.primary} />
              <Text style={styles.emptyText}>还没有求职记录</Text>
              <Text style={styles.emptyHint}>去「招花」点爱心收藏岗位，这里会自动出现</Text>
            </View>
          )
        }
        ListFooterComponent={
          apps.length > 0 ? (
            <View style={styles.pager}>
              <Pressable
                disabled={safePage <= 0}
                onPress={() => setPage(Math.max(0, safePage - 1))}
                style={[styles.pagerBtn, safePage <= 0 && styles.pagerBtnOff]}
                accessibilityRole="button"
                accessibilityLabel="上一页"
              >
                <ThemedIcon name="chevron-back" size={16} color={safePage <= 0 ? colors.textFaint : colors.primary} />
                <Text style={[styles.pagerBtnText, safePage <= 0 && styles.pagerTextOff]}>上一页</Text>
              </Pressable>

              <View style={styles.pagerMid}>
                <Text style={styles.pagerPage}>第 {safePage + 1} / {pageCount} 页</Text>
                <Text style={styles.pagerCount}>已显示 {from}–{to} / 共 {apps.length} 条</Text>
              </View>

              <Pressable
                disabled={safePage >= pageCount - 1}
                onPress={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                style={[styles.pagerBtn, safePage >= pageCount - 1 && styles.pagerBtnOff]}
                accessibilityRole="button"
                accessibilityLabel="下一页"
              >
                <Text style={[styles.pagerBtnText, safePage >= pageCount - 1 && styles.pagerTextOff]}>下一页</Text>
                <ThemedIcon name="chevron-forward" size={16} color={safePage >= pageCount - 1 ? colors.textFaint : colors.primary} />
              </Pressable>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      {/* v16：阶段选择改「单选列表 + 吸底危险 CTA」；v1.26：补阶段说明与"当前"标记 */}
      <BottomSheet
        visible={stageSheetFor !== null}
        onClose={() => setStageSheetFor(null)}
        title="更新求职阶段"
        subtitle={editing ? `${editing.jobTitle}${editing.jobCompany ? " · " + editing.jobCompany : ""}` : undefined}
        icon="briefcase-outline"
        height="80%"
        footer={
          <SheetStickyCta
            label="移出我的求职"
            icon="trash-outline"
            danger
            onPress={() => {
              if (!editing) return;
              void remove(editing.id);
              setStageSheetFor(null);
            }}
          />
        }
        footerHint="移出后，若这条仍停在「收藏」阶段，收藏也会一并取消"
      >
        <SheetSection title="推进到" hint="点一下直接切到该阶段" last>
          {STAGES.map((s, i) => (
            <SheetListRow
              key={s}
              mode="radio"
              title={jobApplicationStageLabels[s]}
              subtitle={STAGE_DESC[s]}
              iconColor={stageTint(colors, s)}
              trailing={editing?.stage === s ? <Text style={styles.currentTag}>当前</Text> : undefined}
              selected={editing?.stage === s}
              last={i === STAGES.length - 1}
              onPress={() => {
                if (!editing) return;
                void setStage(editing.id, s);
                setStageSheetFor(null);
              }}
            />
          ))}
        </SheetSection>
      </BottomSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    content: { padding: 16, gap: 10 },
    header: { marginBottom: 8, gap: 10 },
    /** 阶段概览条 */
    stageStrip: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    stagePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    stageDot: { width: 6, height: 6, borderRadius: 3 },
    stagePillText: { ...typography.micro, fontWeight: "700", color: colors.textMuted },
    stagePillNum: { ...typography.micro, fontWeight: "800", color: colors.text },

    appCard: { padding: 14, gap: 10 },
    appTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    appMain: { flex: 1, minWidth: 0, gap: 3 },
    title: { fontSize: 15, fontWeight: "800", color: colors.text },
    meta: { fontSize: 12, color: colors.textMuted },
    stageBadge: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    stageText: { fontSize: 10, fontWeight: "800", color: colors.primary },

    /** 流水线进度条 */
    progressTrack: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    progressFill: { height: 4, borderRadius: 999, backgroundColor: colors.primary },

    stageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
    },
    stageRowLabel: { flex: 1, ...typography.caption, fontWeight: "700", color: colors.textMuted },
    stageRowValue: { ...typography.caption, fontWeight: "800", color: colors.text },
    currentTag: {
      ...typography.micro,
      fontWeight: "800",
      color: colors.primary,
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      overflow: "hidden",
    },

    /** 分页条 */
    pager: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      paddingTop: 6,
    },
    pagerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: colors.primarySoft,
    },
    pagerBtnOff: { backgroundColor: colors.surfaceMuted },
    pagerBtnText: { ...typography.caption, fontWeight: "800", color: colors.primary },
    pagerTextOff: { color: colors.textFaint },
    pagerMid: { alignItems: "center", gap: 1 },
    pagerPage: { ...typography.caption, fontWeight: "800", color: colors.text },
    pagerCount: { ...typography.micro, color: colors.textMuted },

    emptyBox: { alignItems: "center", gap: 6, paddingVertical: 44 },
    emptyText: { fontSize: 14, fontWeight: "800", color: colors.text },
    emptyHint: { fontSize: 12, color: colors.textFaint, textAlign: "center" },
  });
