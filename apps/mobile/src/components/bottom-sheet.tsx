/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
import { type ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { colors, radius, shadows } from "@/theme/tokens";

function parsePercent(value: string, fallback = 0.5) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? Math.max(0.12, Math.min(0.98, n / 100)) : fallback;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  expandable = false,
  height = "50%",
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  expandable?: boolean;
  height?: string;
}) {
  const { height: winH } = useWindowDimensions();
  const ratio = parsePercent(height, 0.5);
  const collapsed = winH * ratio;
  const full = winH * 0.94;
  const maxOffset = Math.max(0, full - collapsed);

  const translateY = useSharedValue(expandable ? maxOffset : 0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (visible) {
      translateY.value = expandable ? maxOffset : 0;
      setExpanded(false);
    }
  }, [visible, expandable, maxOffset, translateY]);

  const close = () => {
    setExpanded(false);
    onClose();
  };

  const toggle = () => {
    if (!expandable) return;
    const next = !expanded;
    translateY.value = withSpring(next ? 0 : maxOffset, { damping: 24, stiffness: 240 });
    setExpanded(next);
  };

  const handleScrim = () => {
    if (expandable) toggle();
    else close();
  };

  const panGesture = Gesture.Pan()
    .enabled(expandable)
    .onUpdate((e) => {
      const base = expanded ? 0 : maxOffset;
      translateY.value = Math.min(maxOffset + 90, Math.max(base + e.translationY, 0));
    })
    .onEnd((e) => {
      const base = expanded ? 0 : maxOffset;
      const current = base + e.translationY;
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

  const tapGesture = Gesture.Tap()
    .enabled(expandable)
    .onEnd(() => {
      runOnJS(toggle)();
    });

  const handleGesture = Gesture.Exclusive(tapGesture, panGesture);

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
          <View style={styles.body}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(30,24,12,0.36)" },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 16,
    paddingBottom: 24,
    ...shadows.floating,
  },
  handleZone: { alignItems: "center", paddingVertical: 12 },
  grabber: { width: 44, height: 5, borderRadius: 999, backgroundColor: "rgba(120,90,45,0.28)" },
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
