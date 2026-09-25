import { useMemo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, typography, type ThemeColors } from "@/theme/tokens";

/**
 * v13 U7 · 上传卡（技法参考 uiverse.io/Jerome-W-90/shy-jellyfish-2 (MIT)：
 * 虚线边框 + 云上传图标 + 标题/说明 + 内嵌按钮 + 悬浮反馈）。
 *
 * RN 侧不做拖拽投放（移动端没有 DnD 语义），其余一致：虚线框、图标徽章、
 * 标题/说明、选择/移除按钮、进度条、错误文案。
 * 进度条宽度不用动画（上传进度本身是离散事件，逐帧动画只会掩盖真实进度）。
 */
export function UploadCard({
  title,
  hint,
  fileName,
  progress,
  busy = false,
  error,
  onPick,
  onRemove,
  pickLabel,
  icon = "cloud-upload-outline",
  acceptHint,
  style,
  children,
  testID,
}: {
  title: string;
  hint?: string;
  fileName?: string | null;
  /** 0–100，传入即显示进度条 */
  progress?: number;
  busy?: boolean;
  error?: string | null;
  onPick: () => void;
  onRemove?: () => void;
  pickLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** "支持拖拽，单个不超过 5MB" 这类补充说明 */
  acceptHint?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const pct = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : null;

  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        !!fileName && styles.wrapSelected,
        busy && styles.wrapBusy,
        !!error && styles.wrapError,
        style,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.badge, !!error && styles.badgeError]}>
          {busy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <ThemedIcon
              name={error ? "alert-circle-outline" : icon}
              size={18}
              color={error ? colors.danger : colors.primary}
            />
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {fileName || title}
          </Text>
          <Text style={[styles.hint, !!error && styles.hintError]} numberOfLines={2}>
            {error ? error : hint ?? acceptHint ?? "选择一个文件上传"}
          </Text>

          {pct !== null ? (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onPick}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={fileName ? "重新选择文件" : "选择文件"}
              style={({ pressed }) => [styles.pick, pressed && styles.pressed, busy && styles.off]}
            >
              <Text style={styles.pickText}>{pickLabel ?? (fileName ? "重新选择" : "选择文件")}</Text>
            </Pressable>
          </View>
        </View>

        {fileName && onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="移除文件"
            style={styles.close}
          >
            <ThemedIcon name="close" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    wrapSelected: { borderStyle: "solid", borderColor: colors.primary, backgroundColor: colors.surfaceStrong },
    wrapBusy: { borderStyle: "solid", borderColor: colors.primary, backgroundColor: colors.primarySoft },
    wrapError: { borderStyle: "solid", borderColor: colors.danger, backgroundColor: colors.dangerSoft },
    row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    badge: {
      width: 40,
      height: 40,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    badgeError: { backgroundColor: colors.danger + "1F" },
    body: { flex: 1, minWidth: 0, gap: 3 },
    title: { ...typography.callout, fontWeight: "700", color: colors.text },
    hint: { ...typography.micro, fontWeight: "500", color: colors.textMuted, lineHeight: 15 },
    hintError: { color: colors.danger, fontWeight: "600" },
    track: {
      marginTop: 6,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceStrong,
      overflow: "hidden",
    },
    fill: { height: "100%", borderRadius: radius.pill, backgroundColor: colors.primary },
    actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
    pick: {
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: colors.surfaceStrong,
    },
    pickText: { ...typography.micro, fontWeight: "700", color: colors.text },
    pressed: { opacity: 0.7 },
    off: { opacity: 0.5 },
    // 与 BottomSheet 的关闭钮同一语言：28×28 圆底 + hitSlop
    close: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
  });

/** 与 Web 一致的默认文案（"支持拖拽…"在移动端改为"单个不超过…"） */
export const uploadAcceptHint = (maxBytes: number): string =>
  `单个不超过 ${Math.round(maxBytes / 1024 / 1024)}MB`;
