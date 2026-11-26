import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import type { EdgeInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { addHydration } from "@/lib/wellbeing-client";
import { haptics } from "@/lib/haptics";
import { useAppStore } from "@/store/app-store";
import { useTheme } from "@/theme";
import { shadows, typography, type ThemeColors } from "@/theme/tokens";

/**
 * 全局橙色液态玻璃加号（对齐 demo `.tab-plus` + context menu）。
 *
 * - 与底栏并排、固定右下角；所有一级页都在；
 * - 点开按当前 Tab 给不同快捷动作（成长 = 六项健康记录）；
 * - 菜单是独立的浮层，不占底栏宽度；点空白关闭。
 */

type AddAction = {
  key: string;
  label: string;
  icon: IconName;
  route?: string;
  water?: boolean;
};

function actionsFor(pathname: string): { title: string; items: AddAction[] } {
  if (pathname.startsWith("/learn")) {
    return {
      title: "学习快捷操作",
      items: [
        { key: "quiz", label: "开始刷题", icon: "list", route: "/quiz" },
        { key: "review", label: "错题复习", icon: "reading", route: "/quiz/review" },
        { key: "read", label: "材料阅读", icon: "resume", route: "/quiz/read" },
        { key: "interview", label: "快速过题", icon: "timer", route: "/interview" },
      ],
    };
  }
  if (pathname.startsWith("/career")) {
    return {
      title: "职业快捷操作",
      items: [
        { key: "deck", label: "岗位卡组", icon: "career", route: "/job-deck" },
        { key: "jobs", label: "岗位列表", icon: "list", route: "/jobs" },
        { key: "apps", label: "我的投递", icon: "resume", route: "/applications" },
        { key: "resume", label: "简历编辑", icon: "folder", route: "/resume" },
      ],
    };
  }
  if (pathname.startsWith("/settings")) {
    return {
      title: "我的快捷操作",
      items: [
        { key: "insights", label: "数据看板", icon: "chart", route: "/growth-insights" },
        { key: "certs", label: "我的证书", icon: "award", route: "/certificates" },
        { key: "security", label: "账号安全", icon: "lock", route: "/account-security" },
        { key: "diag", label: "诊断", icon: "tools", route: "/diagnostics" },
      ],
    };
  }
  if (pathname.startsWith("/wellness")) {
    return {
      title: "快捷添加",
      items: [
        { key: "sleep", label: "睡眠", icon: "moon", route: "/sleep" },
        { key: "food", label: "饮食", icon: "food", route: "/nutrition" },
        { key: "workout", label: "训练", icon: "workout", route: "/workout-add" },
        { key: "water", label: "饮水", icon: "drop", water: true },
        { key: "weight", label: "体重", icon: "trend", route: "/trends" },
        { key: "habit", label: "习惯", icon: "check", route: "/habits" },
      ],
    };
  }
  return {
    title: "今日快捷操作",
    items: [
      { key: "tasks", label: "今日任务", icon: "list", route: "/tasks" },
      { key: "habits", label: "习惯打卡", icon: "check", route: "/habits" },
      { key: "review", label: "夜间回顾", icon: "moon", route: "/logs" },
      { key: "stats", label: "学习统计", icon: "chart", route: "/study-stats" },
    ],
  };
}

export function ContextAddFab({ insets }: { insets: EdgeInsets }) {
  const { colors, dark } = useTheme();
  const styles = makeStyles(colors, dark);
  const pathname = usePathname();
  const token = useAppStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { title, items } = actionsFor(pathname);

  const run = async (action: AddAction) => {
    haptics.light();
    if (action.water) {
      try {
        await addHydration(token, 250);
        setNote("已记录 250 ml");
        haptics.success();
        setTimeout(() => setNote(null), 1600);
      } catch {
        setNote("网络不给力，稍后再试");
      }
      return;
    }
    setOpen(false);
    if (action.route) router.push(action.route as never);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="快捷添加"
        onPress={() => {
          haptics.soft();
          setNote(null);
          setOpen(true);
        }}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <View pointerEvents="none" style={styles.fabSheen} />
        <View pointerEvents="none" style={styles.fabRing} />
        <Icon name="plus" size={26} weight="bold" color="#FFFFFF" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="关闭快捷添加" />
          <View style={[styles.menu, { bottom: insets.bottom + 96 }]}>
            <View style={styles.menuHead}>
              <Text style={styles.menuTitle}>{title}</Text>
              <Pressable
                hitSlop={8}
                onPress={() => setOpen(false)}
                style={styles.menuClose}
                accessibilityRole="button"
                accessibilityLabel="关闭"
              >
                <Icon name="close" size={15} weight="bold" color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.grid}>
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => void run(item)}
                  style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                >
                  <View style={styles.cellIcon}>
                    <Icon name={item.icon} size={17} weight="regular" color="#F45B0B" />
                  </View>
                  <Text style={styles.cellLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {note ? <Text style={styles.note}>{note}</Text> : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    fab: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#F45B0B",
      shadowColor: "#C44700",
      shadowOpacity: 0.34,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
      overflow: "hidden",
    },
    fabPressed: { transform: [{ scale: 0.92 }], shadowOpacity: 0.2 },
    fabSheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "46%",
      backgroundColor: "rgba(255,255,255,0.20)",
    },
    fabRing: {
      position: "absolute",
      top: 4,
      left: 4,
      right: 4,
      bottom: 4,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.28)",
    },
    overlay: { flex: 1, backgroundColor: "rgba(8,12,14,0.34)" },
    menu: {
      position: "absolute",
      right: 12,
      width: 300,
      borderRadius: 26,
      padding: 14,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.92)",
      backgroundColor: dark ? "rgba(26,26,25,0.96)" : "rgba(255,252,249,0.97)",
      ...shadows.floating,
    },
    menuHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    menuTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    menuClose: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: dark ? "rgba(255,255,255,0.08)" : "rgba(24,22,20,0.05)",
    },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, columnGap: 8 },
    cell: {
      width: "48%",
      flexGrow: 1,
      flexBasis: "45%",
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 10,
      borderRadius: 16,
      backgroundColor: dark ? "rgba(255,255,255,0.05)" : "#F7F4F1",
    },
    cellPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
    cellIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: dark ? "rgba(244,91,11,0.18)" : "#FFE9DE",
    },
    cellLabel: { flexShrink: 1, ...typography.meta, fontWeight: "700", color: colors.text },
    note: { marginTop: 10, ...typography.caption, fontWeight: "600", color: "#3CB349" },
  });
