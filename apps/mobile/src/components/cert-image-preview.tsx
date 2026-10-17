import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { radius, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 证书大图全屏预览。
 *
 * 为什么单独抽一层 Modal：证书卡右侧的缩略图只有 100pt 出头，印章、编号、发证机关都看不清；
 * 证书是「凭证类」内容，必须能点开核对（与 Web 端点图片新窗口打开同一语义）。
 *
 * 为什么用 expo-image + contentFit="contain"：和卡片缩略图同一套解码/缓存；
 * 全屏区域按「屏幕宽 − 32、屏幕高 − 安全区 − 标题区」给一个固定框，contain 会按原图比例
 * 缩放并居中 —— 既不拉伸也不裁切，横版证书与竖版照片都完整可见。
 */
export function CertImagePreview({
  visible,
  uri,
  title,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  title: string;
  onClose: () => void;
}): React.JSX.Element | null {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // hook 全部在早退之前调用（Rules of Hooks）；没有图时不渲染 Modal
  if (!uri) return null;

  // 预留顶部关闭钮与底部标题的安全区，避免长图盖住关闭钮
  const imageWidth = Math.max(120, width - 32);
  const imageHeight = Math.max(120, height - insets.top - insets.bottom - 150);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root} accessibilityViewIsModal>
        {/* 点空白关闭：整屏背板必须放在最底层，图片本身 pointerEvents="none" 让手势落到它上面 */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="关闭证书图片预览"
        />

        <Image
          source={{ uri }}
          style={{ width: imageWidth, height: imageHeight }}
          contentFit="contain"
          transition={150}
          pointerEvents="none"
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]} pointerEvents="none">
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.hint}>点空白处关闭</Text>
        </View>

        {/* 44×44：全屏层里唯一的高频误触按钮，命中区不能再小（ui-matrix 的 44pt 下限） */}
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={[styles.close, { top: insets.top + 12 }]}
          accessibilityRole="button"
          accessibilityLabel="关闭证书图片预览"
        >
          <ThemedIcon name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // 图片预览例外用近黑背板：灰色 scrim 会让浅色证书与背景混在一起，看不清边界
    root: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 24,
      paddingTop: 12,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    title: { ...typography.callout, fontWeight: "700", color: "#FFFFFF", textAlign: "center" },
    hint: { ...typography.micro, fontWeight: "500", color: "rgba(255,255,255,0.62)" },
    close: {
      position: "absolute",
      right: 16,
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.16)",
    },
  });
