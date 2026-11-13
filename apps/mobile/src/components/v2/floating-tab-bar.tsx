import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import type { BottomTabBarProps, BottomTabNavigationOptions } from "expo-router/tabs";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTheme } from "@/theme";
import { TAB_BAR_FLOAT_GAP, TAB_BAR_HEIGHT, TAB_BAR_RADIUS, TAB_BAR_SIDE_INSET } from "@/lib/tab-bar-metrics";
import { useReducedMotion } from "@/lib/motion";
import { isMotionActive } from "@/theme/motion";
import type { ThemeColors } from "@/theme/tokens";

/**
 * 悬浮底栏（2.6.8 · 对齐移动端 demo `.tabbar`）
 *
 * - 70pt 白色玻璃胶囊，左右 12pt、距安全区 12pt，圆角 22。
 * - 选中态不再是"图标底块"，而是一整块**滑动胶囊**：柔蓝渐变 + 轻投影，
 *   在 5 个等宽格之间用 spring 平移（减弱动态时直接落位）。
 * - 图标 + 文字上下排布，选中主色 750，未选中 meta。
 */

/** expo-router hides redirect-only routes with tabBarItemStyle: display none. */
function isHiddenTab(options: BottomTabNavigationOptions): boolean {
  const flat = StyleSheet.flatten(options.tabBarItemStyle) as { display?: string } | undefined;
  return flat?.display === "none";
}

function resolveLabel(options: BottomTabNavigationOptions, routeName: string): string {
  if (typeof options.tabBarLabel === "string") return options.tabBarLabel;
  if (typeof options.title === "string") return options.title;
  return routeName;
}

const PILL_GAP = 6;

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const reduced = useReducedMotion();
  const active = isMotionActive(reduced);

  const visible = state.routes.filter((route) => !isHiddenTab(descriptors[route.key].options));
  const focusedKey = state.routes[state.index]?.key;
  const index = Math.max(0, visible.findIndex((route) => route.key === focusedKey));
  const [trackWidth, setTrackWidth] = useState(0);
  const slot = trackWidth > 0 ? trackWidth / Math.max(1, visible.length) : 0;

  const offset = useSharedValue(index * slot);
  useEffect(() => {
    const target = index * slot;
    offset.value = active ? withSpring(target, { damping: 22, stiffness: 260, mass: 0.6 }) : target;
  }, [active, index, offset, slot]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          bottom: insets.bottom + TAB_BAR_FLOAT_GAP,
          paddingLeft: Math.max(TAB_BAR_SIDE_INSET, insets.left),
          paddingRight: Math.max(TAB_BAR_SIDE_INSET, insets.right),
        },
      ]}
    >
      <View style={styles.shadow}>
        <View style={styles.bar}>
          <BlurView
            intensity={62}
            tint={dark ? "dark" : "light"}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
          <View style={styles.topHairline} />

          <View
            style={styles.row}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width - PILL_GAP * 2)}
          >
            {slot > 0 ? (
              <Animated.View pointerEvents="none" style={[styles.pill, { width: slot }, pillStyle]}>
                <View style={styles.pillSheen} />
              </Animated.View>
            ) : null}

            {visible.map((route) => {
              const { options } = descriptors[route.key];
              const focused = route.key === focusedKey;
              const label = resolveLabel(options, route.name);
              const showLabel = options.tabBarShowLabel !== false;
              const tint = focused
                ? dark
                  ? "#FFFFFF"
                  : colors.primary
                : dark
                  ? "rgba(255,255,255,0.62)"
                  : colors.textMeta;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };
              const onLongPress = () => {
                navigation.emit({ type: "tabLongPress", target: route.key });
              };

              return (
                <Pressable
                  key={route.key}
                  testID={options.tabBarButtonTestID ?? "tab-" + route.name}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  hitSlop={4}
                  accessibilityRole={Platform.OS === "ios" ? "button" : "tab"}
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <View style={styles.iconBox}>
                    {options.tabBarIcon?.({ focused, color: tint, size: 21 })}
                  </View>

                  {showLabel ? (
                    <Text
                      numberOfLines={1}
                      allowFontScaling={options.tabBarAllowFontScaling ?? true}
                      maxFontSizeMultiplier={1.15}
                      style={[styles.label, focused && styles.labelOn]}
                    >
                      {label}
                    </Text>
                  ) : null}

                  {options.tabBarBadge !== undefined && options.tabBarBadge !== "" ? (
                    <View pointerEvents="none" style={styles.badge}>
                      <Text numberOfLines={1} style={[styles.badgeText, options.tabBarBadgeStyle]}>
                        {options.tabBarBadge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

type TabStyles = {
  host: ViewStyle;
  shadow: ViewStyle;
  bar: ViewStyle;
  tint: ViewStyle;
  topHairline: ViewStyle;
  row: ViewStyle;
  pill: ViewStyle;
  pillSheen: ViewStyle;
  item: ViewStyle;
  itemPressed: ViewStyle;
  iconBox: ViewStyle;
  label: TextStyle;
  labelOn: TextStyle;
  badge: ViewStyle;
  badgeText: TextStyle;
};

const makeStyles = (colors: ThemeColors, dark: boolean): TabStyles =>
  StyleSheet.create({
    host: {
      position: "absolute",
      left: 0,
      right: 0,
    },
    shadow: {
      borderRadius: TAB_BAR_RADIUS,
      shadowColor: "#1A303C",
      shadowOpacity: dark ? 0.42 : 0.16,
      shadowRadius: 19,
      shadowOffset: { width: 0, height: 16 },
      elevation: 18,
    },
    bar: {
      height: TAB_BAR_HEIGHT,
      borderRadius: TAB_BAR_RADIUS,
      borderWidth: 1,
      borderColor: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.9)",
      overflow: "hidden",
      backgroundColor: "transparent",
    },
    tint: {
      backgroundColor: dark ? "rgba(15,20,26,0.86)" : "rgba(255,255,255,0.82)",
    },
    topHairline: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: dark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.95)",
    },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "stretch",
      paddingHorizontal: PILL_GAP,
    },
    pill: {
      position: "absolute",
      top: PILL_GAP,
      bottom: PILL_GAP,
      left: PILL_GAP,
      borderRadius: 16,
      backgroundColor: dark ? "rgba(91,147,214,0.22)" : "#E4EFF9",
      borderWidth: 1,
      borderColor: dark ? "rgba(128,180,235,0.28)" : "#D6E6F4",
      shadowColor: "#2F74C0",
      shadowOpacity: dark ? 0 : 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 4 },
    },
    pillSheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 16,
      backgroundColor: dark ? "transparent" : "rgba(255,255,255,0.42)",
      opacity: 0.55,
    },
    item: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      borderRadius: 16,
    },
    itemPressed: {
      opacity: 0.72,
    },
    iconBox: {
      width: 24,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "600",
      color: dark ? "rgba(255,255,255,0.62)" : colors.textMeta,
    },
    labelOn: {
      color: dark ? "#FFFFFF" : colors.primary,
      fontWeight: "700",
    },
    badge: {
      position: "absolute",
      top: 2,
      right: 10,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.danger,
    },
    badgeText: {
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
