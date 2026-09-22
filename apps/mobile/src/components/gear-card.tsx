import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ThemedIcon } from "@/components/themed-icon";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, typography, type ThemeColors } from "@/theme/tokens";
import { haptics } from "@/lib/haptics";

/**
 * v13 U10 · 装备图鉴卡（技法参考 uiverse.io/Smit-Prajapati/funny-sloth-75 (MIT)：
 * 图片区 + 右上收藏心形角标 + 底部型号/价格胶囊 + 轻微抬升）。
 *
 * 落点：运动档案「主力装备」区（球鞋/拍线/用球）+ 装备图库列表。
 * - 图片缺失（或加载失败）→ 图标占位（不出空白框）；
 * - 心形角标只在传入 `onToggleFavorite` 时才出现（不造假交互）；
 * - "抬升"在触摸端表现为按下缩放 + 浮层阴影，与 Web 的 hover 抬升同源。
 * 颜色/圆角/字号全部走 token，浅色深色同一套样式逻辑。
 */
export function GearCard({
  model,
  brand,
  price,
  imageUrl,
  favorited = false,
  onToggleFavorite,
  onPress,
  onLongPress,
  style,
  accessibilityLabel,
  testID,
}: {
  /** 型号（主标题） */
  model: string;
  /** 品牌 / 类别（副标题） */
  brand?: string | null;
  /** 价格胶囊文案（"¥899" / "市价 1.2k" 等；不传则不显示） */
  price?: string | null;
  imageUrl?: string | null;
  favorited?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const body = (
    <>
      <View style={styles.imageBox}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" transition={150} />
        ) : (
          <ThemedIcon name="cube-outline" size={26} color={colors.textFaint} />
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.model} numberOfLines={2}>
          {brand ? `${brand} ${model}` : model}
        </Text>
        {price ? (
          <View style={styles.pricePill}>
            <Text style={styles.priceText} numberOfLines={1}>{price}</Text>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[styles.wrap, style]} testID={testID}>
      {onPress || onLongPress ? (
        <PressableScale
          haptic={!onToggleFavorite}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={320}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? model}
          style={styles.press}
        >
          {body}
        </PressableScale>
      ) : (
        <View style={styles.press}>{body}</View>
      )}

      {onToggleFavorite ? (
        <Pressable
          onPress={() => {
            haptics.light();
            onToggleFavorite();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={favorited ? `取消收藏 ${model}` : `收藏 ${model}`}
          style={styles.heart}
        >
          <Ionicons
            name={favorited ? "heart" : "heart-outline"}
            size={15}
            color={favorited ? colors.danger : colors.textMuted}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      overflow: "hidden",
      ...shadows.card,
    },
    press: { gap: spacing.sm, padding: spacing.sm + 2 },
    imageBox: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    image: { width: "100%", height: "100%" },
    meta: { gap: 5 },
    model: { ...typography.caption, fontWeight: "700", color: colors.text },
    pricePill: {
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      backgroundColor: colors.accentSoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    priceText: { ...typography.micro, fontSize: 10, fontWeight: "700", color: colors.accentStrong },
    heart: {
      position: "absolute",
      right: 6,
      top: 6,
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
  });
