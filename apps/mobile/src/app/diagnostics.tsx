import { useEffect, useMemo, useState } from "react";
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
    padHint: { marginTop: 4, fontSize: 12, color: colors.textMuted },
    buttonRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    note: { marginTop: 10, fontSize: 12, lineHeight: 18, color: colors.textMuted },
    verdict: { borderRadius: 12, padding: 12, marginBottom: 10 },
    verdictOk: { backgroundColor: colors.successSoft ?? colors.surface },
    verdictWarn: { backgroundColor: colors.warningSoft ?? colors.surface },
    verdictPending: { backgroundColor: colors.surface },
    verdictTitle: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 },
    verdictDetail: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
    report: { fontSize: 11, lineHeight: 17, color: colors.textMuted, marginBottom: 10 },
  });
