/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { type ReactNode, useEffect, useState , useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { radius, shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

function parsePercent(value: string, fallback = 0.5) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0.12, Math.min(0.98, n / 100)) : fallback;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  body,
  expandable = false,
  height = "50%",
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  body?: (expanded: boolean) => ReactNode;
  expandable?: boolean;
  height?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height: winH } = useWindowDimensions();
  const ratio = parsePercent(height, 0.5);
  const collapsed = winH * ratio;
  const full = winH * 0.94;
  const maxOffset = Math.max(0, full - collapsed);

  const translateY = useSharedValue(expandable ? maxOffset : 0);
  const dragBase = useSharedValue(expandable ? maxOffset : 0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (visible) {
      translateY.value = expandable ? maxOffset : 0;
      dragBase.value = expandable ? maxOffset : 0;
      setExpanded(false);
    }
  }, [visible, expandable, maxOffset, translateY, dragBase]);

  const close = () => {
    setExpanded(false);
    onClose();
  };

  const toggle = () => {
    if (!expandable) return;
    const next = !expanded;
    translateY.value = withSpring(next ? 0 : maxOffset, { damping: 24, stiffness: 240 });
    dragBase.value = next ? 0 : maxOffset;
    setExpanded(next);
  };

  const handleScrim = () => {
    close();
  };

  const tapGesture = Gesture.Tap()
    .enabled(expandable)
    .maxDuration(220)
    .onEnd(() => {
      runOnJS(toggle)();
    });

  const panGesture = Gesture.Pan()
    .enabled(expandable)
    .activateAfterLongPress(160)
    .onBegin(() => {
      dragBase.value = expanded ? 0 : maxOffset;
    })
    .onUpdate((e) => {
      translateY.value = Math.min(maxOffset + 90, Math.max(dragBase.value + e.translationY, 0));
    })
    .onEnd((e) => {
      const current = dragBase.value + e.translationY;
      if (current > maxOffset + 70) {
        runOnJS(close)();
      } else if (current < maxOffset * 0.5 || e.velocityY < -500) {
        translateY.value = withSpring(0, { damping: 24, stiffness: 240 });
        runOnJS(setExpanded)(true);
      } else {
        translateY.value = withSpring(maxOffset, { damping: 24, stiffness: 240 });
        runOnJS(setExpanded)(false);
      }
    });

  const handleGesture = Gesture.Race(tapGesture, panGesture);

  const animatedSheet = useAnimatedStyle(() => ({
    transform: [{ translateY: expandable ? translateY.value : 0 }],
  }));

  const sheetHeight = expandable ? full : collapsed;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={handleScrim} />
        <Animated.View style={[styles.sheet, { height: sheetHeight }, animatedSheet]}>
          <GestureDetector gesture={handleGesture}>
            <View style={styles.handleZone}>
              <View style={styles.grabber} />
            </View>
          </GestureDetector>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={close} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.body}>{body ? body(expanded) : children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(30,24,12,0.36)" },
  sheet: {
    backgroundColor: "rgba(253,248,239,0.96)",
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.65)",
    paddingHorizontal: 16,
    paddingBottom: 24,
    ...shadows.floating,
    overflow: "hidden",
  },
  handleZone: { alignItems: "center", paddingVertical: 14 },
  grabber: { width: 48, height: 6, borderRadius: 999, backgroundColor: "rgba(120,90,45,0.30)" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
});
