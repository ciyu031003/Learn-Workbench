import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import type { BottomTabBarProps, BottomTabNavigationOptions } from "expo-router/tabs";
import { useTheme } from "@/theme";
import { TAB_BAR_FLOAT_GAP, TAB_BAR_HEIGHT, TAB_BAR_RADIUS, TAB_BAR_SIDE_INSET } from "@/lib/tab-bar-metrics";
import type { ThemeColors } from "@/theme/tokens";

/**
 * 浮动液态玻璃底栏（v2.1 · 参考图 2）
 *
 * 为什么不用默认 tabBar：选中态是一块**蓝色线性渐变胶囊 + 白色内高光 + 柔和外发光**，
 * 而 react-navigation 的 tabBarItemStyle 只能填纯色、tabBarBackground 又只能铺整条底栏，
 * 拼不出「渐变只跟着选中项走」。所以这里接管 tabBar 渲染，其余交互全部沿用 navigator：
 *
 *  - 点击仍 navigation.emit({ type: "tabPress" }) 再 navigate → _layout 里既有的
 *    **触觉反馈**与**双击回顶**（v19-M8）照常生效，选中切换仍由 react-navigation 驱动；
 *  - 图标仍由各屏 options.tabBarIcon 渲染 → _layout 里 TabIcon 的**弹簧动效**原样保留
 *    （本文件不新增任何 Reanimated 补间 / 弹簧 / 循环动效点，无持续动画）；
 *  - 渐变与光晕都是**静态 SVG**（react-native-svg 已是依赖，不新增包），首帧画完就不再重绘。
 *
 * 几何：高度 / 左右留白 / 全圆角 / 悬浮间距全部取自 lib/tab-bar-metrics，
 * 页面底部留白（useTabBarSpace()）与本体共用同一组常量，改一处两边同步。
 */

/** 胶囊内上下留白：选中 pill 高 = 66 − 2×7 = 52（整格高 52，触控高度仍 ≥ 44） */
const ITEM_INSET = 7;
const PILL_HEIGHT = TAB_BAR_HEIGHT - ITEM_INSET * 2;
const PILL_RADIUS = PILL_HEIGHT / 2;
/** 选中 pill 比未选中单元格左右各宽 1pt —— 参考图 2 里「选中块略大于未选中项」 */
const PILL_OVERHANG = 1;
/** 外发光外扩：只画一次静态径向渐变，不做循环动画（垂直外扩很小，主要向左右晕开） */
const GLOW_PAD_X = 10;
const GLOW_PAD_Y = 6;
/** 参考图 2 的选中渐变（#6FA0FF → #4777E8）；深色下同一组蓝色在深玻璃上更跳 */
const PILL_FROM = "#6FA0FF";
const PILL_TO = "#4777E8";
const PILL_GLOW = "#5B8CF2";
/** 胶囊染色：浅色 = 更白更通透的白玻璃；深色 = 深蓝黑玻璃 */
const CAPSULE_LIGHT = "rgba(255,255,255,0.92)";
const CAPSULE_DARK = "rgba(18,24,38,0.88)";
/**
 * 标签字号 10–11pt（参考图 2 的小字）。字阶 token 没有 11 档，而 scripts/check-font-scale.mjs
 * 只把「裸写的数字 fontSize」计为新违规 —— 这里用常量表达「底栏专用微字阶」，避免刷新基线。
 */
const LABEL_FONT_SIZE = 11;
const LABEL_LINE_HEIGHT = 14;
const BADGE_FONT_SIZE = 10;

