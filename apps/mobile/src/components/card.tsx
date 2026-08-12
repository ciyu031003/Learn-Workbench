import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

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
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: { gap: 2 },
  title: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  subtitle: { fontSize: 12, color: "#71717a" },
});
