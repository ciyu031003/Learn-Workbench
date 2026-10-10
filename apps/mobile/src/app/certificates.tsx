import { useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { radius, typography } from "@/theme/tokens";
import {
  RefreshControl,
  Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { AchievementCard } from "@/components/achievement-card";
import { FloatField } from "@/components/float-field";
import { PressButton } from "@/components/press-button";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { BottomSheet } from "@/components/bottom-sheet";
import { PressableScale } from "@/components/pressable-scale";
import { Image } from "expo-image";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { haptics } from "@/lib/haptics";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import { certificateStatusLabels, certificateExpiryInfo, type Certificate } from "@learn-workbench/shared";
import { absoluteMediaUrl, deleteUpload, pickAndUploadPhoto } from "@/lib/uploads";
import { onUploadResolved } from "@/lib/upload-sync";
import { isLocalFileUri } from "@/lib/upload-outbox";

type Status = "planned" | "preparing" | "achieved";
const STATUSES: Status[] = ["planned", "preparing", "achieved"];

/** V3 独立证书领域：移动端证书列表 + 新增（直连 /api/certificates，与 resume 页同模式） */
export default function CertificatesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const headerScroll = useLargeTitleHeader();
  const tabBarSpace = useTabBarSpace();
  const token = useAppStore((s) => s.token);
  const [records, setRecords] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [issuer, setIssuer] = useState("");
  const [status, setStatus] = useState<Status>("planned");
  const [expiryDate, setExpiryDate] = useState("");
  /** v1.31：证书图片（复用 /api/uploads → 压 WebP → COS 桶，返回站内相对路径） */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  /**
   * 图片发件箱回填（组一 · 阶段 1）：离线排队补发成功后，把本机暂存 uri 换成服务端 url。
   * 本机 uri 只用于当场预览，保存时会被 isLocalFileUri 拦掉，绝不会写进服务端。
   */
  const pendingApply = useRef(new Map<string, (url: string) => void>());
  useEffect(
    () =>
      onUploadResolved(({ clientId, url }) => {
        const apply = pendingApply.current.get(clientId);
        if (!apply) return;
        pendingApply.current.delete(clientId);
        apply(url);
      }),
    []
  );

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

  /** v18：统一走 usePullRefresh（本页有吸顶紧凑栏 → stickyHeader: true） */
  const { control } = usePullRefresh(load, { stickyHeader: true });

  /**
   * 证书图片：与运动档案的证件照入口同一套上传链路（选图 + 上传一步到位）。
   * 换图时清理上一张自己上传的 /uploads/ 资源，避免桶里留孤儿文件。
   */
  const changePhoto = async () => {
    if (photoUploading) return;
    try {
      setPhotoUploading(true);
      const result = await pickAndUploadPhoto("other");
      if (result.status === "canceled") return;
      if (result.status === "queued") {
        // 本机 uri 只用于当场预览（保存时被 isLocalFileUri 拦掉），补发成功后自动换成服务端 url
        setPhotoUrl(result.localUri);
        pendingApply.current.set(result.clientId, (url) => setPhotoUrl(url));
        Alert.alert("网络不太顺，图片已存在本机", "联网后会自动上传；先保存不会写入图片");
        return;
      }
      if (photoUrl?.startsWith("/uploads/")) void deleteUpload(photoUrl);
      setPhotoUrl(result.url);
      haptics.success();
    } catch (e) {
      Alert.alert("图片上传失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setPhotoUploading(false);
    }
  };

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
          // 待补发的图只有本机 uri：不要写进服务端（补发成功后回填再重存）
          imageUrl: isLocalFileUri(photoUrl) ? null : photoUrl,
        }),
      });
      // v19-M5：保存成功给 success 触觉
      haptics.success();
      setSheetOpen(false);
      setName("");
      setIssuer("");
      setStatus("planned");
      setExpiryDate("");
      setPhotoUrl(null);
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
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏必须在滚动容器**之外**才能真吸顶（放在内容流里会跟着一起滚走） */}
      <ScreenHeaderStickyBar title="我的证书" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...control} />}>
        {/* 大标题留在内容里随内容滚走；顶部让位高度由组件自己吃 insets */}
        <ScreenHeaderLargeTitle title="我的证书" subtitle="证书 / 资格 / 认证，简历与职业雷达共用" />

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
          pattern="bauhaus"
        />
      ) : (
        records.map((r, index) => {
          const info = certificateExpiryInfo(r.expiryDate);
          const st = (r.status ?? "planned") as Status;
          // v13 U11：证书/里程碑统一用成就卡（大图形 + 标题 + 达成日期 + 入场错峰）
          // v20-E4：tone 语义修正——绿=成功语义只留给「达成」；计划中=中性、备考中=品牌蓝
          return (
            <AchievementCard
              key={r.id}
              index={index}
              tone={st === "achieved" ? "gold" : st === "preparing" ? "blue" : "neutral"}
              emoji={st === "achieved" ? "🏆" : st === "preparing" ? "🎯" : "📘"}
              title={r.name}
              subtitle={r.issuer || null}
              date={info.level === "ok" ? info.label : null}
              right={
                <Pressable hitSlop={8} onPress={() => remove(r)} accessibilityLabel={"删除 " + r.name}>
                  <ThemedIcon name="trash-outline" size={18} color={colors.textFaint} />
                </Pressable>
              }
            >
              {/* v1.31：证书图一行一列（横向长图、满宽），不再竖版 */}
              {/* 2026-09-29 用户决策：cover → contain。证书是文档（带印章/边框），cover 会把边缘内容裁掉；
                  留白由 certImage 的 surfaceMuted 底色承担，16:10 卡片框不变（网格观感一致）。 */}
              {r.imageUrl ? (
                <Image
                  source={{ uri: absoluteMediaUrl(r.imageUrl) ?? r.imageUrl }}
                  style={styles.certImage}
                  contentFit="contain"
                  transition={200}
                />
              ) : null}
              <View style={styles.tagRow}>
                <Text style={styles.tag}>{certificateStatusLabels[st]}</Text>
                {info.level === "soon" || info.level === "expired" ? (
                  <Text style={[styles.warn, info.level === "expired" && styles.warnDanger]}>{info.label}</Text>
                ) : null}
              </View>
              {r.note ? <Text style={styles.itemContent} numberOfLines={3}>{r.note}</Text> : null}
            </AchievementCard>
          );
        })
      )}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="添加证书" height="66%">
        <View style={styles.form}>
          {/* v13 U6：浮动标签输入框（技法参考 uiverse.io/Li-Deheng/tiny-chicken-50, MIT） */}
          <FloatField label="证书名称" value={name} onChangeText={setName} placeholder="例如：CISP" />
          <FloatField
            label="颁发机构（选填）"
            value={issuer}
            onChangeText={setIssuer}
            placeholder="例如：中国信息安全测评中心"
          />
          {/* v1.31：图片入口（视觉与运动档案的证件照入口一致：缩略图 + 说明 + 可点更换；缩略图取横向比例呼应证书横图） */}
          <Pressable onPress={() => void changePhoto()} style={styles.certPhotoRow} accessibilityLabel="上传证书图片">
            {photoUrl ? (
              <Image
                source={{ uri: absoluteMediaUrl(photoUrl) ?? photoUrl }}
                style={styles.certPhotoThumb}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.certPhotoThumb, styles.certPhotoEmpty]}>
                <ThemedIcon name={photoUploading ? "cloud-upload-outline" : "camera-outline"} size={20} color={colors.textFaint} />
              </View>
            )}
            <View style={styles.certPhotoMeta}>
              <Text style={styles.certPhotoTitle}>证书图片</Text>
              <Text style={styles.certPhotoHint}>
                {photoUploading ? "上传中…" : photoUrl ? "点这里换一张" : "点这里从相册选择（横图更佳）"}
              </Text>
            </View>
            <ThemedIcon name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>

          <Text style={styles.label}>状态</Text>
          <View style={styles.kindRow}>
            {STATUSES.map((s) => (
              <Pressable key={s} onPress={() => setStatus(s)} style={[styles.kindChip, status === s && styles.kindChipActive]}>
                <Text style={[styles.kindChipText, status === s && styles.kindChipTextActive]}>{certificateStatusLabels[s]}</Text>
              </Pressable>
            ))}
          </View>
          <FloatField
            label="有效期至（YYYY-MM-DD，选填）"
            value={expiryDate}
            onChangeText={setExpiryDate}
            placeholder="2028-09-30"
            autoCapitalize="none"
          />
          {/* v13 U5：主 CTA 用按压反馈按钮 */}
          <PressButton
            label="保存证书"
            loadingLabel="保存中…"
            loading={saving}
            icon="ribbon-outline"
            onPress={() => void submit()}
          />
        </View>
      </BottomSheet>
      </Animated.ScrollView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
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
    itemTitle: {
      ...typography.headline,
      color: colors.text,
      marginTop: 2,
    },
    itemMuted: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    itemContent: {
      ...typography.callout,
      // 对比度：15pt 正文用 textMuted（#8E8E93 对白底约 3.0）低于 WCAG AA 正文 4.5。
      // 层级改由字号/字重承担（callout 15 vs headline 17），颜色回到正文色。
      color: colors.textSecondary,
    },
    certImage: {
      width: "100%",
      aspectRatio: 16 / 10,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
    },
    certPhotoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    certPhotoThumb: { width: 92, height: 58, borderRadius: radius.md, backgroundColor: colors.canvas },
    certPhotoEmpty: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    certPhotoMeta: { flex: 1, gap: 2 },
    certPhotoTitle: { fontSize: typography.callout.fontSize, fontWeight: "700", color: colors.text },
    certPhotoHint: { fontSize: typography.caption.fontSize, color: colors.textMuted },
    form: { gap: 10, paddingTop: 6 },
    label: { fontSize: typography.caption.fontSize, fontWeight: "700", color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: { borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { fontSize: typography.caption.fontSize, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: "#ffffff" },
    input: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 4 },
    primaryBtnText: { color: "#fff", fontSize: typography.callout.fontSize, fontWeight: "800" },
  });
