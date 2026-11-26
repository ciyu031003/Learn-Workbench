import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Icon } from "@/components/ui/icon";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, type ThemeColors } from "@/theme/tokens";

/**
 * 健康打印分享卡（对齐 demo「打印条 + 纸张打印 + 条形码」）。
 *
 * 一张卡统一承载睡眠 / 饮食 / 训练 / 饮水四项数据：
 * 1. 顶部是深色打印条，纸张从条口向下吐出；
 * 2. 纸面上四条数据按顺序逐条"打印"出来（错峰淡入）；
 * 3. 底部是与本次数据绑定的条形码（同 seed 同码），便于分享 / 扫码查看；
 * 4. 「打印并分享」用 view-shot 截图 + 系统分享面板，失败时给出提示。
 *
 * 动效全部由单个 shared value 驱动；减弱动态时直接落终态。
 */

export type HealthPrintData = {
  rangeLabel: string;
  dateText: string;
  sleepHours: number | null;
  kcal: number;
  workoutMinutes: number;
  waterMl: number;
  seed: string;
};

const PAPER_H = 332;

export function HealthPrintShare({
  visible,
  data,
  onClose,
}: {
  visible: boolean;
  data: HealthPrintData;
  onClose: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const reduced = useReducedMotion();
  const print = useSharedValue(0);
  const shotRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    print.value = 0;
    print.value = reduced ? 1 : withDelay(140, withTiming(1, { duration: 1250 }));
  }, [print, reduced, visible]);

  const paperStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(print.value, [0, 0.58], [-PAPER_H, 0], Extrapolation.CLAMP) }],
  }));

  const shortCode = useMemo(() => {
    let hash = 7;
    for (let i = 0; i < data.seed.length; i++) hash = (hash * 31 + data.seed.charCodeAt(i)) % 100000;
    return "HW-" + String(hash).padStart(5, "0");
  }, [data.seed]);

  const rows = [
    { key: "sleep", label: "睡眠", value: data.sleepHours === null ? "—" : data.sleepHours.toFixed(1), unit: "h" },
    { key: "food", label: "饮食", value: String(data.kcal), unit: "kcal" },
    { key: "train", label: "训练", value: String(data.workoutMinutes), unit: "min" },
    { key: "water", label: "饮水", value: String(data.waterMl), unit: "ml" },
  ] as const;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    setNotice(null);
    try {
      const uri = await captureRef(shotRef, { format: "png", quality: 1 });
      if (!(await Sharing.isAvailableAsync())) {
        setNotice("当前设备不支持系统分享");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "分享健康打印卡" });
      haptics.success();
    } catch {
      haptics.error();
      setNotice("生成图片失败，请稍后重试");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="关闭分享卡片" />
        <ScrollView contentContainerStyle={styles.center} showsVerticalScrollIndicator={false}>
          <View style={styles.printer} ref={shotRef} collapsable={false}>
            {/* 打印条 */}
            <View style={styles.bar}>
              <View style={styles.barLed} />
              <Text style={styles.barText}>LEARN WORKBENCH · HEALTH PRINTER</Text>
              <View style={styles.barSlot} />
            </View>

            {/* 纸张窗口：内容从打印条下方吐出 */}
            <View style={styles.paperWindow}>
              <Animated.View style={[styles.paper, paperStyle]}>
                <View style={styles.paperHead}>
                  <Text style={styles.paperKicker}>H E A L T H · R E C E I P T</Text>
                  <Text style={styles.paperTitle}>{data.rangeLabel}</Text>
                  <Text style={styles.paperDate}>{data.dateText}</Text>
                </View>

                <View style={styles.dash} />

                {rows.map((row, index) => (
                  <PrintRow
                    key={row.key}
                    label={row.label}
                    value={row.value}
                    unit={row.unit}
                    index={index}
                    progress={print}
                  />
                ))}

                <View style={styles.dash} />

                <Barcode seed={data.seed} progress={print} />

                <Text style={styles.foot}>SCAN TO VIEW · {shortCode}</Text>
              </Animated.View>
            </View>
          </View>

          <Text style={styles.hint}>睡眠 · 饮食 · 训练 · 饮水，四项数据同卡</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                haptics.soft();
                onClose();
              }}
              style={styles.secondary}
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              <Text style={styles.secondaryText}>关闭</Text>
            </Pressable>
            <Pressable
              onPress={() => void share()}
              disabled={sharing}
              style={styles.primary}
              accessibilityRole="button"
              accessibilityLabel="打印并分享健康卡"
            >
              <Icon name="sparkle" size={16} weight="fill" color={colors.canvas} />
              <Text style={styles.primaryText}>{sharing ? "生成中…" : "打印并分享"}</Text>
            </Pressable>
          </View>

          {notice ? (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="关闭分享卡片"
        >
          <Icon name="close" size={18} weight="bold" color={colors.text} />
        </Pressable>
      </View>
    </Modal>
  );
}

