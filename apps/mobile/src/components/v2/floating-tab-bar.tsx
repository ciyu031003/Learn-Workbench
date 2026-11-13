import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import type { BottomTabBarProps, BottomTabNavigationOptions } from "expo-router/tabs";
import { useTheme } from "@/theme";
import { TAB_BAR_FLOAT_GAP, TAB_BAR_HEIGHT, TAB_BAR_RADIUS, TAB_BAR_SIDE_INSET } from "@/lib/tab-bar-metrics";
import type { ThemeColors } from "@/theme/tokens";

/**
 * Floating liquid-glass tab bar.
 *
 * The capsule floats above the safe area with side gutters. The outer view owns
 * the shadow, while the inner bar clips the blur so the rounded shape stays
 * crisp on iOS and Android.
 */
const ICON_BOX_WIDTH = 30;
// Keep this at least as tall as TabIcon's 27pt wrapper in (tabs)/_layout.tsx,
// otherwise the icon overflows its centering box and sits above the label.
const ICON_BOX_HEIGHT = 28;
const ICON_BOX_RADIUS = 10;

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

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);

  const visible = state.routes.filter((route) => !isHiddenTab(descriptors[route.key].options));

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
            intensity={58}
            tint={dark ? "dark" : "light"}
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
          <View style={styles.topHairline} />

          <View accessibilityRole="tablist" style={styles.row}>
            {visible.map((route) => {
              const { options } = descriptors[route.key];
              const focused = state.routes[state.index]?.key === route.key;
              const label = resolveLabel(options, route.name);
              const showLabel = options.tabBarShowLabel !== false;
              const tint = focused
                ? dark
                  ? "#FFFFFF"
                  : colors.primary
                : dark
                  ? "rgba(255,255,255,0.62)"
                  : colors.textSecondary;

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
                  accessibilityRole={Platform.OS === "ios" ? "button" : "tab"}
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                >
                  <View style={[styles.iconBox, focused && styles.iconBoxOn]}>
                    {options.tabBarIcon?.({ focused, color: tint, size: 24 })}
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

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    host: {
      position: "absolute",
      left: 0,
      right: 0,
      paddingHorizontal: TAB_BAR_SIDE_INSET,
    },
    shadow: {
      borderRadius: TAB_BAR_RADIUS,
      shadowColor: "#000000",
      shadowOpacity: 0.24,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 18,
    },
    bar: {
      height: TAB_BAR_HEIGHT,
      borderRadius: TAB_BAR_RADIUS,
      borderWidth: 1,
      borderColor: dark ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.78)",
      overflow: "hidden",
      backgroundColor: "transparent",
    },
    tint: {
      backgroundColor: dark ? "rgba(16,20,30,0.54)" : "rgba(255,255,255,0.62)",
    },
    topHairline: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: dark ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.92)",
    },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "stretch",
      paddingHorizontal: 6,
    },
    item: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: TAB_BAR_RADIUS - 6,
    },
    itemPressed: {
      backgroundColor: dark ? "rgba(255,255,255,0.10)" : "rgba(47,116,192,0.08)",
      transform: [{ scale: 0.96 }],
    },
    iconBox: {
      width: ICON_BOX_WIDTH,
      height: ICON_BOX_HEIGHT,
      borderRadius: ICON_BOX_RADIUS,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBoxOn: {
      backgroundColor: dark ? "rgba(255,255,255,0.16)" : colors.primarySoft,
    },
    label: {
      fontSize: 10.5,
      lineHeight: 13.5,
      fontWeight: "500",
      color: dark ? "rgba(255,255,255,0.62)" : colors.textSecondary,
    },
    labelOn: {
      color: dark ? "#FFFFFF" : colors.primary,
      fontWeight: "700",
    },
    badge: {
      position: "absolute",
      top: 4,
      right: 8,
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
