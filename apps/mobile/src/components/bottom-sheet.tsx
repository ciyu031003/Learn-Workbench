import { type ReactNode, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows } from "@/theme/tokens";

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
  height?: "50%" | "100%";
}) {
  const [full, setFull] = useState(false);

  const toggleFull = () => {
    if (!expandable) return;
    setFull((v) => !v);
  };

  const closeSheet = () => {
    setFull(false);
    onClose();
  };

  const handleScrim = () => {
    if (expandable) toggleFull();
    else closeSheet();
  };

  const sheetHeight = full ? "92%" : height;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={handleScrim} />
        <View style={[styles.sheet, { height: sheetHeight }]}>
          <Pressable style={styles.handleArea} onPress={toggleFull}>
            <View style={styles.grabber} />
          </Pressable>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={closeSheet} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </View>
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
  handleArea: { alignItems: "center", paddingVertical: 10 },
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
