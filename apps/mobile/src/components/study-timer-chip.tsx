import { useMemo } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";
import { studyMinutesLabel } from "@/lib/study-timer";

/** 「本次已学 X 分钟」小胶囊：不足 1 分钟不渲染 */
export function StudyTimerChip({ seconds, style }: { seconds: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const label = studyMinutesLabel(seconds);
  if (!label) return null;
  return (
    <View style={[styles.chip, style]} accessible accessibilityLabel={label}>
      <ThemedIcon name="time-outline" size={12} color={colors.primary} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 9,
      backgroundColor: colors.primarySoft,
    },
    text: { ...typography.caption, fontWeight: "600", color: colors.primaryStrong },
  });