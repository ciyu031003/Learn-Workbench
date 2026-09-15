import { useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { radius, typography } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 统一表单字段（见 docs/APP端优化方案-v2 §8.3②）
 * label 12·muted（上方 6pt）/ 输入框高 44 / 圆角 12 / 聚焦态品牌色描边 / 错误文案 12·danger
 * 取代各屏自写的 TextInput 样式（今日/习惯/饮食/训练/简历表单）。
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  right,
  style,
  containerStyle,
  multiline = false,
  ...inputProps
}: {
  label?: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  multiline?: boolean;
} & Omit<TextInputProps, "value" | "onChangeText" | "style" | "multiline">) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            focused && styles.inputFocused,
            !!error && styles.inputError,
            style,
          ]}
        />
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    label: { ...typography.caption, fontWeight: "600", color: colors.textMuted },
    inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    input: {
      flex: 1,
      height: 44,
      borderRadius: radius.md - 4,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      ...typography.body,
    },
    inputMultiline: { height: undefined, minHeight: 88, paddingTop: 10, textAlignVertical: "top" },
    inputFocused: { borderColor: colors.primary, backgroundColor: colors.surfaceStrong },
    inputError: { borderColor: colors.danger },
    right: { flexShrink: 0 },
    error: { ...typography.caption, color: colors.danger },
    hint: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
  });
