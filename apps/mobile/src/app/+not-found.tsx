import { useMemo } from "react";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { radius, shadows } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

export default function NotFound() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <ThemedIcon name="compass-outline" size={40} color={colors.accent} />
        </View>
        <Text style={styles.title}>页面走丢了</Text>
        <Text style={styles.sub}>你访问的页面不存在，回到「今天」继续你的节奏吧。</Text>
        <Link href="/dashboard" asChild>
          <Pressable style={styles.btn}>
            <Text style={styles.btnText}>回到今天</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    width: "100%",
    alignItems: "center",
    gap: 12,
    padding: 28,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceStrong,
    ...shadows.card,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  sub: { fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: "center" },
  btn: {
    marginTop: 6,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
