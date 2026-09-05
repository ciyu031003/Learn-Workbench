import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { haptics } from "@/lib/haptics";
import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";

interface IdentityInfo {
  provider: string;
  nickname: string | null;
  avatarUrl: string | null;
  boundUid: string;
}

/**
 * 账号与安全：微信绑定状态、修改密码、注销账号。
 * 微信当前走网站应用扫码通道：App 内展示绑定指引，绑定动作在 Web 端完成；
 * 待开放平台「移动应用」资质就绪后接入 OpenSDK 拉起授权。
 */
export default function AccountSecurityScreen() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, dark), [colors, dark]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const username = useAppStore((s) => s.username);
  const setAuth = useAppStore((s) => s.setAuth);

  const [loading, setLoading] = useState(true);
  const [identities, setIdentities] = useState<IdentityInfo[]>([]);
  const [wechatEnabled, setWechatEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 注销
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const r = await fetch(getApiUrl() + "/api/auth/identities", {
        headers: { Authorization: "Bearer " + token },
      });
      const d = await r.json();
      if (r.ok) {
        setIdentities(d.identities ?? []);
        setWechatEnabled(!!d.wechatEnabled);
      }
    } catch {
      // 网络异常保持空态
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const wechat = identities.find((i) => i.provider === "wechat");

  const unbindWechat = () => {
    if (!token || busy) return;
    haptics.warning();
    Alert.alert("解除微信绑定", "解绑后将无法使用微信扫码登录该账号。", [
      { text: "取消", style: "cancel" },
      {
        text: "解绑",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          fetch(getApiUrl() + "/api/auth/wechat/bind", {
            method: "DELETE",
            headers: { Authorization: "Bearer " + token },
          })
            .then(async (r) => {
              const d = await r.json().catch(() => ({}));
              if (!r.ok) throw new Error(d.error ?? "解绑失败");
              haptics.success();
              setMsg("已解除微信绑定");
              await load();
            })
            .catch((e: unknown) => setMsg(e instanceof Error ? e.message : "解绑失败"))
            .finally(() => setBusy(false));
        },
      },
    ]);
  };

  const deleteAccount = () => {
    if (!token || deleteBusy) return;
    setDeleteBusy(true);
    fetch(getApiUrl() + "/api/auth/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ password: deletePassword }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "注销失败");
        haptics.success();
        setAuth(null, null);
        router.replace("/settings");
      })
      .catch((e: unknown) => {
        haptics.error();
        Alert.alert("注销失败", e instanceof Error ? e.message : "请稍后重试");
      })
      .finally(() => setDeleteBusy(false));
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>账号与安全</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!token ? (
          <Card title="未登录" subtitle="登录后可管理第三方账号绑定">
            <Text style={styles.hint}>在「我的」页登录后，这里可以管理微信绑定与账号安全。</Text>
          </Card>
        ) : (
          <>
            <Card title="微信" subtitle={wechatEnabled ? "微信扫码登录 / 绑定" : "微信服务配置中，敬请期待"}>
              {loading ? (
                <ActivityIndicator color={colors.primary} />
              ) : wechat ? (
                <View style={styles.boundRow}>
                  <View style={[styles.badge, { backgroundColor: "#07c16022" }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#07a254" />
                  </View>
                  <View style={styles.boundBody}>
                    <Text style={styles.boundTitle}>已绑定{wechat.nickname ? `：${wechat.nickname}` : ""}</Text>
                    <Text style={styles.boundSub}>绑定标识 {wechat.boundUid}</Text>
                  </View>
                  <Pressable onPress={unbindWechat} disabled={busy}>
                    <Text style={styles.unlinkText}>解除绑定</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.boundRow}>
                  <View style={[styles.badge, { backgroundColor: colors.surfaceStrong }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textMuted} />
                  </View>
                  <View style={styles.boundBody}>
                    <Text style={styles.boundTitle}>未绑定微信</Text>
                    <Text style={styles.boundSub}>
                      {wechatEnabled
                        ? "在电脑端打开 learn.yuanabd.cn → 登录 → 登录页「微信扫码登录」即可绑定本账号。"
                        : "等待管理员在服务端配置微信网站应用后开放。"}
                    </Text>
                  </View>
                </View>
              )}
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            </Card>

            <Card title="注销账号" subtitle="删除云端账号与全部数据，本机数据保留">
              {deleteOpen ? (
                <View style={styles.deleteBox}>
                  <Text style={styles.deleteHint}>
                    {identities.length > 0 && !identities.some((i) => i.provider !== "wechat")
                      ? "该账号仅微信登录，点击下方按钮即永久注销。"
                      : "请输入当前密码确认注销。"}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="当前密码"
                    placeholderTextColor={colors.textFaint}
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    secureTextEntry
                  />
                  <View style={styles.row}>
                    <PressableScale style={[styles.btn, styles.btnGhost]} onPress={() => setDeleteOpen(false)}>
                      <Text style={styles.btnGhostText}>取消</Text>
                    </PressableScale>
                    <PressableScale
                      style={[styles.btn, styles.btnDanger]}
                      onPress={deleteAccount}
                      disabled={deleteBusy}
                    >
                      {deleteBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnDangerText}>确认注销</Text>}
                    </PressableScale>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={styles.deleteEntry}
                  onPress={() => {
                    haptics.warning();
                    setDeleteOpen(true);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={styles.deleteEntryText}>注销 {username ?? "当前"} 账号…</Text>
                </Pressable>
              )}
            </Card>

            <Text style={styles.hint}>
              注销会删除云端的学习进度、任务、日志与打卡记录，且不可恢复；本机离线数据不受影响。
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors, dark: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "transparent" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 48, gap: 12 },
    boundRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    badge: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    boundBody: { flex: 1, gap: 2 },
    boundTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    boundSub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    unlinkText: { fontSize: 13, fontWeight: "700", color: colors.danger },
    msg: { fontSize: 12, color: colors.success, fontWeight: "600", marginTop: 8 },
    deleteBox: { gap: 10 },
    deleteHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
    input: {
      backgroundColor: colors.surfaceStrong,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
    },
    row: { flexDirection: "row", gap: 8 },
    btn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center" },
    btnGhost: {
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    btnGhostText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    btnDanger: { backgroundColor: colors.danger },
    btnDangerText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    deleteEntry: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
    deleteEntryText: { fontSize: 14, fontWeight: "600", color: colors.danger },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, paddingHorizontal: 4 },
  });
