import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { ScreenHeader } from "@/components/screen-header";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { certificateStatusLabels, certificateExpiryInfo, type Certificate } from "@learn-workbench/shared";

type Status = "planned" | "preparing" | "achieved";
const STATUSES: Status[] = ["planned", "preparing", "achieved"];

/** V3 独立证书领域：移动端证书列表 + 新增（直连 /api/certificates，与 resume 页同模式） */
export default function CertificatesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);
  const [records, setRecords] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [status, setStatus] = useState<Status>("planned");
  const [expiryDate, setExpiryDate] = useState("");

  const headers = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch(getApiUrl() + "/api/certificates", { headers: headers() });
      const data = await r.json();
      if (r.ok) setRecords(data.records ?? []);
    } catch {
      // 离线保持现状
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("请填写证书名称");
      return;
    }
    setSaving(true);
    try {
      await fetch(getApiUrl() + "/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({
          name: name.trim(),
          issuer: issuer.trim(),
          status,
          expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(expiryDate.trim()) ? expiryDate.trim() : null,
        }),
      });
      setSheetOpen(false);
      setName("");
      setIssuer("");
      setStatus("planned");
      setExpiryDate("");
      await load();
    } catch (e) {
      Alert.alert("保存失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const remove = (record: Certificate) => {
    Alert.alert("删除证书", `删除「${record.name}」？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            const r = await fetch(`${getApiUrl()}/api/certificates?id=${record.id}`, { method: "DELETE", headers: headers() });
            if (r.ok) setRecords((prev) => prev.filter((x) => x.id !== record.id));
          } catch (e) {
            Alert.alert("删除失败", e instanceof Error ? e.message : "");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="我的证书" subtitle="证书 / 资格 / 认证，简历与职业雷达共用" compact />

      <PressableScale style={styles.addBtn} haptic onPress={() => setSheetOpen(true)}>
        <ThemedIcon name="add" size={17} color={colors.primary} />
        <Text style={styles.addBtnText}>添加证书</Text>
      </PressableScale>

      {loading ? (
        <SkeletonList count={4} />
      ) : records.length === 0 ? (
        <EmptyState
          icon="ribbon-outline"
          title="还没有证书"
          hint="先添加一张 CISP / HCIP，简历与职业雷达会自动引用"
        />
      ) : (
        records.map((r) => {
          const info = certificateExpiryInfo(r.expiryDate);
          const st = (r.status ?? "planned") as Status;
          return (
            <Card key={r.id} style={styles.item}>
              <View style={styles.itemHead}>
                <View style={styles.itemTitleWrap}>
                  <View style={styles.tagRow}>
                    <Text style={styles.tag}>{certificateStatusLabels[st]}</Text>
                    {info.level === "soon" || info.level === "expired" ? (
                      <Text style={[styles.warn, info.level === "expired" && styles.warnDanger]}>{info.label}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.itemTitle}>{r.name}</Text>
                  {r.issuer ? <Text style={styles.itemMuted}>{r.issuer}</Text> : null}
                </View>
                <Pressable hitSlop={8} onPress={() => remove(r)}>
                  <ThemedIcon name="trash-outline" size={18} color={colors.textFaint} />
                </Pressable>
              </View>
              {info.level === "ok" ? <Text style={styles.itemMuted}>{info.label}</Text> : null}
              {r.note ? <Text style={styles.itemContent} numberOfLines={3}>{r.note}</Text> : null}
            </Card>
          );
        })
      )}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="添加证书" height="66%">
        <View style={styles.form}>
          <Text style={styles.label}>证书名称</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="例如：CISP" placeholderTextColor={colors.textFaint} />
          <Text style={styles.label}>颁发机构（选填）</Text>
          <TextInput style={styles.input} value={issuer} onChangeText={setIssuer} placeholder="例如：中国信息安全测评中心" placeholderTextColor={colors.textFaint} />
          <Text style={styles.label}>状态</Text>
          <View style={styles.kindRow}>
            {STATUSES.map((s) => (
              <Pressable key={s} onPress={() => setStatus(s)} style={[styles.kindChip, status === s && styles.kindChipActive]}>
                <Text style={[styles.kindChipText, status === s && styles.kindChipTextActive]}>{certificateStatusLabels[s]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>有效期至（YYYY-MM-DD，选填）</Text>
          <TextInput style={styles.input} value={expiryDate} onChangeText={setExpiryDate} placeholder="2028-09-30" placeholderTextColor={colors.textFaint} autoCapitalize="none" />
          <Pressable style={[styles.primaryBtn, saving && { opacity: 0.5 }]} disabled={saving} onPress={() => void submit()}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>保存证书</Text>}
          </Pressable>
        </View>
      </BottomSheet>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    addBtn: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
    addBtnText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
    loading: { marginTop: 24, alignSelf: "center" },
    empty: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 8 },
    item: { gap: 6 },
    itemHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    itemTitleWrap: { flex: 1, minWidth: 0 },
    tagRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    tag: { fontSize: 11, fontWeight: "800", color: colors.primary },
    warn: { fontSize: 11, fontWeight: "700", color: colors.accentStrong },
    warnDanger: { color: colors.danger },
    itemTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 2 },
    itemMuted: { fontSize: 12, color: colors.textMuted },
    itemContent: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
    form: { gap: 10, paddingTop: 6 },
    label: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: "#ffffff" },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });