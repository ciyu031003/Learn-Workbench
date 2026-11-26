import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  FadeIn,
  FadeOut,
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
 * - 点开后加号旋转 135°，一块垂直玻璃托盘从圆钮上方浮出，三行动作逐行排布；
 * - 托盘是完整玻璃背板（真机 iOS 用 BlurView，Android 退化为低透明度染色 + 镜面高光），
 *   不会让背后页面的按钮透出来和动作标签叠在一起；
 * - 点任意动作、点空白遮罩或再次点加号收起；减弱动态时直接切换终态。
 *
 * 用于成长页「添加睡眠 / 饮食 / 训练」等二级入口，避免把补录做成一条悬空的 tab 栏。
 */
export type GlassFabAction = {
  key: string;
  label: string;
  icon: IconName;
};

const MAIN = 58;
const ACTION = 42;
const ROW = 44;

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
    progress.value = active ? withTiming(target, { duration: open ? 280 : 180 }) : target;
  }, [active, open, progress]);

  const mainStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 135}deg` }, { scale: interpolate(progress.value, [0, 1], [1, 0.96]) }],
  }));

  const trayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [18, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.92, 1]) },
    ],
  }));

  const close = () => setOpen(false);

  return (
    <>
      {open ? (
        <Animated.View
          entering={active ? FadeIn.duration(180) : undefined}
          exiting={active ? FadeOut.duration(140) : undefined}
          style={[StyleSheet.absoluteFill, styles.scrim]}
          pointerEvents="auto"
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="收起添加菜单"
          />
        </Animated.View>
      ) : null}

      <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
        <View pointerEvents="box-none" style={styles.column}>
          <Animated.View
            pointerEvents={open ? "auto" : "none"}
            style={[styles.tray, trayStyle]}
            accessibilityViewIsModal={open}
          >
            {Platform.OS !== "android" || blurTarget ? (
              <BlurView
                intensity={70}
                tint={dark ? "dark" : "light"}
                blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                blurTarget={blurTarget ?? undefined}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View pointerEvents="none" style={styles.trayTint} />
            <View pointerEvents="none" style={styles.traySheen} />

            {[...actions].reverse().map((action) => (
              <FabAction
                key={action.key}
                action={action}
                progress={progress}
                open={open}
                onPress={() => {
                  haptics.light();
                  close();
                  onPress(action.key);
                }}
              />
            ))}
          </Animated.View>

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
              {Platform.OS !== "android" || blurTarget ? (
                <BlurView
                  intensity={72}
                  tint={dark ? "dark" : "light"}
                  blurMethod={Platform.OS === "android" ? "dimezisBlurViewSdk31Plus" : undefined}
                  blurTarget={blurTarget ?? undefined}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
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
  onPress,
}: {
  action: GlassFabAction;
  progress: SharedValue<number>;
  open: boolean;
  onPress: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: interpolate(progress.value, [0, 1], [10, 0]) }],
  }));

  return (
    <Animated.View pointerEvents={open ? "auto" : "none"} style={[styles.actionRow, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={onPress}
        style={styles.actionRowInner}
        hitSlop={4}
      >
        <Text style={styles.actionLabelText}>{action.label}</Text>
        <View style={styles.actionBtn}>
          <Icon name={action.icon} size={19} weight="regular" color={dark ? "#EAF3F8" : colors.primaryStrong} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    scrim: {
      backgroundColor: dark ? "rgba(0,0,0,0.46)" : "rgba(9,17,22,0.22)",
      zIndex: 44,
    },
    host: { position: "absolute", right: 18, alignItems: "flex-end", zIndex: 45 },
    column: { alignItems: "flex-end", gap: 12 },
    tray: {
      paddingVertical: 6,
      paddingHorizontal: 6,
      borderRadius: 28,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.9)",
      ...shadows.floating,
    },
    trayTint: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: dark ? "rgba(14,22,28,0.92)" : "rgba(255,255,255,0.94)",
    },
    traySheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "46%",
      backgroundColor: dark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.4)",
    },
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
    mainTint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dark ? "rgba(16,24,30,0.5)" : "rgba(255,255,255,0.5)" },
    mainSheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "48%",
      backgroundColor: dark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.36)",
    },
    actionRow: { alignItems: "flex-end" },
    actionRowInner: {
      height: ROW,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 10,
      paddingLeft: 12,
      paddingRight: 1,
    },
    actionLabelText: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      color: dark ? "#F2F7FA" : colors.text,
      textAlign: "right",
    },
    actionBtn: {
      width: ACTION,
      height: ACTION,
      borderRadius: ACTION / 2,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
      backgroundColor: dark ? "rgba(255,255,255,0.12)" : "rgba(46,111,192,0.10)",
    },
  });
