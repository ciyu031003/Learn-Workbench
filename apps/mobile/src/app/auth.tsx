import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSegment } from "@/components/v2/glass-segment";
import { Icon } from "@/components/ui/icon";
import { getApiUrl } from "@/config";
import { apiLogin } from "@/lib/sync";
import { friendlyError } from "@/lib/friendly-error";
import { haptics } from "@/lib/haptics";
import { useAppStore } from "@/store/app-store";
import { radius } from "@/theme/tokens";

/**
 * 全屏沉浸式登录 / 注册（对齐 demo 电影视觉插画 + 悬浮液态玻璃卡）。
 *
 * - 背景是分层色场 + 星点 + 地平线光晕，不依赖图片资源（离屏也能稳定渲染）；
 * - 表单悬浮在画面中央，整块是清透玻璃（BlurView + 低不透明度染色 + 高光边）；
 * - 登录与注册沿用既有接口：POST /api/auth/login（apiLogin）与 /api/auth/register；
 * - 成功后写回 setAuth，再返回上一页；不登录也可「先逛逛」。
 */
export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const setAuth = useAppStore((state) => state.setAuth);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(), []);

  const finish = (token: string, name: string) => {
    setAuth(token, name);
    haptics.success();
    if (typeof router.canGoBack === "function" && router.canGoBack()) router.back();
    else router.replace("/settings" as never);
  };

  const submit = async () => {
    if (busy) return;
    if (!username.trim() || !password) {
      setError("请输入账号和密码");
      return;
    }
    if (mode === "register") {
      if (password.length < 6) {
        setError("密码至少 6 位");
        return;
      }
      if (password !== confirm) {
        setError("两次输入的密码不一致");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        const data = await apiLogin(username.trim(), password);
        finish(data.token, data.user.username);
      } else {
        const response = await fetch(getApiUrl() + "/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "注册失败");
        finish(data.token, data.user?.username ?? username.trim());
      }
    } catch (e) {
      haptics.error();
      setError(friendlyError(e, mode === "login" ? "登录失败" : "注册失败"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* 电影感背景：深色天幕 + 两团极光 + 地平线 + 星点 */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.sky, { backgroundColor: "#0A1520" }]} />
        <View style={styles.auroraA} />
        <View style={styles.auroraB} />
        <View style={styles.horizonGlow} />
        <View style={styles.horizonLine} />
        {STARS.map((star, index) => (
          <View
            key={index}
            style={[
              styles.star,
              { left: star.x, top: star.y, width: star.s, height: star.s, opacity: star.o },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <View style={styles.brandMark}>
              <Icon name="reading" size={22} weight="fill" color="#DCEBF7" />
            </View>
            <Text style={styles.brand}>LEARN WORKBENCH</Text>
            <Text style={styles.headline}>把每一天，{`\n`}学成自己的作品。</Text>
          </View>

          <View style={styles.card}>
            <BlurView intensity={64} tint="dark" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={styles.cardTint} />
            <View pointerEvents="none" style={styles.cardSheen} />
            <View pointerEvents="none" style={styles.cardBorder} />

            <GlassSegment
              options={[
                { key: "login", label: "登录" },
                { key: "register", label: "注册" },
              ]}
              value={mode}
              onChange={(next) => {
                setMode(next);
                setError(null);
                setConfirm("");
              }}
              accessibilityLabel="登录或注册"
            />

            <View style={styles.fields}>
              <Field
                icon="me"
                placeholder="账号"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
              <Field
                icon="lock"
                placeholder="密码"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                right={
                  <Pressable
                    hitSlop={10}
                    onPress={() => setShowPass((value) => !value)}
                    accessibilityLabel={showPass ? "隐藏密码" : "显示密码"}
                  >
                    <Icon name={showPass ? "info" : "lock"} size={17} weight="regular" color="rgba(255,255,255,0.66)" />
                  </Pressable>
                }
              />
              {mode === "register" ? (
                <Field
                  icon="lock"
                  placeholder="确认密码"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showPass}
                />
              ) : null}
            </View>

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={() => void submit()}
              disabled={busy}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              accessibilityRole="button"
              accessibilityLabel={mode === "login" ? "登录" : "注册"}
            >
              <Text style={styles.ctaText}>{busy ? "请稍候…" : mode === "login" ? "进入工作台" : "创建账号"}</Text>
              <Icon name="chevron" size={16} weight="bold" color="#0B1B27" />
            </Pressable>

            <Text style={styles.terms}>登录即表示同意本地数据同步到你的云端账号</Text>
          </View>

          <Pressable
            onPress={() => router.back()}
            style={styles.skip}
            accessibilityRole="button"
            accessibilityLabel="先逛逛，不登录"
          >
            <Text style={styles.skipText}>先逛逛，不登录</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  icon,
  right,
  ...input
}: {
  icon: "me" | "lock";
  right?: ReactNode;
} & ComponentProps<typeof TextInput>) {
  const styles = useMemo(() => makeStyles(), []);
  return (
    <View style={styles.field}>
      <Icon name={icon} size={17} weight="regular" color="rgba(255,255,255,0.62)" />
      <TextInput
        {...input}
        placeholderTextColor="rgba(255,255,255,0.46)"
        style={styles.input}
        autoCorrect={false}
      />
      {right}
    </View>
  );
}

const STARS = Array.from({ length: 26 }, (_, index) => ({
  x: `${(index * 37 + 11) % 100}%` as const,
  y: `${(index * 53 + 7) % 55}%` as const,
  s: index % 4 === 0 ? 2.4 : 1.4,
  o: index % 3 === 0 ? 0.55 : 0.28,
}));

const makeStyles = () =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "#0A1520" },
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22, gap: 26 },
    sky: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
    auroraA: {
      position: "absolute",
      top: -140,
      left: -120,
      width: 420,
      height: 420,
      borderRadius: 210,
      backgroundColor: "rgba(47,116,192,0.42)",
    },
    auroraB: {
      position: "absolute",
      bottom: -170,
      right: -120,
      width: 460,
      height: 460,
      borderRadius: 230,
      backgroundColor: "rgba(47,167,155,0.30)",
    },
    horizonGlow: {
      position: "absolute",
      left: -40,
      right: -40,
      bottom: "24%",
      height: 140,
      borderRadius: 70,
      backgroundColor: "rgba(243,196,149,0.16)",
      transform: [{ scaleY: 0.4 }],
    },
    horizonLine: { position: "absolute", left: 0, right: 0, bottom: "24%", height: 1, backgroundColor: "rgba(255,255,255,0.12)" },
    star: { position: "absolute", borderRadius: 2, backgroundColor: "#EAF4FF" },
    brandBlock: { alignItems: "center", gap: 10 },
    brandMark: {
      width: 52,
      height: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.10)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.24)",
    },
    brand: { fontSize: 10, lineHeight: 14, fontWeight: "700", letterSpacing: 2.4, color: "rgba(226,240,250,0.68)" },
    headline: { fontSize: 26, lineHeight: 34, fontWeight: "700", letterSpacing: 0.2, color: "#F2F8FC", textAlign: "center" },
    card: {
      borderRadius: 26,
      overflow: "hidden",
      padding: 18,
      gap: 14,
      backgroundColor: "transparent",
    },
    cardTint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,22,32,0.42)" },
    cardSheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "42%",
      backgroundColor: "rgba(255,255,255,0.07)",
    },
    cardBorder: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.22)",
    },
    fields: { gap: 10 },
    field: {
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: radius.control,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
    },
    input: { flex: 1, fontSize: 15, lineHeight: 20, color: "#F2F8FC", paddingVertical: 0 },
    error: { fontSize: 12, lineHeight: 17, color: "#FFC9C9" },
    cta: {
      minHeight: 52,
      borderRadius: radius.control,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: "#E9F3FA",
    },
    ctaPressed: { opacity: 0.86 },
    ctaText: { fontSize: 15, fontWeight: "700", color: "#0B1B27" },
    terms: { fontSize: 10, lineHeight: 14, color: "rgba(255,255,255,0.42)", textAlign: "center" },
    skip: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 16 },
    skipText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.62)" },
  });