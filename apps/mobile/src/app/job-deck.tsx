import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { JobPostingListItem } from "@learn-workbench/shared/schemas";
import { JobDeck } from "@/components/career/job-deck";
import { InlineToast, TOAST_DEFAULT_LIFE_MS } from "@/components/toast";
import { Icon } from "@/components/ui/icon";
import { fetchJobs, applyToJob, toggleJobFavorite } from "@/lib/jobs";
import { friendlyError } from "@/lib/friendly-error";
import { haptics } from "@/lib/haptics";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 岗位卡组页（二级页）。
 *
 * 入口：职业 hub 的「卡片浏览」、岗位列表右上角。
 * 数据全部走 lib/jobs.ts 的真实接口：
 *  - GET  /api/jobs              列表（pageSize 20）
 *  - POST /api/jobs/favorites    收藏切换
 *  - POST /api/jobs/applications 一键投递
 */
export default function JobDeckScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((state) => state.token);

  const [jobs, setJobs] = useState<JobPostingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchJobs({ page: 1, pageSize: 20, sort: "new" });
      setJobs(data.jobs);
    } catch (e) {
      setError(friendlyError(e, "岗位加载失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 首屏拉取：load 内部只在请求完成后 setState
    void load();
  }, [load]);

  const onToggleFavorite = useCallback(async (job: JobPostingListItem) => {
    if (!token) {
      // 未登录不弹系统 Alert：直接进全屏玻璃登录页，登录后返回继续操作
      router.push("/auth" as never);
      return;
    }
    setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, isFav: !item.isFav } : item)));
    try {
      const fav = await toggleJobFavorite(job.id);
      setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, isFav: fav } : item)));
      setToast({ message: fav ? "已收藏" : "已取消收藏", kind: "success" });
    } catch (e) {
      setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, isFav: job.isFav } : item)));
      haptics.error();
      setToast({ message: friendlyError(e, "收藏失败"), kind: "error" });
    }
  }, [token]);

  const onApply = useCallback(async (job: JobPostingListItem) => {
    if (!token) {
      // 未登录不弹系统 Alert：直接进全屏玻璃登录页，登录后返回继续操作
      router.push("/auth" as never);
      return;
    }
    setApplyingId(job.id);
    try {
      await applyToJob(job.id);
      haptics.success();
      setToast({ message: "投递成功 · 已加入我的求职", kind: "success" });
    } catch (e) {
      haptics.error();
      setToast({ message: friendlyError(e, "投递失败，请稍后重试"), kind: "error" });
    } finally {
      setApplyingId(null);
    }
  }, [token]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Pressable
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <Icon name="chevron" size={20} weight="bold" color={colors.text} style={styles.backIcon} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>职业 · 卡片浏览</Text>
          <Text style={styles.title} accessibilityRole="header">
            岗位卡组
          </Text>
        </View>
        <Pressable
          hitSlop={10}
          onPress={() => router.push("/jobs" as never)}
          style={styles.listBtn}
          accessibilityRole="button"
          accessibilityLabel="切换到列表"
        >
          <Icon name="list" size={18} weight="regular" color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); void load(); }}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>暂时没有可浏览的岗位</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <JobDeck
            jobs={jobs}
            applyingId={applyingId}
            onApply={(job) => void onApply(job)}
            onToggleFavorite={(job) => void onToggleFavorite(job)}
            onOpen={(job) => router.push(`/job-detail?id=${job.id}` as never)}
          />
          <Text style={styles.hint}>左右滑动切换 · 点「一键投递」加入我的求职</Text>
        </View>
      )}

      {toast ? (
        <InlineToast
          message={toast.message}
          kind={toast.kind}
          lifeMs={TOAST_DEFAULT_LIFE_MS}
          onClose={() => setToast(null)}
          style={[styles.toast, { bottom: insets.bottom + 24 }]}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.canvas },
    header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
    backIcon: { transform: [{ rotate: "180deg" }] },
    headerText: { flex: 1 },
    eyebrow: { ...typography.eyebrow, color: colors.textMeta },
    title: { ...typography.title2, color: colors.text },
    listBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.lg },
    hint: { ...typography.meta, color: colors.textMeta, textAlign: "center" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.xl },
    errorText: { ...typography.body, color: colors.textMuted, textAlign: "center" },
    retryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
    retryText: { ...typography.caption, fontWeight: "700", color: colors.primary },
    toast: { position: "absolute", left: spacing.lg, right: spacing.lg },
  });