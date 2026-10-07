import { useEffect, useMemo, useState } from "react";
import { typography } from "@/theme/tokens";
import Animated from "react-native-reanimated";
import { Dimensions, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { resolveEdgeSwipeEnabled } from "@/lib/edge-swipe";
import { secureToken } from "@/lib/secure-token";
import { formatDiagnostics, judgeTouch, type DiagnosticsInput } from "@/lib/diagnostics";
import { APP_VERSION_NAME } from "@/lib/ota";
import { clearLocalDiagnostics, isCaptureEnabled, readSnapshot, setCaptureEnabled } from "@/lib/crash-capture";
import { collectDiagnostics, readPendingCrash, uploadDiagnostics } from "@/lib/crash-upload";
import { buildReportText, type ExitInfo } from "@/lib/crash-report";

/**
 * 「问题诊断」页（触控自检）——给内测用户 / 客服排障用。
 *
 * 为什么需要它：OPPO/ColorOS 上的「界面正常但点不动」有三类完全不同的成因
 * （ROM 拦截触摸 / 我们的覆盖层吃掉触摸 / JS 线程卡死），没有真机日志时
 * 无法区分。这页把三类判据一次收齐，用户点几下即可复制一段文本发给我们。
 *
 * 对其它品牌的影响：零。它只是一个隐藏路由（底部导航不显示），
 * 不注册任何原生代码，不改变任何既有页面行为。
 */
export default function DiagnosticsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();

  const storedEdgeSwipe = useAppStore((s) => s.edgeSwipeEnabled);
  const pendingSync = useAppStore((s) => s.pendingChanges.length);

  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [heartbeat, setHeartbeat] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [lastTap, setLastTap] = useState<{ x: number; y: number } | null>(null);
  const [firstTouchMs, setFirstTouchMs] = useState<number | null>(null);
  /** null = 读取超时/抛错；true = 读到令牌；false = 正常读到「无令牌」 */
  const [tokenProbe, setTokenProbe] = useState<boolean | null>(null);

  /** v1.32.0 崩溃取证：开关 / 上次退出记录 / 本机面包屑条数 / 上传状态 */
  const [captureOn, setCaptureOn] = useState(true);
  const [lastExit, setLastExit] = useState<ExitInfo | null>(null);
  const [crumbCount, setCrumbCount] = useState<number | null>(null);
  const [crashBusy, setCrashBusy] = useState(false);
  const [crashMsg, setCrashMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setCaptureOn(isCaptureEnabled());
      const [pending, snap] = await Promise.all([readPendingCrash(), readSnapshot()]);
      if (!alive) return;
      setLastExit(pending.exit);
      setCrumbCount(snap?.crumbs.length ?? 0);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const fmtTs = (ms: number) => new Date(ms).toISOString().replace("T", " ").slice(0, 19);

  const toggleCapture = async () => {
    const next = !captureOn;
    await setCaptureEnabled(next);
    setCaptureOn(next);
    setCrashMsg(next ? "已开启记录（只写本机，不会自动上传）" : "已暂停记录（本机已有现场保留，可上传或清空）");
  };

  const uploadCrash = async () => {
    setCrashBusy(true);
    setCrashMsg(null);
    const r = await uploadDiagnostics("问题诊断页手动上传");
    setCrashBusy(false);
    setCrashMsg(r.ok ? "上传成功" + (r.id ? "（id " + r.id + "）" : "") : "上传失败：" + r.error);
    if (r.ok) setCrumbCount((await readSnapshot())?.crumbs.length ?? 0);
  };

  const shareCrash = async () => {
    const payload = await collectDiagnostics("分享诊断包");
    await Share.share({ message: buildReportText(payload) }).catch(() => {});
  };

  const clearCrash = async () => {
    await clearLocalDiagnostics();
    setCrumbCount(0);
    setCrashMsg("已清空本机现场");
  };

  // 现场探测安全存储（ColorOS 的 Keystore 卡顿就体现在这里）：
  // 区分「本来就没登录（读得到，只是空）」与「读取超时/失败」两件完全不同的事。
  useEffect(() => {
    let alive = true;
    const started = Date.now();
    void secureToken.loadWithTimeout(1500).then((t) => {
      if (!alive) return;
      if (t) setTokenProbe(true);
      else setTokenProbe(Date.now() - started >= 1500 ? null : false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // JS 心跳：数字不涨 = JS 线程被卡住（这类问题界面会整体无响应）
  useEffect(() => {
    const id = setInterval(() => {
      setHeartbeat((n) => n + 1);
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const { width, height, scale, fontScale } = useMemo(() => {
    const w = Dimensions.get("window");
    return { width: w.width, height: w.height, scale: w.scale, fontScale: w.fontScale };
  }, []);
  const screenSize = useMemo(() => {
    const s = Dimensions.get("screen");
    return { width: s.width, height: s.height };
  }, []);

  const constants = (Platform.constants ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof constants[k] === "string" ? (constants[k] as string) : undefined);

  const input: DiagnosticsInput = {
    appVersion: APP_VERSION_NAME,
    platform: Platform.OS,
    osVersion: Platform.Version as string | number,
    brand: str("Brand"),
    manufacturer: str("Manufacturer"),
    model: str("Model"),
    release: str("Release"),
    uiMode: str("uiMode"),
    window: { width, height, scale, fontScale },
    screen: screenSize,
    insets: { top: insets.top, bottom: insets.bottom, left: insets.left, right: insets.right },
    heartbeatTicks: heartbeat,
    uptimeMs: now - startedAt,
    firstTouchMs,
    tapCount,
    lastTap,
    edgeSwipeEnabled: resolveEdgeSwipeEnabled(storedEdgeSwipe, Platform.OS),
    tokenLoaded: tokenProbe,
    pendingSync,
  };
  const verdict = judgeTouch({ tapCount, heartbeatTicks: heartbeat });
  const report = formatDiagnostics(input);

  const onTap = (x: number, y: number) => {
    setFirstTouchMs((prev) => (prev === null ? now - startedAt : prev));
    setTapCount((n) => n + 1);
    setLastTap({ x, y });
  };

  const share = () => {
    void Share.share({ message: report }).catch(() => {});
  };

  const verdictStyle =
    verdict.level === "ok" ? styles.verdictOk : verdict.level === "warn" ? styles.verdictWarn : styles.verdictPending;

  return (
    <View style={styles.root}>
      <ScreenHeaderStickyBar title="问题诊断" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]}
        showsVerticalScrollIndicator={false}
      >
      <ScreenHeaderLargeTitle title="问题诊断" subtitle="触摸自检 · 排障用" />
        <Card title="触摸测试区" subtitle="在这一片区域里点几下">
          <Pressable
            style={styles.pad}
            onPress={(e) => onTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
            accessibilityRole="button"
            accessibilityLabel="触摸测试区"
          >
            <Text style={styles.padCount}>{tapCount}</Text>
            <Text style={styles.padHint}>
              {tapCount === 0 ? "点这里开始自检" : lastTap ? `最后落点 (${Math.round(lastTap.x)}, ${Math.round(lastTap.y)})` : ""}
            </Text>
          </Pressable>
          <View style={styles.buttonRow}>
            <Button label="按钮 A" onPress={() => onTap(0, 0)} />
            <Button label="按钮 B" onPress={() => onTap(0, 0)} />
            <Button label="返回" onPress={() => router.back()} />
          </View>
          <Text style={styles.note}>
            判断方法：数字会涨 = 触摸能到达 App；不涨 = 触摸在到达 App 前被拦截（系统悬浮窗 / 录屏 / 无障碍服务 /
            应用兼容模式），不是页面布局问题。
          </Text>
        </Card>

        {/*
          v1.32.0 崩溃取证（招花滑动闪退）。为什么要有这一块：
          闪退是**进程级死亡**，崩溃那一刻 JS 已死 → 写不了文件、也发不了请求。
          所以做成两半：App 持续把面包屑写本机（documentDirectory/diag），
          崩溃后**下次冷启动**向系统要"上次退出原因 + native 崩溃栈"（Android 11+ ApplicationExitInfo），
          再由用户在这里点一下上传 —— 默认不自动上传。
        */}
        <Card title="崩溃取证" subtitle="闪退后把这段日志发给开发者">
          <View style={styles.buttonRow}>
            <Button label={captureOn ? "记录中 · 点此暂停" : "已暂停 · 点此开启"} onPress={() => void toggleCapture()} />
          </View>
          <Text style={styles.note}>
            记录内容：页面切换、招花列表滚到第几条、点了哪个岗位、筛选口径、JS 错误。
            只写本机；只有你点「上传」才会发出去，上传前自动抹掉 token / cookie / 邮箱 / 手机号。
          </Text>
          <Text style={styles.note}>
            上次退出：
            {lastExit
              ? lastExit.reason + "（code " + lastExit.reasonCode + "）· " + fmtTs(lastExit.timestamp)
              : "无记录（Android < 11 或原生模块不可用）"}
          </Text>
          <Text style={styles.note}>本机面包屑：{crumbCount === null ? "读取中…" : crumbCount + " 条"}</Text>
          <View style={styles.buttonRow}>
            <Button label={crashBusy ? "上传中…" : "上传诊断包"} onPress={() => void uploadCrash()} />
            <Button label="分享文本" onPress={() => void shareCrash()} />
            <Button label="清空" onPress={() => void clearCrash()} />
          </View>
          {crashMsg ? <Text style={styles.note}>{crashMsg}</Text> : null}
          {lastExit?.trace ? (
            <Text style={styles.report} selectable>
              {lastExit.trace.slice(0, 1500)}
            </Text>
          ) : null}
        </Card>

        <Card title="自检结论" subtitle="可直接复制发给开发者">
          <View style={[styles.verdict, verdictStyle]}>
            <Text style={styles.verdictTitle}>{verdict.title}</Text>
            <Text style={styles.verdictDetail}>{verdict.detail}</Text>
          </View>
          <Text style={styles.report} selectable>
            {report}
          </Text>
          <Button label="复制 / 分享诊断信息" onPress={share} />
        </Card>
      </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
    pad: {
      height: 132,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    padCount: { fontSize: 40, fontWeight: "700", color: colors.text },
    padHint: { marginTop: 4, fontSize: typography.caption.fontSize, color: colors.textMuted },
    buttonRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    note: { marginTop: 10, fontSize: typography.caption.fontSize, lineHeight: 18, color: colors.textMuted },
    verdict: { borderRadius: 12, padding: 12, marginBottom: 10 },
    verdictOk: { backgroundColor: colors.successSoft ?? colors.surface },
    verdictWarn: { backgroundColor: colors.warningSoft ?? colors.surface },
    verdictPending: { backgroundColor: colors.surface },
    verdictTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 },
    verdictDetail: { fontSize: typography.caption.fontSize, lineHeight: 18, color: colors.textMuted },
    report: { fontSize: 11, lineHeight: 17, color: colors.textMuted, marginBottom: 10 },
  });
