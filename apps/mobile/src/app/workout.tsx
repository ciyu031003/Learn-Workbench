import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, Text, View } from "react-native";
import { router } from "expo-router";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { setNavPendingParams } from "@/lib/nav-pending";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { friendlyError } from "@/lib/friendly-error";
import { V15WorkoutDashboard } from "@/components/workout/v15-workout-dashboard";
import { V15Card, V15Scroll } from "@/components/v15/v15-ui";
import { useV15 } from "@/components/v15/v15-theme";
import type { Workout } from "@learn-workbench/shared/schemas";
import { toDateKey } from "@learn-workbench/shared/dates";

/**
 * 训练（V15）。
 *
 * 展示按 demo renderWorkout 重做：本周负荷 → 恢复建议 → 周柱状图 → 动作构成
 * → 最近训练。记录 / 编辑继续走全屏 /workout-add；保存后 focus 刷新。
 */
export default function WorkoutScreen() {
  const v15 = useV15();
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const token = useAppStore((s) => s.token);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const headers = useCallback(
    (): Record<string, string> => (token ? { Authorization: "Bearer " + token } : {}),
    [token]
  );

  const load = useCallback(async () => {
    const fetchPage = async (bust: boolean) => {
      const url = getApiUrl() + "/api/workouts?days=60" + (bust ? "&_=" + Date.now() : "");
      return fetch(url, { headers: { ...headers(), "Cache-Control": "no-cache" } });
    };
    try {
      let r = await fetchPage(false);
      // 304 没有响应体：缓存命中时补一次 cache-bust 请求，别让列表停在空数据上
      if (r.status === 304) r = await fetchPage(true);
      if (!r.ok) {
        setLoadError("服务暂时不可用（" + r.status + "）");
        return;
      }
      let text = await r.text();
      if (!text) {
        r = await fetchPage(true);
        if (!r.ok) {
          setLoadError("服务暂时不可用（" + r.status + "）");
          return;
        }
        text = await r.text();
      }
      // 空响应体保留现状：旧实现直接 r.json() 会抛错并被 catch 吞掉，
      // 保存成功的训练就永远不显示（v2.8.6 真机测试发现）。
      if (!text) {
        setLoadError(null);
        return;
      }
      const d = JSON.parse(text) as { workouts?: Workout[] };
      setWorkouts(Array.isArray(d.workouts) ? d.workouts : []);
      setLoadError(null);
    } catch {
      // 离线保留现状，但把状态说清楚，别让用户以为"训练丢了"
      setLoadError("网络或数据异常");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  useFocusRefresh(load);
  const { control } = usePullRefresh(load);

  const openCreate = useCallback(() => {
    setNavPendingParams("workout-add", {});
    router.push("/workout-add" as never);
  }, []);

  const openEdit = useCallback((workout: Workout) => {
    setNavPendingParams("workout-add", { id: String(workout.id) });
    router.push("/workout-add" as never);
  }, []);

  const removeWorkout = useCallback(
    (workout: Workout) => {
      Alert.alert("删除这次训练？", workout.name + " · " + workout.exercisedOn, [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              const r = await fetch(getApiUrl() + "/api/workouts/" + workout.id, { method: "DELETE", headers: headers() });
              if (!r.ok) throw new Error("删除失败");
              await load();
            } catch (error) {
              Alert.alert("删除失败", friendlyError(error, "请稍后重试"));
            }
          },
        },
      ]);
    },
    [headers, load]
  );

  return (
    <View style={{ flex: 1, backgroundColor: v15.canvas }}>
      <V15Scroll p={v15} refreshControl={<RefreshControl {...control} />}>
        {loadError ? (
          <V15Card p={v15} style={{ marginBottom: 12 }}>
            <Text style={{ color: v15.ink, fontWeight: "700" }}>训练数据没刷新出来</Text>
            <Text style={{ color: v15.sub, marginTop: 4, lineHeight: 19 }}>
              {loadError}。下拉可重试；已保存的记录不会丢失。
            </Text>
          </V15Card>
        ) : null}
        <V15WorkoutDashboard
          workouts={workouts}
          todayKey={todayKey}
          loading={loading}
          onAdd={openCreate}
          onEdit={openEdit}
          onDelete={removeWorkout}
        />
      </V15Scroll>
    </View>
  );
}
