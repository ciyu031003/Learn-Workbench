import { Platform, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";

/**
 * SF Symbols 优先图标（iOS 原生观感），Android 自动降级 Ionicons。
 * 用法：<ThemedIcon ios="sparkles" name="sparkles-outline" size={18} color={c} />
 */

const MAP: Record<string, string> = {
  "home": "house",
  "home-outline": "house",
  "book": "book",
  "book-outline": "book",
  "person": "person.crop.circle",
  "person-outline": "person.crop.circle",
  "flower": "camera.macro",
  "flower-outline": "camera.macro",
  "flame": "flame",
  "flame-outline": "flame",
  "trending-up": "chart.line.uptrend.xyaxis",
  "checkmark-circle": "checkmark.circle",
  "checkmark-circle-outline": "checkmark.circle",
  "play": "play.fill",
  "sparkles": "sparkles",
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
