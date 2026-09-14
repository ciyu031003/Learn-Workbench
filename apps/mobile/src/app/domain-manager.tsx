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
import { ThemedIcon } from "@/components/themed-icon";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { haptics } from "@/lib/haptics";
import { Card } from "@/components/card";
import { PressableScale } from "@/components/pressable-scale";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import {
  DOMAIN_KIND_LABELS,
  domainIconName,
  fetchDomains,
  createDomain,
  updateDomain,
  archiveDomain,
  restoreDomain,
  deleteDomain,
  type DomainItem,
  type DomainTemplateItem,
} from "@/lib/domains";

/** 领域图标的可选色盘（与 Web 领域取色同冷调 + 暖调语义） */
const COLOR_PALETTE = [
  "#6366f1", "#2563eb", "#0ea5e9", "#2fb3a6", "#16a34a",
  "#7c3aed", "#ea580c", "#f59e0b", "#e11d48", "#3a342c",
];

export default function DomainManagerScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const token = useAppStore((s) => s.token);

  const [loading, setLoading] = useState(true);
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [archived, setArchived] = useState<DomainItem[]>([]);
  const [templates, setTemplates] = useState<DomainTemplateItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 新建/编辑弹层状态
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<DomainItem | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [active, archivedList] = await Promise.all([
        fetchDomains({ templates: true }),
        token ? fetchDomains({ archived: true }).catch(() => ({ domains: [] })) : Promise.resolve({ domains: [] }),
      ]);
      setDomains(active.domains ?? []);
      setTemplates(active.templates ?? []);
      setArchived(archivedList.domains ?? []);
    } catch {
      setDomains([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const switchTo = async (key: string) => {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      await fetch(getApiUrl() + "/api/settings/career", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ career: key }),
      });
      haptics.success();
      setMsg("已切换领域");
    } catch {
      setMsg("切换失败：请确认已登录且 Web 服务可用");
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName("");
    setColor(COLOR_PALETTE[0]);
    setEditOpen(true);
  };

  const openCreateFromTpl = (tpl: DomainTemplateItem) => {
    setEditing(null);
    setName(tpl.name);
    setColor(tpl.color);
    setEditOpen(false);
    void doCreateFromTemplate(tpl);
  };

  const doCreateFromTemplate = async (tpl: DomainTemplateItem) => {
    if (!token) return;
    setBusy(true);
    setMsg(null);
    try {
      await createDomain({ template: tpl.key });
      haptics.success();
      setMsg(`已从模板创建「${tpl.name}」`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!token || !name.trim()) {
      setMsg("请输入领域名称");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      if (editing) {
        await updateDomain({ key: editing.career_key, name: name.trim(), color });
      } else {
        await createDomain({ name: name.trim() });
      }
      haptics.success();
      setEditOpen(false);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (item: DomainItem) => {
    if (item.owner_id === null) {
      Alert.alert("系统内置领域", "系统内置领域不可编辑，可在该域内自由编辑阶段与主题。");
      return;
    }
    setEditing(item);
    setName(item.name);
    setColor(item.color);
    setEditOpen(true);
  };

  const doArchive = (item: DomainItem) => {
    if (item.owner_id === null) return;
    Alert.alert("归档领域", `归档「${item.name}」后将从列表隐藏，可随时在「已归档」恢复。`, [
      { text: "取消", style: "cancel" },
      { text: "归档", onPress: () => void runArchive(item) },
    ]);
  };

  const runArchive = async (item: DomainItem) => {
    setBusy(true);
    try {
      await archiveDomain(item.career_key);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "归档失败");
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async (item: DomainItem) => {
    setBusy(true);
    try {
      await restoreDomain(item.career_key);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "恢复失败");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = (item: DomainItem) => {
    Alert.alert("彻底删除", `将永久删除「${item.name}」及其全部阶段、任务、记录，且不可恢复。`, [
      { text: "取消", style: "cancel" },
      { text: "彻底删除", style: "destructive", onPress: () => void runDelete(item) },
    ]);
  };

  const runDelete = async (item: DomainItem) => {
    setBusy(true);
    try {
      await deleteDomain(item.career_key);
      haptics.warning();
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <ThemedIcon name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>学习领域管理</Text>
        <Pressable onPress={openCreate} hitSlop={12} style={styles.backBtn}>
          <ThemedIcon name="add" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!token ? (
          <Card title="未登录" subtitle="登录后可创建与管理自定义领域">
            <Text style={styles.hint}>在「我的」页登录后，可新建英语、运动、阅读等任意学习领域并复用学习工具。</Text>
          </Card>
        ) : loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <>
            <Card title="我的领域" subtitle="点击切换当前领域，长按或点操作进行改色/归档">
              {domains.length === 0 ? (
                <Text style={styles.hint}>还没有领域，点右上角＋或下方模板快速创建。</Text>
              ) : (
                domains.map((d) => (
                  <DomainRow
                    key={d.career_key}
                    item={d}
                    busy={busy}
                    onSwitch={() => void switchTo(d.career_key)}
                    onEdit={() => openEdit(d)}
                    onArchive={() => doArchive(d)}
                  />
                ))
              )}
            </Card>

            {templates.length > 0 ? (
              <Card title="从模板创建" subtitle="一键复制完整学习路线为你的私有领域">
                {templates.map((t) => (
                  <PressableScale
                    key={t.key}
                    disabled={busy}
                    onPress={() => openCreateFromTpl(t)}
                    style={styles.tplRow}
                  >
                    <View style={[styles.tplIcon, { backgroundColor: t.color + "22" }]}>
                      <ThemedIcon name={domainIconName(t.icon)} size={20} color={t.color} />
                    </View>
                    <View style={styles.tplBody}>
                      <Text style={styles.tplTitle}>{t.name}</Text>
                      <Text style={styles.tplSub}>
                        {t.kindLabel} · {t.phaseCount} 阶段{(t.weeksNote ? " · " + t.weeksNote : "")}
                      </Text>
                    </View>
                    <ThemedIcon name="chevron-forward" size={16} color={colors.textFaint} />
                  </PressableScale>
                ))}
              </Card>
            ) : null}

            {archived.length > 0 ? (
              <Card title="已归档" subtitle="恢复或彻底删除归档领域">
                {archived.map((d) => (
                  <View key={d.career_key} style={styles.archivedRow}>
                    <View style={styles.archivedBody}>
                      <Text style={styles.archivedTitle}>{d.name}</Text>
                      <Text style={styles.archivedSub}>{d.kind_label ?? DOMAIN_KIND_LABELS[d.kind] ?? d.kind}</Text>
                    </View>
                    <Pressable onPress={() => void doRestore(d)} hitSlop={8}>
                      <Text style={styles.restoreText}>恢复</Text>
                    </Pressable>
                    <Pressable onPress={() => doDelete(d)} hitSlop={8}>
                      <Text style={styles.deleteText}>删除</Text>
                    </Pressable>
                  </View>
                ))}
              </Card>
            ) : null}

            {msg ? <Text style={styles.msg}>{msg}</Text> : null}
          </>
        )}
      </ScrollView>

      {/* 新建/编辑弹层 */}
      {editOpen ? (
        <View style={[styles.modalMask, { backgroundColor: colors.scrim }]}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editing ? "编辑领域" : "新建领域"}</Text>
            <TextInput
              style={styles.input}
              placeholder="领域名称（如：英语学习）"
              placeholderTextColor={colors.textFaint}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <Text style={styles.colorLabel}>主题色</Text>
            <View style={styles.palette}>
              {COLOR_PALETTE.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
                />
              ))}
            </View>
            <View style={styles.row}>
              <PressableScale style={[styles.btn, styles.btnGhost]} onPress={() => setEditOpen(false)}>
                <Text style={styles.btnGhostText}>取消</Text>
              </PressableScale>
              <PressableScale style={[styles.btn, styles.btnPrimary]} onPress={() => void saveEdit()} disabled={busy || !name.trim()}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>保存</Text>}
              </PressableScale>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function DomainRow({
  item,
  busy,
  onSwitch,
  onEdit,
  onArchive,
}: {
  item: DomainItem;
  busy: boolean;
  onSwitch: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.domainRow}>
      <PressableScale disabled={busy} onPress={onSwitch} style={styles.domainMain}>
        <View style={[styles.domainIcon, { backgroundColor: item.color + "22" }]}>
          <ThemedIcon name={domainIconName(item.icon)} size={20} color={item.color} />
        </View>
        <View style={styles.domainBody}>
          <Text style={styles.domainTitle}>{item.name}</Text>
          <Text style={styles.domainSub}>{item.kind_label ?? DOMAIN_KIND_LABELS[item.kind] ?? item.kind}</Text>
        </View>
      </PressableScale>
      {item.owner_id !== null ? (
        <View style={styles.domainActions}>
          <Pressable onPress={onEdit} hitSlop={8}>
            <ThemedIcon name="options-outline" size={16} color={colors.textMuted} />
          </Pressable>
          <Pressable onPress={onArchive} hitSlop={8}>
            <ThemedIcon name="archive-outline" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: "transparent" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
    backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 48, gap: 12 },
    loading: { marginVertical: 24 },
    hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, paddingHorizontal: 4 },
    msg: { fontSize: 13, color: colors.success, fontWeight: "600", paddingHorizontal: 4 },
    domainRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    domainMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    domainIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    domainBody: { flex: 1, gap: 2 },
    domainTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    domainSub: { fontSize: 12, color: colors.textMuted },
    domainActions: { flexDirection: "row", gap: 14 },
    tplRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
    tplIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
    tplBody: { flex: 1, gap: 2 },
    tplTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
    tplSub: { fontSize: 12, color: colors.textMuted },
    archivedRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
    archivedBody: { flex: 1, gap: 1 },
    archivedTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
    archivedSub: { fontSize: 12, color: colors.textMuted },
    restoreText: { fontSize: 13, fontWeight: "700", color: colors.primary },
    deleteText: { fontSize: 13, fontWeight: "700", color: colors.danger },
    modalMask: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", padding: 24 },
    modal: { width: "100%", backgroundColor: colors.surfaceStrong, borderRadius: 20, padding: 20, gap: 12 },
    modalTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
    input: {
      backgroundColor: colors.surface,
      borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
      paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text,
    },
    colorLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    palette: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    swatch: { width: 30, height: 30, borderRadius: 15 },
    swatchActive: { borderWidth: 3, borderColor: "#fff" },
    row: { flexDirection: "row", gap: 8, marginTop: 4 },
    btn: { flex: 1, borderRadius: 12, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
    btnGhost: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    btnGhostText: { color: colors.text, fontSize: 14, fontWeight: "600" },
    btnPrimary: { backgroundColor: colors.primary },
    btnPrimaryText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  });
