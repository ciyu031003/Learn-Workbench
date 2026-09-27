import { useMemo } from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { useTheme } from "@/theme";
import { typography, type ThemeColors } from "@/theme/tokens";

/**
 * v16 弹层胶囊搜索（uiverse P6-3）：左图标 + 内嵌清空。
 * 防抖由调用方按既有口径（300ms + 请求序号守卫）处理，组件只负责观感。
 * v20-J4：升级为招花域通用搜索框（jobs / market 接入）——补 `onClear`（清空回调，
 * 调用方借此同步复位筛选态）与 `style`（外层布局，如横行 flex:1）。
 */
export function SheetSearchField({
  value,
  onChangeText,
  placeholder = "搜索",
  onSubmit,
  onClear,
  autoCapitalize,
  autoCorrect,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  /** 点内嵌清空钮时先清 value，再调用本回调（同步复位调用方的派生筛选态） */
  onClear?: () => void;
  /** 型号类搜索需要强制大写（如 ASTROX），默认交给系统 */
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  /** 品牌/型号名不希望被自动纠错 */
  autoCorrect?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.wrap, style]}>
      <ThemedIcon name="search-outline" size={17} color={colors.textMuted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => {
            onChangeText("");
            onClear?.();
          }}
          hitSlop={10}
          accessibilityLabel="清空搜索"
        >
          <ThemedIcon name="close-circle" size={17} color={colors.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      minHeight: 44,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    input: { flex: 1, minWidth: 0, ...typography.callout, color: colors.text, paddingVertical: 10 },
  });
