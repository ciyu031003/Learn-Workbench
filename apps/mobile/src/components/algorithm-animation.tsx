import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { algorithmAnimations } from "@learn-workbench/content";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

const FRAME_MS = 1200;

/**
 * 算法动图播放器（移动端）：逐帧播放 `algorithmAnimations[key]` 的多帧 SVG。
 *
 * react-native-svg 不支持 SMIL(<animate>)，所以与 Web 端统一用「按帧切换」实现动图；
 * 内容由 `packages/content` 自产并已过内容质量门禁（无危险 HTML：script、style、事件属性、javascript 伪协议）。
 */
export function AlgorithmAnimation({ keys }: { keys: string[] }): React.JSX.Element | null {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [keyIndex, setKeyIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [boxWidth, setBoxWidth] = useState(0);

  const safeIndex = Math.min(keyIndex, keys.length - 1);
  const activeKey = keys[safeIndex];
  const frames = algorithmAnimations[activeKey] ?? [];
  const total = frames.length;

  useEffect(() => {
    if (!playing || total <= 1) return;
    const timer = setInterval(() => {
      setFrame((previous) => (previous + 1) % total);
    }, FRAME_MS);
    return () => clearInterval(timer);
  }, [playing, total]);

  if (total === 0) return null;

  const current = frames[Math.min(frame, total - 1)];
  const viewBox = current.svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const ratio = viewBox ? Number(viewBox[2]) / Number(viewBox[1]) : 0.55;

  const selectKey = (index: number) => {
    setKeyIndex(index);
    setFrame(0);
    setPlaying(true);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.headTitle}>算法演示（SVG 动图）</Text>
        {keys.length > 1 ? (
          <View style={styles.tabs}>
            {keys.map((key, index) => (
              <Pressable
                key={key}
                onPress={() => selectKey(index)}
                style={[styles.tab, index === safeIndex && styles.tabActive]}
              >
                <Text style={[styles.tabText, index === safeIndex && styles.tabTextActive]}>
                  {key.replace(/^anim-/, "").replace(/-/g, " ")}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.canvas} onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}>
        {boxWidth > 0 ? (
          <SvgXml xml={current.svg} width={boxWidth} height={Math.round(boxWidth * ratio)} />
        ) : null}
      </View>

      <View style={styles.captionBox}>
        <Text style={styles.caption}>{current.caption}</Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => setPlaying((value) => !value)}
          style={styles.controlButton}
          accessibilityRole="button"
        >
          <Text style={styles.controlText}>{playing ? "暂停" : "播放"}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setPlaying(false);
            setFrame(0);
          }}
          style={styles.controlButton}
          accessibilityRole="button"
        >
          <Text style={styles.controlText}>重放</Text>
        </Pressable>
        <View style={styles.spacer} />
        <Pressable
          onPress={() => {
            setPlaying(false);
            setFrame((previous) => (previous - 1 + total) % total);
          }}
          style={styles.stepButton}
          accessibilityLabel="上一帧"
        >
          <Text style={styles.stepText}>‹</Text>
        </Pressable>
        <Text style={styles.counter}>
          {Math.min(frame, total - 1) + 1} / {total}
        </Text>
        <Pressable
          onPress={() => {
            setPlaying(false);
            setFrame((previous) => (previous + 1) % total);
          }}
          style={styles.stepButton}
          accessibilityLabel="下一帧"
        >
          <Text style={styles.stepText}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.sm },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
    headTitle: { ...typography.caption, color: colors.textMuted },
    tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    tab: { borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    tabActive: { backgroundColor: colors.primarySoft },
    tabText: { ...typography.micro, color: colors.textMuted },
    tabTextActive: { color: colors.primary },
    canvas: { width: "100%" },
    captionBox: { borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    caption: { ...typography.caption, color: colors.textSecondary },
    controls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    controlButton: { borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    controlText: { ...typography.micro, color: colors.textMuted },
    spacer: { flex: 1 },
    stepButton: { borderRadius: radius.sm, backgroundColor: colors.surfaceMuted, width: 28, height: 24, alignItems: "center", justifyContent: "center" },
    stepText: { ...typography.headline, color: colors.textMuted, lineHeight: 20 },
    counter: { ...typography.micro, color: colors.textMuted },
  });
}
