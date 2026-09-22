import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/theme";
import { radius, typography, type ThemeColors } from "@/theme/tokens";
import { MOTION_BASE, easingStandard, isMotionActive } from "@/theme/motion";
import { useReducedMotion } from "@/lib/motion";

/**
 * v13 U6 · 浮动标签输入框（技法参考 uiverse.io/Li-Deheng/tiny-chicken-50 (MIT)：
 * placeholder 上浮成 label + 克制的圆角描边；聚焦时描边转主色）。
 *
 * 实现说明（RN 的取舍）：
 * - "上浮"只用 **opacity + translateY**（不动 fontSize/top，避免逐帧布局）；
 *   静止态的文字由 TextInput 原生 placeholder 承担，聚焦/有值时切成上浮的 label —— 视觉连续且零布局抖动；
 * - 聚焦时描边变 `colors.primary`（Web 端聚焦还有旋转描边，RN 不做 conic-gradient）；
 * - `MOTION_ENABLED=false` 或系统减弱动态 → 直接切终态。
 */
export function FloatField({
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
  testID,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  error?: string | null;
  hint?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  multiline?: boolean;
  testID?: string;
} & Omit<TextInputProps, "value" | "onChangeText" | "style" | "multiline" | "placeholder">) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const active = isMotionActive(reduceMotion);

  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  // 顺序约束：所有 shared value 声明在 useAnimatedStyle / 回调之前
  const float = useSharedValue(floated ? 1 : 0);

  useEffect(() => {
    const target = floated ? 1 : 0;
    float.value = active
      ? withTiming(target, { duration: MOTION_BASE, easing: easingStandard })
      : target;
  }, [active, float, floated]);

  const labelStyle = useAnimatedStyle<ViewStyle>(() => ({
    opacity: float.value,
    transform: [{ translateY: (1 - float.value) * 8 }],
  }));

  return (
    <View style={[styles.wrap, containerStyle]}>
      <View
        style={[
          styles.field,
          floated && styles.fieldFloated,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
          style,
        ]}
      >
        <TextInput
          {...inputProps}
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          // 静止态用原生 placeholder 显示标签文字；上浮后交给 Animated.Text
          placeholder={floated ? placeholder ?? "" : label}
          placeholderTextColor={colors.textFaint}
          multiline={multiline}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        <Animated.Text
          pointerEvents="none"
          style={[styles.floatLabel, focused && styles.floatLabelFocused, labelStyle]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
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
    field: {
      borderRadius: radius.md - 4,
      paddingHorizontal: 12,
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 52,
    },
    fieldFloated: { paddingTop: 14 },
    fieldFocused: { borderColor: colors.primary, backgroundColor: colors.surfaceStrong },
    fieldError: { borderColor: colors.danger },
    input: {
      color: colors.text,
      ...typography.body,
      paddingVertical: 8,
      // Android 上 TextInput 自带内边距，清掉以免和 label 抢位置
      paddingHorizontal: 0,
    },
    inputMultiline: { minHeight: 88, textAlignVertical: "top" },
    floatLabel: {
      position: "absolute",
      left: 12,
      top: 6,
      ...typography.micro,
      fontWeight: "600",
      color: colors.textMuted,
    },
    floatLabelFocused: { color: colors.primary },
    right: { position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center" },
    error: { ...typography.caption, color: colors.danger },
    hint: { ...typography.caption, fontWeight: "400", color: colors.textFaint },
  });
