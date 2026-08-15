import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

/** iOS 26+ 使用原生液态玻璃；其余平台回退为半透明毛玻璃质感卡片 */
const glassReady = isLiquidGlassAvailable();

export function Card({
  children,
  style,
  title,
  subtitle,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  title?: string;
  subtitle?: string;
}) {
  return (
    <GlassView glassEffectStyle="regular" colorScheme="auto" style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: glassReady ? "transparent" : "rgba(255,255,255,0.72)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.65)",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  header: { gap: 2 },
  title: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  subtitle: { fontSize: 12, color: "#71717a" },
});
