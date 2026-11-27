import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, Share, View } from "react-native";
import { router } from "expo-router";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { setNavPendingParams } from "@/lib/nav-pending";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { haptics } from "@/lib/haptics";
import {
  mergeHealthNights,
  normalizeSleepNights,
  sleepApi,
  type SleepHealthRead,
  type SleepHealthStatus,
  type SleepNight,
} from "@/lib/sleep-api";
import { todayISO } from "@learn-workbench/shared/dates";
import { V15SleepDashboard } from "@/components/sleep/v15-sleep-dashboard";
import { V15Scroll } from "@/components/v15/v15-ui";
import { useV15 } from "@/components/v15/v15-theme";
import { useSleepTarget } from "@/lib/health/use-sleep-target";

/**
 * 睡眠分析（V15）。
 *
 * 展示按 demo renderSleep 重做：评分 hero → 分期结构 → 关键指标 → 7 晚趋势
 * → 规律性 → 睡眠债 → 洞察 → 最近记录 → 数据源。补录 / 编辑改为全屏 /sleep-add，
 * 仍保留 Health Connect 授权、重新读取与小米同步路径。
 */
export default function SleepScreen() {
  const v15 = useV15();
  const todayKey = useMemo(() => todayISO(), []);
  const sleepTargetMin = useSleepTarget();

  const [localNights, setLocalNights] = useState<SleepNight[]>([]);
  const [healthNights, setHealthNights] = useState<SleepNight[]>([]);
  const [healthStatus, setHealthStatus] = useState<SleepHealthStatus | null>(null);
  const [healthCount, setHealthCount] = useState(0);
  const [healthDiagnostics, setHealthDiagnostics] = useState<SleepHealthRead["diagnostics"] | null>(null);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const nights = useMemo(() => mergeHealthNights(localNights, healthNights), [localNights, healthNights]);

  const loadLocal = useCallback(async () => {
    const local = await sleepApi.loadSleepNights();
    setLocalNights(normalizeSleepNights(local));
  }, []);

  const readHealth = useCallback(async (options: { requestPermission?: boolean } = {}) => {
    setReading(true);
    setHealthMessage(null);
    const result = await sleepApi.readSleepNightsFromHealth({
      days: 31,
      requestPermission: options.requestPermission === true,
    });
    setHealthStatus(result.status);
    setHealthCount(result.nights.length);
    setHealthDiagnostics(result.diagnostics ?? null);
    setHealthNights(result.nights);
    setReading(false);
    return result;
  }, []);

  const refresh = useCallback(async () => {
    await loadLocal();
    await readHealth();
  }, [loadLocal, readHealth]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        const healthTask = readHealth();
        await loadLocal();
        if (active) setLoading(false);
        await healthTask;
      })();
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [loadLocal, readHealth]);

  useFocusRefresh(loadLocal);
  const { control } = usePullRefresh(refresh);

  const authorize = useCallback(async () => {
    haptics.light();
    const result = await readHealth({ requestPermission: true });
    if (result.status !== "denied" && result.nights.length > 0) {
      setSelectedDate(result.nights[0].date);
      return;
    }
    const opened = await sleepApi.openSleepSettings();
    setHealthMessage(
      opened
        ? "系统里还没放开睡眠读取权限，请在健康数据里打开「睡眠」"
        : "没找到系统健康数据设置，请在系统「健康数据 / Health Connect」里授权"
    );
  }, [readHealth]);

  const refreshHealth = useCallback(async () => {
    haptics.light();
    const result = await readHealth();
    if (result.nights.length > 0) setSelectedDate(result.nights[0].date);
  }, [readHealth]);

  const openSettings = useCallback(() => {
    haptics.light();
    void sleepApi.openSleepSettings();
  }, []);

  const openAdd = useCallback(() => {
    haptics.light();
    router.push("/sleep-add" as never);
  }, []);

  const openEdit = useCallback((night: SleepNight) => {
    haptics.light();
    // 优先把记录值带过去：Health Connect 记录不在本机手动列表里，只传 date 会打开空表单
    setNavPendingParams("sleep-add", {
      date: night.date,
      durationMin: String(Math.round(night.durationMin)),
      bedtime: night.bedtime ?? "",
      wakeTime: night.wakeTime ?? "",
      deep: night.stages ? String(Math.round(night.stages.deep)) : "",
      rem: night.stages ? String(Math.round(night.stages.rem)) : "",
      awakeCount: night.awakeCount === null ? "" : String(Math.round(night.awakeCount)),
      efficiency: night.efficiencyPct === null ? "" : String(Math.round(night.efficiencyPct)),
    });
    router.push({ pathname: "/sleep-add", params: { date: night.date } } as never);
  }, []);

  const share = useCallback(() => {
    const latest = nights[0] ?? null;
    if (!latest) {
      void Share.share({ message: "睡眠分析 · 还没有记录，今晚开始记一晚了。" });
      return;
    }
    const score = sleepApi.sleepScore(latest);
    const text =
      "睡眠分析 · " +
      latest.date +
      " · " +
      sleepApi.formatSleepMinutesShort(latest.durationMin) +
      " · 评分 " +
      score +
      " · " +
      sleepApi.qualityLabel(score) +
      (latest.stages ? " · 深睡 " + Math.round(latest.stages.deep) + " 分钟" : "");
    void Share.share({ message: text });
  }, [nights]);

  return (
    <View style={{ flex: 1, backgroundColor: v15.canvas }}>
      <V15Scroll p={v15} refreshControl={<RefreshControl {...control} />}>
        <V15SleepDashboard
          nights={nights}
          todayKey={todayKey}
          loading={loading || reading}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onAdd={openAdd}
          onEdit={openEdit}
          onShare={share}
          healthStatus={healthStatus}
          healthCount={healthCount}
          healthDiagnostics={healthDiagnostics}
          healthMessage={healthMessage}
          reading={reading}
          onAuthorize={() => void authorize()}
          onReRead={() => void refreshHealth()}
          onOpenHealthSettings={openSettings}
          targetMin={sleepTargetMin}
        />
      </V15Scroll>
    </View>
  );
}
