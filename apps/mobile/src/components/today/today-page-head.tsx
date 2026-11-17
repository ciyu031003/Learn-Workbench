import { useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ThemedIcon } from "@/components/themed-icon";
import { haptics } from "@/lib/haptics";
import { useTheme } from "@/theme";
import { makeStyles } from "./today-styles";

/**
 * ① 页头：日期 · 周号 / 问候 / 一句话（对齐 demo .page-head），右侧通知与头像。
 * 只做展示 + 两个入口回调，数据由今日页传入。
 */
export function TodayPageHead({
  dateLabel,
  weekNo,
  greetLine,
  greetSub,
  avatarUri,
  avatarLetter,
  onOpenNotifications,
}: {
  dateLabel: string;
  weekNo: number;
  greetLine: string;
  greetSub: string;
  avatarUri: string | null;
  avatarLetter: string;
  onOpenNotifications: () => void;
}) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  return (
    <>
            {/* ① 页头：日期 · 周号 / 问候 / 一句话（对齐 demo .page-head），右侧通知与头像 */}
    <View style={styles.head}>
      <View style={styles.headCopy}>
        <Text style={styles.headDate}>{dateLabel} · 第 {weekNo} 周</Text>
        <Text style={styles.headTitle} accessibilityRole="header">{greetLine}</Text>
        <Text style={styles.headSub}>{greetSub}</Text>
      </View>
      <View style={styles.headActions}>
        <Pressable
          hitSlop={6}
          onPress={() => { haptics.light(); onOpenNotifications(); }}
          style={styles.headIconBtn}
          accessibilityRole="button"
          accessibilityLabel="通知"
        >
          <ThemedIcon name="notifications-outline" size={19} color={colors.textSecondary} />
          <View pointerEvents="none" style={styles.headBellDot} />
        </Pressable>
        <Pressable
          hitSlop={6}
          onPress={() => router.push("/settings" as never)}
          style={styles.headAvatar}
          accessibilityRole="button"
          accessibilityLabel="打开我的（设置）"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.headAvatarImage} resizeMode="cover" />
          ) : (
            <Text style={styles.headAvatarText}>{avatarLetter}</Text>
          )}
        </Pressable>
      </View>
    </View>
    </>
  );
}
