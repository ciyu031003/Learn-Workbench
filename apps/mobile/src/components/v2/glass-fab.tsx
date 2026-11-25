import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Icon, type IconName } from "@/components/ui/icon";
import { useBlurTarget } from "@/components/blur-target";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { useTheme } from "@/theme";
import { isMotionActive } from "@/theme/motion";
import { shadows, type ThemeColors } from "@/theme/tokens";

/**
 * 液态玻璃悬浮加号（对齐 demo 右下角 Fab / FoodNoms 的 add 入口）。
 *
 * 交互：
 * - 收起时只有一颗 58pt 玻璃圆钮，加号在屏幕右下角、底栏上方；
 * - 点开后加号旋转 135°，三项动作从底部错峰弹出（spring + 延迟）；
 * - 点任意动作或点空白处收起；减弱动态时直接切换终态。
 *
 * 用于成长页「添加睡眠 / 饮食 / 训练」等二级入口，避免把补录做成一条悬空的 tab 栏。
 */
export type GlassFabAction = {
  key: string;
  label: string;
  icon: IconName;
};

const MAIN = 58;
const ACTION = 46;
const GAP = 10;

export function GlassFab({
  actions,
  onPress,
  bottom = 96,
  accessibilityLabel = "添加记录",
}: {
  actions: readonly GlassFabAction[];
  onPress: (key: string) => void;
  bottom?: number;
  accessibilityLabel?: string;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const blurTarget = useBlurTarget();
  const reduced = useReducedMotion();
  const active = isMotionActive(reduced);
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = open ? 1 : 0;
    progress.value = active ? withTiming(target, { duration: open ? 260 : 180 }) : target;
  }, [active, open, progress]);

  const mainStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 135}deg` }, { scale: interpolate(progress.value, [0, 1], [1, 0.96]) }],
  }));

  const close = () => setOpen(false);

  return (
    <>
      {open ? (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={close}
          accessibilityLabel="收起添加菜单"
        />
      ) : null}

      <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
        <View pointerEvents="box-none" style={styles.column}>
        {[...actions].reverse().map((action) => {
          return (
            <FabAction
              key={action.key}
              action={action}
              progress={progress}
              open={open}
              blurTarget={blurTarget}
              onPress={() => {
                haptics.light();
                close();
                onPress(action.key);
              }}
            />
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: open }}
          onPress={() => {
            haptics.soft();
            setOpen((value) => !value);
          }}
          style={styles.mainShadow}
        >
          <View style={styles.main}>
            <BlurView
              intensity={72}
              tint={dark ? "dark" : "light"}
              blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
              blurTarget={blurTarget ?? undefined}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.mainTint} />
            <View pointerEvents="none" style={styles.mainSheen} />
            <Animated.View style={mainStyle}>
              <Icon name="plus" size={26} weight="bold" color={dark ? "#FFFFFF" : colors.primary} />
            </Animated.View>
          </View>
        </Pressable>
        </View>
      </View>
    </>
  );
}

function FabAction({
  action,
  progress,
  open,
  blurTarget,
  onPress,
}: {
  action: GlassFabAction;
  progress: SharedValue<number>;
  open: boolean;
  blurTarget: ReturnType<typeof useBlurTarget>;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [16, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.82, 1]) },
    ],
  }));

  return (
    <Animated.View pointerEvents={open ? "box-none" : "none"} style={[styles.actionRow, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={onPress}
        style={styles.actionRowInner}
      >
        <View style={styles.actionLabel}>
          <BlurView
            intensity={64}
            tint={dark ? "dark" : "light"}
            blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
            blurTarget={blurTarget ?? undefined}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.actionLabelTint} />
          <Text style={styles.actionLabelText}>{action.label}</Text>
        </View>
        <View style={styles.actionBtn}>
          <BlurView
            intensity={64}
            tint={dark ? "dark" : "light"}
            blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
            blurTarget={blurTarget ?? undefined}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.actionBtnTint} />
          <Icon name={action.icon} size={20} weight="regular" color={dark ? "#E8F1F6" : colors.primaryStrong} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    backdrop: { backgroundColor: "transparent", zIndex: 44 },
    host: { position: "absolute", right: 18, alignItems: "flex-end", zIndex: 45 },
    column: { alignItems: "flex-end", gap: GAP },
    mainShadow: {
      width: MAIN,
      height: MAIN,
      borderRadius: MAIN / 2,
      ...shadows.floating,
    },
    main: {
      width: MAIN,
      height: MAIN,
      borderRadius: MAIN / 2,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.9)",
      backgroundColor: "transparent",
    },
    mainTint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dark ? "rgba(16,24,30,0.44)" : "rgba(255,255,255,0.34)" },
    mainSheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "48%",
      backgroundColor: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.36)",
    },
    actionRow: { alignItems: "flex-end" },
    actionRowInner: { flexDirection: "row", alignItems: "center", gap: 8 },
    actionLabel: {
      minHeight: 32,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.8)",
    },
    actionLabelTint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dark ? "rgba(16,24,30,0.42)" : "rgba(255,255,255,0.30)" },
    actionLabelText: { fontSize: 12, lineHeight: 16, fontWeight: "700", color: dark ? "#F2F7FA" : colors.text },
    actionBtn: {
      width: ACTION,
      height: ACTION,
      borderRadius: ACTION / 2,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.88)",
    },
    actionBtnTint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dark ? "rgba(16,24,30,0.40)" : "rgba(255,255,255,0.30)" },
  });