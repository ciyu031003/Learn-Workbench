import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Animated from "react-native-reanimated";
import { radius, shadows, typography } from "@/theme/tokens";
import {
  RefreshControl,
  Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { ThemedIcon } from "@/components/themed-icon";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton";
import { CertDetailTile, CertRow, CERT_STATUSES, CERT_STATUS_DESC, CERT_STATUS_ICON, certStatusPalette, type CertStatus } from "@/components/cert-card";
import { CertImagePreview } from "@/components/cert-image-preview";
import { FloatField } from "@/components/float-field";
import { PressButton } from "@/components/press-button";
import { ScreenHeaderLargeTitle, ScreenHeaderStickyBar, useLargeTitleHeader } from "@/components/screen-header";
import { SectionTitle } from "@/components/v2/section-title";
import { BottomSheet } from "@/components/bottom-sheet";
import { SheetListRow, SheetSection } from "@/components/sheet";
import { PressableScale } from "@/components/pressable-scale";
import { Image } from "expo-image";

import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { haptics } from "@/lib/haptics";
import type { ThemeColors } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import type { Certificate } from "@learn-workbench/shared/schemas";
import { certificateStatusLabels } from "@learn-workbench/shared/labels";
import { certificateExpiryInfo } from "@learn-workbench/shared/pure";
import { absoluteMediaUrl, deleteUpload, pickAndUploadPhoto } from "@/lib/uploads";
import { onUploadResolved } from "@/lib/upload-sync";
import { isLocalFileUri } from "@/lib/upload-outbox";
import { friendlyError } from "@/lib/friendly-error";

/** V3 独立证书领域：移动端证书列表 + 新增 + 状态流程 + 已取得图片（直连 /api/certificates） */
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
  const [status, setStatus] = useState<CertStatus>("planned");
  const [expiryDate, setExpiryDate] = useState("");
  /** v1.31：新增表单里的证书图片（复用 /api/uploads → 压 WebP → COS 桶，返回站内相对路径） */
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  /** 卡片上的状态流程：id=null 表示「更新状态」弹层关闭（交互与「我的求职」更新阶段一致） */
  const [statusSheetFor, setStatusSheetFor] = useState<number | null>(null);
  /** 正在上传图片的证书 id：同一时间只允许一条（避免并发 PATCH 同一张卡） */
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  /** 离线补发期间的本机预览图：只用于当场展示，绝不写进服务端 */
  const [localPreview, setLocalPreview] = useState<Record<number, string>>({});
  /** 全屏预览的图片地址与标题（null 表示关闭） */
  const [preview, setPreview] = useState<{ uri: string; title: string } | null>(null);
  /** 证书详情（V12：列表 → 详情主视觉，不新增独立路由） */
  const [detailId, setDetailId] = useState<number | null>(null);

  /**
   * 图片发件箱回填（组一 · 阶段 1）：离线排队补发成功后，把本机暂存 uri 换成服务端 url。
   * 本机 uri 只用于当场预览，保存时会被 isLocalFileUri 拦掉，绝不会写进服务端。
   *
   * 两张 Map 分开存：新增表单是「把 url 写回表单 state」，证书卡片是「PATCH 到对应记录」，
   * 两者语义不同，混用会让离线回填写错目标。
   */
  const formPendingApply = useRef(new Map<string, (url: string) => void>());
  const cardPendingApply = useRef(new Map<string, { id: number; oldUrl: string | null }>());

  /**
   * PATCH 一张证书。token 从 store 现取而不是用闭包里的 `token`：
   * 离线补发回调可能在登录态变化之后才触发，闭包快照会拿旧 token 打 401。
   */
  const patchCertificate = useCallback(async (id: number, patch: Record<string, unknown>): Promise<Certificate | null> => {
    const authToken = useAppStore.getState().token;
    const r = await fetch(getApiUrl() + "/api/certificates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: "Bearer " + authToken } : {}) },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => null);
      throw new Error(typeof data?.error === "string" ? data.error : "更新失败，请重试");
    }
    const data = await r.json().catch(() => null);
    return (data?.record ?? null) as Certificate | null;
  }, []);

  /** 清掉某张证书的本机预览（上传成功 / 失败都要清，避免展示一张没保存的图） */
  const clearLocalPreview = useCallback((id: number) => {
    setLocalPreview((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  /**
   * 把上传成功的 url 写进证书的 imageUrl（PATCH）。
   * 成功后替换旧图并清理上一张自己上传的 /uploads/ 资源 —— 与新增表单的换图逻辑一致，
   * 避免桶里留孤儿文件（外部 http 图不动）。
   */
  const applyImageUrl = useCallback(
    async (id: number, url: string, oldUrl: string | null | undefined) => {
      await patchCertificate(id, { imageUrl: url });
      setRecords((prev) => prev.map((x) => (x.id === id ? { ...x, imageUrl: url } : x)));
      clearLocalPreview(id);
      if (oldUrl && oldUrl !== url && oldUrl.startsWith("/uploads/")) void deleteUpload(oldUrl);
    },
    [patchCertificate, clearLocalPreview]
  );

  useEffect(
    () =>
      onUploadResolved(({ clientId, url }) => {
        const formApply = formPendingApply.current.get(clientId);
        if (formApply) {
          formPendingApply.current.delete(clientId);
          formApply(url);
          return;
        }
        const pending = cardPendingApply.current.get(clientId);
        if (!pending) return;
        cardPendingApply.current.delete(clientId);
        void applyImageUrl(pending.id, url, pending.oldUrl).catch((e) => {
          clearLocalPreview(pending.id);
          // 图已进桶但 PATCH 失败：没有记录会引用它，删掉避免孤儿文件
          void deleteUpload(url);
          Alert.alert("证书图片保存失败", friendlyError(e, "图片已上传，但没能关联到证书，请重新上传"));
        });
      }),
    [applyImageUrl, clearLocalPreview]
  );

  const headers = (): Record<string, string> => (token ? { Authorization: "Bearer " + token } : {});

  /**
   * `silent`：状态切换/传图成功后的静默刷新。
   * 非静默才拉骨架屏 —— 否则每次切状态整页闪成骨架，用户会以为数据丢了。
   */
  const load = async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    try {
      if (!silent) setLoading(true);
      const r = await fetch(getApiUrl() + "/api/certificates", { headers: headers() });
      const data = await r.json();
      if (r.ok) setRecords(data.records ?? []);
    } catch {
      // 离线保持现状
    } finally {
      if (!silent) setLoading(false);
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
   * 证书图片（新增表单）：与运动档案的证件照入口同一套上传链路（选图 + 上传一步到位）。
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
        formPendingApply.current.set(result.clientId, (url) => setPhotoUrl(url));
        Alert.alert("网络不太顺，图片已存在本机", "联网后会自动上传；先保存不会写入图片");
        return;
      }
      if (photoUrl?.startsWith("/uploads/")) void deleteUpload(photoUrl);
      setPhotoUrl(result.url);
      haptics.success();
    } catch (e) {
      Alert.alert("图片上传失败", friendlyError(e, "请稍后重试"));
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
          // 业务规则：只有「已取得」才带证书图片；待补发的图只有本机 uri，一律不入库
          imageUrl: status === "achieved" && !isLocalFileUri(photoUrl) ? photoUrl : null,
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
      await load({ silent: true });
    } catch (e) {
      Alert.alert("保存失败", friendlyError(e, "请稍后重试"));
    } finally {
      setSaving(false);
    }
  };

  /**
   * 状态流程（卡片）：乐观更新 → PATCH → 成功静默重拉；失败回滚 + 错误触觉 + 弹窗。
   * 交互与「我的求职」的更新阶段保持同构（点开动作面板 → 单选 → 立即生效）。
   */
  const changeStatus = async (record: Certificate, next: CertStatus) => {
    const prevStatus = (record.status ?? "planned") as CertStatus;
    setStatusSheetFor(null);
    if (prevStatus === next) return;

    setRecords((prev) => prev.map((x) => (x.id === record.id ? { ...x, status: next } : x)));
    haptics.success();
    try {
      await patchCertificate(record.id, { status: next });
      // 服务端确认成功才刷新（离线/失败时保留乐观态没有意义，下面会回滚）
      await load({ silent: true });
    } catch (e) {
      setRecords((prev) => prev.map((x) => (x.id === record.id ? { ...x, status: prevStatus } : x)));
      haptics.error();
      Alert.alert("状态更新失败", friendlyError(e, "请稍后重试"));
    }
  };

  /**
   * 已取得证书传图：复用 lib/uploads 的 pickAndUploadPhoto（expo/fetch FormData 已修好，不自己拼）。
   * - 上传成功：PATCH 写入 imageUrl，并替换卡片图片；
   * - 离线/服务端暂不可用：返回 queued，先本机预览，联网补发成功后再 PATCH；
   * - PATCH 失败：刚上传的图无人引用，顺手删掉避免桶里留孤儿。
   */
  const uploadCertificatePhoto = async (record: Certificate) => {
    if (uploadingId !== null) return;
    setUploadingId(record.id);
    try {
      const result = await pickAndUploadPhoto("other");
      if (result.status === "canceled") return;
      if (result.status === "queued") {
        setLocalPreview((prev) => ({ ...prev, [record.id]: result.localUri }));
        cardPendingApply.current.set(result.clientId, { id: record.id, oldUrl: record.imageUrl ?? null });
        Alert.alert("网络不太顺，图片已存在本机", "联网后会自动上传并保存到这张证书");
        return;
      }
      try {
        await applyImageUrl(record.id, result.url, record.imageUrl ?? null);
      } catch (e) {
        // 图已进桶，但 PATCH 没成功：这是唯一引用它的机会，清掉再抛给用户
        void deleteUpload(result.url);
        throw e;
      }
      haptics.success();
    } catch (e) {
      Alert.alert("图片上传失败", friendlyError(e, "请稍后重试"));
    } finally {
      setUploadingId(null);
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
            if (r.ok) {
              setRecords((prev) => prev.filter((x) => x.id !== record.id));
              clearLocalPreview(record.id);
              if (statusSheetFor === record.id) setStatusSheetFor(null);
              if (detailId === record.id) setDetailId(null);
            }
          } catch (e) {
            Alert.alert("删除失败", friendlyError(e, ""));
          }
        },
      },
    ]);
  };

  const statusTarget = statusSheetFor === null ? null : records.find((r) => r.id === statusSheetFor) ?? null;
  const statusTargetCurrent = (statusTarget?.status ?? "planned") as CertStatus;

  const resolveCertImage = (record: Certificate): string | null => {
    const raw = localPreview[record.id] ?? record.imageUrl ?? null;
    if (!raw) return null;
    return isLocalFileUri(raw) ? raw : absoluteMediaUrl(raw) ?? raw;
  };

  /** 30 天内到期 / 已过期：只提示真正需要处理的证书 */
  const attention = records
    .map((record) => ({ record, info: certificateExpiryInfo(record.expiryDate ?? null) }))
    .filter((item) => item.info.level === "soon" || item.info.level === "expired")
    .sort((a, b) => (a.info.days ?? 0) - (b.info.days ?? 0));

  const groups = [
    { key: "achieved", title: "已获得", items: records.filter((r) => (r.status ?? "planned") === "achieved") },
    { key: "preparing", title: "备考中", items: records.filter((r) => (r.status ?? "planned") === "preparing") },
    { key: "planned", title: "计划中", items: records.filter((r) => (r.status ?? "planned") === "planned") },
  ] as const;

  const detailRecord = detailId === null ? null : records.find((r) => r.id === detailId) ?? null;
  const detailImage = detailRecord ? resolveCertImage(detailRecord) : null;

  const shareCertificate = async (record: Certificate) => {
    const lines = [
      record.name,
      record.issuer,
      record.earnedDate ? "取得 " + record.earnedDate : null,
      record.expiryDate ? "有效期至 " + record.expiryDate : null,
    ].filter((line): line is string => Boolean(line));
    try {
      await Share.share({ message: lines.join("\n") });
    } catch {
      // 用户取消分享不是错误
    }
  };

  return (
    <View style={styles.root}>
      {/* v17-C2b：紧凑栏必须在滚动容器**之外**才能真吸顶（放在内容流里会跟着一起滚走） */}
      <ScreenHeaderStickyBar title="我的证书" scrollY={headerScroll.scrollY} />
      <Animated.ScrollView onScroll={headerScroll.onScroll} scrollEventThrottle={16} style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl {...control} />}>
        {/* 大标题留在内容里随内容滚走；顶部让位高度由组件自己吃 insets */}
        <ScreenHeaderLargeTitle title="我的证书" subtitle="证书 / 资格 / 认证，简历与职业雷达共用" />

      <View style={styles.statsCard}>
        <View style={styles.statsCopy}>
          <Text style={styles.statsEyebrow}>CERTIFICATES</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsValue}>{loading ? "—" : records.length}</Text>
            <Text style={styles.statsUnit}>张证书</Text>
            <View style={styles.statsDivider} />
            <View style={styles.statsMini}>
              <Text style={styles.statsMiniValue}>
                {loading ? "—" : records.filter((r) => (r.status ?? "planned") === "achieved").length}
              </Text>
              <Text style={styles.statsMiniLabel}>已获得</Text>
            </View>
            <View style={styles.statsMini}>
              <Text style={[styles.statsMiniValue, attention.length > 0 && { color: colors.accentStrong }]}>
                {loading ? "—" : attention.length}
              </Text>
              <Text style={styles.statsMiniLabel}>临期</Text>
            </View>
          </View>
        </View>
        <PressableScale
          style={styles.addCircle}
          haptic
          hitSlop={8}
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="添加证书"
        >
          <ThemedIcon name="add" size={22} color={colors.primary} />
        </PressableScale>
      </View>

      {!loading && attention.length > 0 ? (
        <PressableScale
          haptic
          scaleTo={0.985}
          onPress={() => setDetailId(attention[0].record.id)}
          style={styles.expiryCallout}
          accessibilityRole="button"
          accessibilityLabel={"查看临期证书 " + attention[0].record.name + "，" + attention[0].info.label}
        >
          <ThemedIcon name="alert-circle" size={17} color={colors.accentStrong} />
          <Text style={styles.expiryText} numberOfLines={1}>
            {attention[0].record.name} · {attention[0].info.label}
          </Text>
          <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
        </PressableScale>
      ) : null}

      {loading ? (
        <SkeletonList count={3} />
      ) : records.length === 0 ? (
        <EmptyState
          icon="ribbon-outline"
          title="还没有证书"
          hint="先添加一张 CISP / HCIP，简历与职业雷达会自动引用"
          pattern="none"
        />
      ) : (
        <>
          {groups.map((group) =>
            group.items.length === 0 ? null : (
              <View key={group.key} style={styles.group}>
                <SectionTitle
                  title={group.title}
                  style={styles.groupTitle}
                  right={<Text style={styles.listCount}>{group.items.length} 张</Text>}
                />
                <View style={styles.groupCard}>
                  {group.items.map((record, index) => (
                    <CertRow
                      key={record.id}
                      record={record}
                      last={index === group.items.length - 1}
                      onPress={() => setDetailId(record.id)}
                    />
                  ))}
                </View>
              </View>
            ),
          )}
        </>
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
          <Text style={styles.label}>状态</Text>
          <View style={styles.kindRow}>
            {CERT_STATUSES.map((s) => (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                hitSlop={8}
                style={[styles.kindChip, status === s && styles.kindChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: status === s }}
                accessibilityLabel={`状态设为${certificateStatusLabels[s]}`}
              >
                <Text style={[styles.kindChipText, status === s && styles.kindChipTextActive]}>{certificateStatusLabels[s]}</Text>
              </Pressable>
            ))}
          </View>
          {/* 状态先选，只有「已取得」才出现照片入口；不再用一行锁提示占版面 */}
          {status === "achieved" ? (
            <Pressable
              onPress={() => void changePhoto()}
              disabled={photoUploading}
              style={styles.certPhotoRow}
              accessibilityRole="button"
              accessibilityLabel="上传证书图片"
              accessibilityState={{ busy: photoUploading, disabled: photoUploading }}
            >
              {photoUrl ? (
                <Image
                  source={{ uri: isLocalFileUri(photoUrl) ? photoUrl : absoluteMediaUrl(photoUrl) ?? photoUrl }}
                  style={styles.certPhotoThumb}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.certPhotoThumb, styles.certPhotoEmpty]}>
                  <ThemedIcon ios="camera" name={photoUploading ? "cloud-upload-outline" : "camera-outline"} size={20} color={colors.textFaint} />
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
          ) : null}

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

      {/* V12 详情：证书主视觉 + 信息行 + 分享 / 状态 / 删除 */}
      <BottomSheet
        visible={detailRecord !== null}
        onClose={() => setDetailId(null)}
        title="证书详情"
        height="84%"
        scroll={false}
      >
        {detailRecord ? (
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailContent}
            showsVerticalScrollIndicator={false}
          >
            <CertDetailTile record={detailRecord} />

            <View style={styles.detailInfo}>
              <InfoLine label="颁发机构" value={detailRecord.issuer || "未填写"} />
              <InfoLine label="取得日期" value={detailRecord.earnedDate || "—"} />
              <InfoLine label="有效期" value={detailRecord.expiryDate || "长期有效"} />
              <InfoLine label="当前状态" value={certificateStatusLabels[detailRecord.status]} last />
            </View>

            {detailImage ? (
              <>
                <Pressable
                  onPress={() => setPreview({ uri: detailImage, title: detailRecord.name })}
                  style={styles.detailImageBtn}
                  accessibilityRole="button"
                  accessibilityLabel="查看证书照片"
                >
                  <Image source={{ uri: detailImage }} style={styles.detailImage} contentFit="cover" transition={160} />
                </Pressable>
                {detailRecord.status === "achieved" ? (
                  <Pressable
                    hitSlop={8}
                    onPress={() => void uploadCertificatePhoto(detailRecord)}
                    disabled={uploadingId === detailRecord.id}
                    style={styles.detailPhotoLink}
                    accessibilityRole="button"
                    accessibilityLabel="更换证书照片"
                  >
                    <ThemedIcon name="camera-outline" size={15} color={colors.primary} />
                    <Text style={styles.detailPhotoLinkText}>
                      {uploadingId === detailRecord.id ? "上传中…" : "更换照片"}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : detailRecord.status === "achieved" ? (
              <Pressable
                onPress={() => void uploadCertificatePhoto(detailRecord)}
                disabled={uploadingId === detailRecord.id}
                style={styles.detailUpload}
                accessibilityRole="button"
                accessibilityLabel="上传证书照片"
                accessibilityState={{ busy: uploadingId === detailRecord.id }}
              >
                <View style={styles.detailUploadIcon}>
                  <ThemedIcon name="camera-outline" size={19} color={colors.primary} />
                </View>
                <Text style={styles.detailUploadText}>
                  {uploadingId === detailRecord.id ? "上传中…" : "上传证书照片"}
                </Text>
                <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
              </Pressable>
            ) : null}

            <View style={styles.detailActions}>
              <PressButton
                label="分享"
                variant="ghost"
                icon="share-social-outline"
                fullWidth={false}
                style={styles.detailActionBtn}
                onPress={() => void shareCertificate(detailRecord)}
              />
              <PressButton
                label="更新状态"
                icon="ribbon-outline"
                fullWidth={false}
                style={styles.detailActionBtn}
                onPress={() => {
                  const id = detailRecord.id;
                  setDetailId(null);
                  setStatusSheetFor(id);
                }}
              />
            </View>

            <Pressable
              onPress={() => remove(detailRecord)}
              hitSlop={8}
              style={styles.detailDelete}
              accessibilityRole="button"
              accessibilityLabel={"删除证书 " + detailRecord.name}
            >
              <ThemedIcon name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.detailDeleteText}>删除证书</Text>
            </Pressable>
          </ScrollView>
        ) : null}
      </BottomSheet>

      {/*
        状态动作面板：与「我的求职」更新阶段同构（单选行 + 当前标记）。
        为什么不直接在卡片上排三个分段按钮：三档中文标签 + 44pt 命中区会挤占卡片宽度，
        而行内「更新状态」入口既省空间，又能把每档的业务含义写清楚。
      */}
      <BottomSheet
        visible={statusTarget !== null}
        onClose={() => setStatusSheetFor(null)}
        title="更新证书状态"
        subtitle={statusTarget?.name}
        icon="ribbon-outline"
        height="62%"
      >
        <SheetSection title="状态" hint="点一下立即切换并保存" last>
          {CERT_STATUSES.map((s, i) => {
            const palette = certStatusPalette(colors, s);
            const current = statusTargetCurrent === s;
            return (
              <SheetListRow
                key={s}
                mode="radio"
                title={certificateStatusLabels[s]}
                subtitle={CERT_STATUS_DESC[s]}
                icon={CERT_STATUS_ICON[s]}
                iconColor={palette.strong}
                selected={current}
                trailing={current ? <Text style={styles.currentTag}>当前</Text> : undefined}
                last={i === CERT_STATUSES.length - 1}
                onPress={() => {
                  if (statusTarget) void changeStatus(statusTarget, s);
                }}
              />
            );
          })}
        </SheetSection>
      </BottomSheet>

      <CertImagePreview
        visible={preview !== null}
        uri={preview?.uri ?? null}
        title={preview?.title ?? ""}
        onClose={() => setPreview(null)}
      />
      </Animated.ScrollView>
    </View>
  );
}

function InfoLine({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.infoLine, !last && styles.infoLineDivider]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1, backgroundColor: "transparent" },
    content: { padding: 16, gap: 12 },
    statsCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 16,
      borderRadius: radius.xl,
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    statsCopy: { flex: 1, gap: 4 },
    statsEyebrow: { ...typography.eyebrow, color: colors.textFaint, letterSpacing: 1.2 },
    statsRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    statsValue: { ...typography.numXl, color: colors.text },
    statsUnit: { ...typography.caption, color: colors.textMuted },
    statsDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: colors.border, marginHorizontal: 4 },
    statsMini: { alignItems: "flex-start", gap: 1 },
    statsMiniValue: { ...typography.title2, fontWeight: "800", color: colors.text },
    statsMiniLabel: { ...typography.micro, color: colors.textMuted },
    addCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    expiryCallout: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: 44,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: radius.control,
      backgroundColor: colors.accentSoft,
    },
    expiryText: { ...typography.caption, fontWeight: "700", color: colors.accentStrong, flex: 1 },
    group: { gap: 8 },
    groupTitle: { marginTop: 8, marginBottom: 0 },
    groupCard: {
      borderRadius: radius.xl,
      overflow: "hidden",
      backgroundColor: colors.surfaceStrong,
      ...shadows.card,
    },
    detailScroll: { flex: 1 },
    detailContent: { gap: 14, paddingBottom: 12 },
    detailInfo: {
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surfaceMuted,
    },
    infoLine: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      minHeight: 46,
      paddingHorizontal: 14,
    },
    infoLineDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    infoLabel: { ...typography.caption, color: colors.textMuted },
    infoValue: { ...typography.caption, fontWeight: "700", color: colors.text, flexShrink: 1, textAlign: "right" },
    detailImageBtn: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceMuted },
    detailImage: { width: "100%", height: 190 },
    detailPhotoLink: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      minHeight: 36,
      marginTop: -6,
    },
    detailPhotoLinkText: { ...typography.caption, fontWeight: "700", color: colors.primary },
    detailUpload: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 58,
      paddingHorizontal: 12,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    detailUploadIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceStrong,
    },
    detailUploadText: { ...typography.callout, fontWeight: "700", color: colors.primary, flex: 1 },
    detailActions: { flexDirection: "row", gap: 10 },
    detailActionBtn: { flex: 1 },
    detailDelete: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 44,
      borderRadius: radius.control,
      backgroundColor: colors.dangerSoft,
    },
    detailDeleteText: { ...typography.caption, fontWeight: "700", color: colors.danger },
    /* 主 CTA：v2 主色胶囊（高 44，图标/文字走 on-primary 色，深色下仍满足对比度） */
    addBtn: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 44,
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    addBtnText: { ...typography.callout, fontWeight: "800", color: colors.surface },
    listTitle: { marginTop: 4, marginBottom: 0, paddingHorizontal: 2 },
    listCount: { ...typography.meta, color: colors.textMuted },
    certPhotoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    certPhotoThumb: { width: 92, height: 58, borderRadius: radius.sm, backgroundColor: colors.canvas },
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
    label: { ...typography.section, color: colors.textMuted },
    kindRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    /* 状态胶囊：v2 胶囊语言（surfaceMuted 底 + radius.pill；选中主色实底配 on-primary 文字） */
    kindChip: {
      minHeight: 36,
      justifyContent: "center",
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    kindChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    kindChipText: { ...typography.caption, fontWeight: "700", color: colors.textMuted },
    kindChipTextActive: { color: colors.canvas },
    currentTag: { ...typography.micro, fontWeight: "800", color: colors.primary },
  });
