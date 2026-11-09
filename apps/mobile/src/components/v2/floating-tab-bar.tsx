import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import type { BottomTabBarProps, BottomTabNavigationOptions } from "expo-router/tabs";
import { useTheme } from "@/theme";
import { tabBarRowPaddingBottom, tabBarTotalHeight } from "@/lib/tab-bar-metrics";
import type { ThemeColors } from "@/theme/tokens";

/**
 * 全宽白色底栏（对齐优化 demo `.tabbar` / `.tab`）
 *
 * 2026-11 由「悬浮液态玻璃胶囊 + 蓝色渐变 pill + 外发光」改为 demo 的**全宽白色底栏**：
 * 贴底、左右无留白、顶部 1px 分隔线、白色半透 + 背景模糊。
 * 选中态不再是整块渐变胶囊，而是：图标落在一块蓝色软底圆角盒（26×24、圆角 9）上，
 * 图标与文字变蓝、文字 600 字重；未选中为灰色图标 + 灰色文字，无底色。
 *
 * 交互全部沿用 navigator，本组件不改变事件顺序：
 *  - 点击仍 navigation.emit({ type: "tabPress" }) 再 navigate → _layout 里既有的
 *    **触觉反馈**与**双击回顶**（v19-M8）照常生效，选中切换仍由 react-navigation 驱动；
 *  - 图标仍由各屏 options.tabBarIcon 渲染 → _layout 里 TabIcon 的**弹簧动效**原样保留
 *    （本文件不新增任何 Reanimated 补间 / 弹簧 / 循环动效点，无持续动画）。
 */
/** 标签字号：10.5 在 3x 屏上过小，抬到 11.5 仍能塞进 68pt 内容区 */
const LABEL_FONT_SIZE = 11.5;
const LABEL_LINE_HEIGHT = 15;
const BADGE_FONT_SIZE = 10;
/** 选中图标软底盒：比 24pt 图标各留 3pt 呼吸，选中态才看得出来 */
const ICON_BOX_WIDTH = 30;
const ICON_BOX_HEIGHT = 26;
const ICON_BOX_RADIUS = 10;

/**
 * expo-router 的 href: null 会把该路由的 options 改写成
 * tabBarItemStyle: { display: "none" } + tabBarButton: () => null
 * （见 expo-router/build/layouts/TabsClient.js）。默认底栏靠这两笔隐藏重定向页；
 * 自定义底栏只认得到第一笔，所以从可视列表里把 display:none 的项剔掉，
 * 否则 index / dashboard 这两个重定向页会多长出两个 Tab。
 */
function isHiddenTab(options: BottomTabNavigationOptions): boolean {
  const flat = StyleSheet.flatten(options.tabBarItemStyle) as { display?: string } | undefined;
  return flat?.display === "none";
}

/** 与 react-navigation 的 getLabel 等价的最小实现（自定义 label 函数退回 title） */
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
    <View pointerEvents="box-none" style={styles.host}>
      <View style={styles.bar}>
        {/* 背景模糊（demo backdrop-filter: blur(26px) saturate(1.2)）+ 白色半透染色 */}
        <BlurView
          intensity={42}
          tint={dark ? "dark" : "light"}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        <View style={styles.topHairline} />

        <View
          accessibilityRole="tablist"
          style={[
            styles.row,
            {
              height: tabBarTotalHeight(insets.bottom),
              paddingBottom: tabBarRowPaddingBottom(insets.bottom),
            },
          ]}
        >
          {visible.map((route) => {
            const { options } = descriptors[route.key];
            const focused = state.routes[state.index]?.key === route.key;
            const label = resolveLabel(options, route.name);
            const showLabel = options.tabBarShowLabel !== false;
            const tint = focused ? colors.primary : colors.textSecondary;

            const onPress = () => {
              /**
               * 与默认 BottomTabBar 完全一致的事件顺序：先 emit tabPress（_layout 借此
               * 做触觉 + 双击回顶，并可 preventDefault），未被拦截且未选中才真正跳转。
               */
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
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
                // iOS 的 VoiceOver 对 tab 语义支持不佳（默认底栏同样折中），Android 用 tab
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
                    maxFontSizeMultiplier={1.2}
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
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    host: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
    },
    bar: {
      backgroundColor: dark ? "rgba(18,24,38,0.92)" : "rgba(255,255,255,0.96)",
      overflow: "hidden",
      elevation: 0,
    },
    /** 白色半透染色（demo background rgba(255,255,255,.96)），保证灰字对比度 */
    tint: { backgroundColor: dark ? "rgba(18,24,38,0.6)" : "rgba(255,255,255,0.72)" },
    /** 顶部 1px 分隔线（demo border-top 1px solid var(--line)） */
    topHairline: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      paddingHorizontal: 6,
    },
    /** 单格（demo `.tab`：纵向、居中、圆角 14） */
    item: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderRadius: 14,
    },
    itemPressed: { backgroundColor: "rgba(47,116,192,0.06)" },
    iconBox: {
      width: ICON_BOX_WIDTH,
      height: ICON_BOX_HEIGHT,
      borderRadius: ICON_BOX_RADIUS,
      alignItems: "center",
      justifyContent: "center",
    },
    /** 选中图标软底（demo `.tab.on .ic` background blue-soft） */
    iconBoxOn: { backgroundColor: colors.primarySoft },
    label: {
      fontSize: LABEL_FONT_SIZE,
      lineHeight: LABEL_LINE_HEIGHT,
      fontWeight: "400",
      color: colors.textSecondary,
    },
    /** 选中文字（demo `.tab.on`：蓝色、600 字重） */
    labelOn: { color: colors.primary, fontWeight: "600" },
    badge: {
      position: "absolute",
      top: 6,
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
      fontSize: BADGE_FONT_SIZE,
      lineHeight: 13,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
