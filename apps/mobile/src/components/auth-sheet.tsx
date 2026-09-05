import { useEffect, useState , useMemo } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { BottomSheet } from "@/components/bottom-sheet";
import { getApiUrl } from "@/config";
import { apiLogin } from "@/lib/sync";
import { haptics } from "@/lib/haptics";
import { radius } from "@/theme/tokens";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 登录 / 注册底部抽屉：从「我的」页唤起，成功后回写会话并自动关闭。
 * 比内嵌表单更聚焦：键盘、错误提示与成功反馈都在一个独立层完成。
 */
export function AuthSheet({
  visible,
  onClose,
  onAuthed,
}: {
  visible: boolean;
  onClose: () => void;
  onAuthed: (token: string, username: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [userInput, setUserInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // 每次打开重置回登录态，避免上次的半截注册信息带来困惑
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("login");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowPass(false);
    }
  }, [visible]);

  const doLogin = async () => {
    if (!userInput.trim() || !passInput) {
      setError("请输入账号和密码");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await apiLogin(userInput.trim(), passInput);
      haptics.success();
      onAuthed(data.token, data.user.username);
      onClose();
    } catch (e) {
      haptics.error();
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    if (!userInput.trim() || !passInput) {
      setError("请输入账号和密码");
      return;
    }
    if (passInput.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    if (passInput !== confirmPass) {
      setError("两次输入的密码不一致");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(getApiUrl() + "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: userInput.trim(), password: passInput }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "注册失败");
      haptics.success();
      onAuthed(data.token, data.user?.username ?? userInput.trim());
      onClose();
    } catch (e) {
      haptics.error();
      setError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (busy) return;
    if (mode === "register") void doRegister();
    else void doLogin();
  };

  const switchMode = () => {
    haptics.soft();
    setMode((m) => (m === "login" ? "register" : "login"));
    setPassInput("");
    setConfirmPass("");
    setError(null);
    setNotice(mode === "login" ? "创建新账号，本地数据会自动同步云端" : null);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={mode === "login" ? "登录苦旅" : "创建账号"} height="82%">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.brand}>
            <View style={styles.brandLogo}>
              <ThemedIcon name="sunny" size={24} color={colors.accentStrong} />
            </View>
            <Text style={styles.brandTitle}>苦旅</Text>
            <Text style={styles.brandSub}>把每一天的学习，都变成面向未来的积累</Text>
          </View>

          <View style={styles.seg}>
            <Pressable
              style={[styles.segItem, mode === "login" && styles.segItemActive]}
              onPress={() => {
                if (mode !== "login") switchMode();
              }}
            >
              <Text style={[styles.segText, mode === "login" && styles.segTextActive]}>登录</Text>
            </Pressable>
            <Pressable
              style={[styles.segItem, mode === "register" && styles.segItemActive]}
              onPress={() => {
                if (mode !== "register") switchMode();
              }}
            >
              <Text style={[styles.segText, mode === "register" && styles.segTextActive]}>注册</Text>
            </Pressable>
          </View>

          <View style={styles.inputShell}>
            <ThemedIcon name="person-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="账号"
              placeholderTextColor={colors.textFaint}
              value={userInput}
              onChangeText={(t) => {
                setUserInput(t);
                setError(null);
              }}
              autoCapitalize="none"
              autoComplete="username"
            />
          </View>
          <View style={styles.inputShell}>
            <ThemedIcon name="lock-closed-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder={mode === "login" ? "密码" : "密码（至少 6 位）"}
              placeholderTextColor={colors.textFaint}
              value={passInput}
              onChangeText={(t) => {
                setPassInput(t);
                setError(null);
              }}
              secureTextEntry={!showPass}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
            <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8}>
              <ThemedIcon name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          {mode === "register" ? (
            <View style={[styles.inputShell, confirmPass && passInput !== confirmPass ? styles.inputMismatch : null]}>
              <ThemedIcon name="shield-checkmark-outline" size={16} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="确认密码"
                placeholderTextColor={colors.textFaint}
                value={confirmPass}
                onChangeText={(t) => {
                  setConfirmPass(t);
                  setError(null);
                }}
                secureTextEntry={!showPass}
              />
              {confirmPass && passInput === confirmPass ? (
                <ThemedIcon name="checkmark-circle" size={18} color={colors.success} />
              ) : null}
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorRow}>
              <ThemedIcon name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {notice && !error ? <Text style={styles.noticeText}>{notice}</Text> : null}

          <Pressable
            style={[styles.submit, busy || (mode === "register" && (!userInput.trim() || !passInput)) ? styles.submitDisabled : null]}
            onPress={submit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{mode === "login" ? "登 录" : "创建账号"}</Text>
            )}
          </Pressable>

          <Pressable onPress={switchMode}>
            <Text style={styles.switchText}>{mode === "login" ? "还没有账号？立即注册" : "已有账号？返回登录"}</Text>
          </Pressable>

          <Text style={styles.hint}>登录后本机数据自动同步云端；不登录也可以离线使用全部功能。</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 16, gap: 12 },
  brand: { alignItems: "center", gap: 5, paddingVertical: 4 },
  brandLogo: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
  },
  brandTitle: { fontSize: 20, fontWeight: "900", color: colors.text },
  brandSub: { fontSize: 12, color: colors.textMuted, textAlign: "center", lineHeight: 17 },
  seg: {
    flexDirection: "row",
    backgroundColor: colors.surfaceStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 4,
    marginTop: 4,
  },
  segItem: { flex: 1, borderRadius: 11, paddingVertical: 9, alignItems: "center" },
  segItemActive: { backgroundColor: colors.primary },
  segText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  segTextActive: { color: "#fff", fontWeight: "800" },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputMismatch: { borderColor: "rgba(192,69,69,0.45)" },
  input: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, fontWeight: "600" },
  noticeText: { fontSize: 12, color: colors.textMuted },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 2,
  },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800", letterSpacing: 1 },
  switchText: { fontSize: 12, color: colors.primary, fontWeight: "600", textAlign: "center", paddingVertical: 2 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, textAlign: "center", marginTop: 2 },
});
