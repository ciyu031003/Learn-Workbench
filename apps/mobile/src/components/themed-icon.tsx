import { Platform, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";

/**
 * SF Symbols 优先图标（iOS 原生观感），Android 自动降级 Ionicons。
 * 用法：<ThemedIcon ios="sparkles" name="sparkles-outline" size={18} color={c} />
 * 映射表覆盖全端实际用到的 Ionicons 名（数据驱动图标如 career 卡片也在内）。
 */

const MAP: Record<string, string> = {
  // Tab 栏
  "home": "house",
  "home-outline": "house",
  "book": "book",
  "book-outline": "book",
  "person": "person.crop.circle",
  "person-outline": "person.crop.circle",
  "flower": "camera.macro",
  "flower-outline": "camera.macro",
  // 通用
  "add": "plus",
  "add-circle-outline": "plus.circle",
  "close": "xmark",
  "close-circle": "xmark.circle",
  "checkmark": "checkmark",
  "checkmark-circle": "checkmark.circle",
  "checkmark-done": "checkmark.circle.fill",
  "chevron-back": "chevron.left",
  "chevron-forward": "chevron.right",
  "chevron-up": "chevron.up",
  "chevron-down": "chevron.down",
  "search": "magnifyingglass",
  "refresh": "arrow.clockwise",
  "share-social-outline": "square.and.arrow.up",
  "open-outline": "arrow.up.forward.square",
  "trash-outline": "trash",
  "play": "play.fill",
  "pause": "pause.fill",
  "stop": "stop.fill",
  "timer": "timer",
  "flag": "flag",
  "flame": "flame",
  "sparkles": "sparkles",
  "sunny": "sun.max",
  "heart": "heart.fill",
  "heart-outline": "heart",
  "trophy": "trophy.fill",
  "alert-circle": "exclamationmark.circle.fill",
  "eye-outline": "eye",
  "eye-off-outline": "eye.slash",
  // 数据/状态
  "trending-up": "chart.line.uptrend.xyaxis",
  "trending-up-outline": "chart.line.uptrend.xyaxis",
  "cloud-offline-outline": "cloud.slash",
  "lock-closed-outline": "lock",
  "shield-checkmark-outline": "checkmark.shield",
  "person-circle-outline": "person.circle",
  "settings-outline": "gearshape",
  "options-outline": "slider.horizontal.3",
  "color-palette-outline": "paintpalette",
  "layers-outline": "square.3.layers.3d",
  "calendar-outline": "calendar",
  "compass-outline": "safari",
  "briefcase-outline": "briefcase",
  "chatbubble-ellipses-outline": "ellipsis.bubble",
  "chatbubbles-outline": "bubble.left.and.bubble.right",
  "git-branch-outline": "arrow.triangle.branch",
  "document-text-outline": "doc.text",
};

type IoniconName = keyof typeof Ionicons.glyphMap;

export function ThemedIcon({
  ios,
  name,
  size = 20,
  color,
  weight = "regular",
  style,
}: {
  ios?: string;
  name: IoniconName;
  size?: number;
  color?: string;
  weight?: "regular" | "medium" | "semibold" | "bold";
  style?: StyleProp<TextStyle>;
} & Omit<TextProps, "style">) {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={(ios ?? MAP[name] ?? "circle") as never}
        size={size}
        tintColor={color}
        weight={weight}
        style={style as never}
      />
    );
  }
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