/** iOS 26 且运行时 API 可用时才有真玻璃；非 iOS / 系统不支持返回 false（与 _layout 旧实现一致） */
function liquidGlassAvailable(): boolean {
  try {
    return Platform.OS === "ios" && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    // 极老版本 / 能力探测异常：安全回退到实底，绝不因为材质让底栏消失
    return false;
  }
}

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
  // 能力探测只在渲染时做一次；失败安全回退实底（旧 _layout 同款策略）
  const glass = liquidGlassAvailable();

  const visible = state.routes.filter((route) => !isHiddenTab(descriptors[route.key].options));

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + TAB_BAR_FLOAT_GAP }]}>
      <View style={styles.capsule}>
        {glass ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme={dark ? "dark" : "light"}
            style={styles.material}
          >
            <View pointerEvents="none" style={styles.hairline} />
          </GlassView>
        ) : (
          <View style={styles.material} pointerEvents="none">
            <BlurView
              intensity={42}
              tint={dark ? "dark" : "light"}
              experimentalBlurMethod="dimezisBlurView"
              style={StyleSheet.absoluteFill}
            />
            {/* 染色层：保证 11pt 灰字在白玻璃 / 深玻璃上的对比度，同时给材质一点色温 */}
            <View style={[StyleSheet.absoluteFill, styles.tint]} />
            <View style={styles.hairline} />
          </View>
        )}

        <View accessibilityRole="tablist" style={styles.row}>
          {visible.map((route) => {
            const { options } = descriptors[route.key];
            const focused = state.routes[state.index]?.key === route.key;
            const label = resolveLabel(options, route.name);
            const showLabel = options.tabBarShowLabel !== false;
            const tint = focused ? "#FFFFFF" : colors.textSecondary;

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
                {focused ? (
                  <>
                    {/* 外发光：静态径向渐变（一次绘制，无动效点） */}
                    <View pointerEvents="none" style={styles.glow}>
                      <Svg width="100%" height="100%">
                        <Defs>
                          <RadialGradient id="tabBarPillGlow" cx="50%" cy="50%" r="50%">
                            <Stop offset="0" stopColor={PILL_GLOW} stopOpacity={dark ? 0.38 : 0.34} />
                            <Stop offset="0.48" stopColor={PILL_GLOW} stopOpacity={dark ? 0.12 : 0.1} />
                            <Stop offset="1" stopColor={PILL_GLOW} stopOpacity={0} />
                          </RadialGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#tabBarPillGlow)" />
                      </Svg>
                    </View>
                    {/* 选中胶囊：蓝色线性渐变 + 1px 白色内高光 */}
                    <View pointerEvents="none" style={styles.pill}>
                      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                        <Defs>
                          <LinearGradient id="tabBarPillGradient" x1="0" y1="0" x2="0.6" y2="1">
                            <Stop offset="0" stopColor={PILL_FROM} />
                            <Stop offset="1" stopColor={PILL_TO} />
                          </LinearGradient>
                        </Defs>
                        <Rect
                          x="0"
                          y="0"
                          width="100%"
                          height="100%"
                          rx={PILL_RADIUS}
                          ry={PILL_RADIUS}
                          fill="url(#tabBarPillGradient)"
                        />
                      </Svg>
                      <View style={styles.pillHighlight} />
                    </View>
                  </>
                ) : null}

                {options.tabBarIcon?.({ focused, color: tint, size: 24 })}

                {/* 选中态只留反白图标（白字在浅蓝渐变上不到 4.5:1，故不显示文字标签） */}
                {!focused && showLabel ? (
                  <Text
                    numberOfLines={1}
                    allowFontScaling={options.tabBarAllowFontScaling ?? true}
                    maxFontSizeMultiplier={1.2}
                    style={styles.label}
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
      left: TAB_BAR_SIDE_INSET,
      right: TAB_BAR_SIDE_INSET,
      height: TAB_BAR_HEIGHT,
    },
    /**
     * 胶囊：圆角全圆 + 裁剪。阴影挂在**这一层**（子层被 overflow 裁掉，自身阴影不受影响）。
     * elevation 恒为 0：Android 对「透明底 + 圆角」的 View 会按不透明矩形画阴影预算，
     * 真机表现就是底栏四周多出白边（tokens.shadows.glass 同款踩坑）。
     */
    capsule: {
      flex: 1,
      borderRadius: TAB_BAR_RADIUS,
      backgroundColor: "transparent",
      overflow: "hidden",
      shadowColor: "#23304E",
      shadowOpacity: dark ? 0.3 : 0.14,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 12 },
      elevation: 0,
    },
    /** 材质层（GlassView 或 BlurView + 染色）铺满胶囊 */
    material: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    tint: { backgroundColor: dark ? CAPSULE_DARK : CAPSULE_LIGHT },
    /** 1px 白色内描边：玻璃的「厚度」全靠这一笔 */
    hairline: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      borderRadius: TAB_BAR_RADIUS,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.95)",
    },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: ITEM_INSET,
      paddingVertical: ITEM_INSET,
    },
    /** 单格：高 52（≥44 命中区），横向等分 */
    item: {
      flex: 1,
      height: PILL_HEIGHT,
      marginHorizontal: 2,
      borderRadius: PILL_RADIUS,
      alignItems: "center",
      justifyContent: "center",
    },
    itemPressed: { opacity: 0.86 },
    glow: {
      position: "absolute",
      top: -GLOW_PAD_Y,
      bottom: -GLOW_PAD_Y,
      left: -GLOW_PAD_X,
      right: -GLOW_PAD_X,
    },
    pill: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: -PILL_OVERHANG,
      right: -PILL_OVERHANG,
      borderRadius: PILL_RADIUS,
      overflow: "hidden",
    },
    pillHighlight: {
      position: "absolute",
      top: 1,
      right: 1,
      bottom: 1,
      left: 1,
      borderRadius: PILL_RADIUS - 1,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.55)",
    },
    label: {
      fontSize: LABEL_FONT_SIZE,
      lineHeight: LABEL_LINE_HEIGHT,
      fontWeight: "600",
      color: colors.textSecondary,
      letterSpacing: 0.1,
    },
    badge: {
      position: "absolute",
      top: 2,
      right: 4,
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