function PrintRow({
  label,
  value,
  unit,
  index,
  progress,
}: {
  label: string;
  value: string;
  unit: string;
  index: number;
  progress: SharedValue<number>;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const start = 0.42 + index * 0.1;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [start, start + 0.12], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [start, start + 0.12], [6, 0], Extrapolation.CLAMP) }],
  }));
  return (
    <Animated.View style={[styles.row, style]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowDots} />
      <Text style={styles.rowValue}>{value}</Text>
      <Text style={styles.rowUnit}>{unit}</Text>
    </Animated.View>
  );
}

/** 由 seed 决定的条形码：同一天 / 同一组数据恒生成同一张码 */
function Barcode({ seed, progress }: { seed: string; progress: SharedValue<number> }) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const bars = useMemo(() => {
    const out: { w: number; gap: number }[] = [];
    let hash = 7;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
    for (let i = 0; i < 44; i++) {
      hash = (hash * 1103515245 + 12345) % 2147483647;
      const v = Math.abs(hash) % 100;
      out.push({ w: v < 34 ? 1 : v < 68 ? 2 : 3, gap: v % 7 === 0 ? 3 : 2 });
    }
    return out;
  }, [seed]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.78, 0.9], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View style={[styles.barcode, style]} accessibilityLabel="健康数据条形码">
      {bars.map((bar, index) => (
        <View
          key={index}
          style={{ width: bar.w, height: 34, marginRight: bar.gap, backgroundColor: dark ? "#1B252C" : "#14202A" }}
        />
      ))}
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "rgba(8,14,18,0.62)", justifyContent: "center" },
    center: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.lg },
    printer: { width: "100%", maxWidth: 360 },
    bar: {
      height: 46,
      borderRadius: 16,
      backgroundColor: "#1A242B",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: "rgba(255,255,255,0.14)",
    },
    barLed: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#5FBF7D" },
    barText: { flex: 1, fontSize: 9, lineHeight: 12, fontWeight: "700", letterSpacing: 1.1, color: "rgba(255,255,255,0.62)" },
    barSlot: { width: 56, height: 5, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.55)" },
    paperWindow: { height: PAPER_H, overflow: "hidden", alignItems: "center" },
    paper: {
      width: "94%",
      height: PAPER_H,
      backgroundColor: "#FBF8F2",
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
      paddingHorizontal: 18,
      paddingTop: 16,
      ...shadows.floating,
    },
    paperHead: { alignItems: "center", gap: 2 },
    paperKicker: { fontSize: 8, lineHeight: 11, fontWeight: "700", letterSpacing: 1.6, color: "#7C858A" },
    paperTitle: { fontSize: 19, lineHeight: 24, fontWeight: "800", color: "#14202A", letterSpacing: 1 },
    paperDate: { fontSize: 10, lineHeight: 14, fontWeight: "500", color: "#8A9297" },
    dash: { height: 1, backgroundColor: "rgba(20,32,42,0.16)", marginVertical: 10 },
    row: { flexDirection: "row", alignItems: "flex-end", gap: 6, minHeight: 27 },
    rowLabel: { fontSize: 12, lineHeight: 16, fontWeight: "600", color: "#5C686E" },
    rowDots: { flex: 1, borderBottomWidth: 1, borderStyle: "dotted", borderColor: "rgba(20,32,42,0.22)", marginBottom: 3 },
    rowValue: { fontSize: 16, lineHeight: 20, fontWeight: "800", color: "#14202A", fontVariant: ["tabular-nums"] },
    rowUnit: { fontSize: 9, lineHeight: 12, fontWeight: "600", color: "#8A9297", marginBottom: 2 },
    barcode: { flexDirection: "row", alignItems: "flex-end", height: 34, marginTop: 2 },
    foot: { marginTop: 5, fontSize: 8, lineHeight: 11, fontWeight: "600", letterSpacing: 0.7, color: "#9AA1A5" },
    hint: { fontSize: 12, lineHeight: 17, fontWeight: "500", color: "rgba(255,255,255,0.72)" },
    actions: { flexDirection: "row", gap: spacing.sm, width: "100%", maxWidth: 360 },
    secondary: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: "rgba(255,255,255,0.24)",
    },
    secondaryText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
    primary: {
      flex: 1.4,
      minHeight: 48,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      backgroundColor: colors.primary,
    },
    primaryText: { fontSize: 14, fontWeight: "700", color: colors.canvas },
    notice: { fontSize: 12, color: "#FFD9D9" },
    close: {
      position: "absolute",
      right: 18,
      top: Platform.OS === "ios" ? 58 : 24,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
  });