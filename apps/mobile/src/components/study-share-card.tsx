import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GLView } from "expo-gl";
import Svg, { Rect } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { startHoloScene, type HoloSceneHandle } from "@/lib/holo-scene";
import { studyDistribution, type StudyCardModel } from "@/lib/study-card-model";
import { useTheme } from "@/theme";
import { radius, shadows, spacing, tabularNums, typography, type ThemeColors } from "@/theme/tokens";
import { haptics } from "@/lib/haptics";

/**
 * 学习闪光分享卡（v16 P2 → v1.26 修复闪退）。
 *
 * 分层：闪光背景（三种实现见下）→ RN 视图叠加中文数据面板 → view-shot 合成整卡导出。
 *
 * ⚠️ `HOLO_GL_ENABLED` 默认 **false**：真机反馈「分享卡一出现 App 就闪退」，
 * 崩点在 `GLView`（expo-gl 在 RN `Modal` 里创建 GL 表面）+ three r186 的 WebGL2 上下文，
 * 属于**原生层**崩溃（JS 侧 try/catch 兜不住，所以不能靠 catch 解决，必须不去创建它）。
 * 关闭后走纯 RN 的静态闪光底 —— 观感略逊于着色器，但**绝不闪退**；
 * 等真机定位到具体原因（Modal 内 GL / WebGL2 能力 / 驱动）后再打开这个开关。
 */
const HOLO_GL_ENABLED = false;

/** 纯 RN 的静态闪光底：深色绒面 + 两团柔光 + 斜向扫光 + 描金内框（不创建任何 GL 表面） */
function StaticHoloBackdrop() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.staticBase]}>
      <View style={[styles.staticBlob, styles.staticBlobA]} />
      <View style={[styles.staticBlob, styles.staticBlobB]} />
      <View style={styles.staticSheen} />
      <View style={styles.staticFrame} />
    </View>
  );
}

function textOf(m: StudyCardModel): string {
  const rows = [...m.rowsLeft, ...m.rowsRight].map(([k, v]) => k + " " + v).join(" · ");
  return ["📘 " + m.title + " · " + m.collection, rows, m.tagline, "💪 " + m.technique].join("\n");
}

/** 背景层：能出图就用冻结图（截图稳定），否则跑实时 GL */
function HoloBackground({
  frozenUri,
  foil,
  onReady,
}: {
  frozenUri: string | null;
  foil: number;
  onReady: (snap: () => Promise<string | null>) => void;
}) {
  const handleRef = useRef<HoloSceneHandle | null>(null);

  useEffect(() => () => handleRef.current?.dispose(), []);

  if (frozenUri) {
    return <Image source={{ uri: frozenUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />;
  }

  // 默认路径：不碰 GL，直接静态底（onReady 不会被调用 → 分享时跳过"冻结 GL"这一步）
  if (!HOLO_GL_ENABLED) {
    void foil;
    return <StaticHoloBackdrop />;
  }

  return (
    <GLView
      style={StyleSheet.absoluteFill}
      onContextCreate={(gl) => {
        handleRef.current = startHoloScene(gl as never, { foil });
        onReady(async () => {
          try {
            const shot = await GLView.takeSnapshotAsync(gl, { format: "png" });
            // expo-gl 的类型在不同版本里可能是 { uri } 或直接 Blob/string，这里统一归一
            if (typeof shot === "string") return shot;
            const uri = (shot as { uri?: string } | null)?.uri;
            return typeof uri === "string" ? uri : null;
          } catch {
            return null;
          }
        });
      }}
    />
  );
}

/** 卡片本体（`ref` 给 captureRef 用） */
export function StudyShareCard({
  model,
  frozenUri,
  cardRef,
  onReady,
}: {
  model: StudyCardModel;
  frozenUri: string | null;
  cardRef: React.RefObject<View | null>;
  onReady: (snap: () => Promise<string | null>) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  const bars = studyDistribution(model.last14);

  return (
    <View ref={cardRef} collapsable={false} style={styles.card}>
      <HoloBackground frozenUri={frozenUri} foil={model.parameters.foil} onReady={onReady} />

      <View style={styles.overlay}>
        <View style={styles.brandRow}>
          <View style={styles.brandChip}>
            <Ionicons name="book" size={13} color="#F2D9A0" />
          </View>
          <View style={styles.brandText}>
            <Text style={styles.title}>{model.title}</Text>
            <Text style={styles.subtitle}>{model.subtitle}</Text>
          </View>
          <Text style={styles.edition}>{model.edition}</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.technique}>{model.technique}</Text>
          <Text style={styles.tagline}>{model.tagline}</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.col}>
            {model.rowsLeft.map(([k, v]) => (
              <View key={k} style={styles.row}>
                <Text style={styles.rowLabel}>{k}</Text>
                <Text style={styles.rowValue}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={styles.colDivider} />
          <View style={styles.col}>
            {model.rowsRight.map(([k, v]) => (
              <View key={k} style={styles.row}>
                <Text style={styles.rowLabel}>{k}</Text>
                <Text style={styles.rowValue}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {model.flags.length > 0 ? (
          <View style={styles.flags}>
            {model.flags.map((f) => (
              <View key={f} style={styles.flag}>
                <Text style={styles.flagText}>{f}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.chartWrap}>
          <Svg width="100%" height={44} viewBox="0 0 140 44" preserveAspectRatio="none">
            {bars.length > 0
              ? bars.map((b, i) => {
                  const h = Math.max(3, Math.round(b.ratio * 40));
                  const last = i === bars.length - 1;
                  return (
                    <Rect
                      key={b.date}
                      x={i * 10 + 1}
                      y={44 - h}
                      width={7}
                      height={h}
                      rx={3}
                      fill={last ? "#F2D9A0" : "rgba(242,217,160,0.45)"}
                    />
                  );
                })
              : null}
          </Svg>
          <Text style={styles.chartHint}>近 14 天专注分布</Text>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footer}>{model.collection}</Text>
          <Text style={styles.footer}>learn.yuanabd.cn</Text>
        </View>
      </View>
    </View>
  );
}

/** 弹层：预览 + 分享图片（主）/ 复制文字（兜底） */
export function StudyShareSheet({
  visible,
  onClose,
  model,
}: {
  visible: boolean;
  onClose: () => void;
  model: StudyCardModel;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeCardStyles(colors), [colors]);
  const cardRef = useRef<View>(null);
  const snapRef = useRef<(() => Promise<string | null>) | null>(null);
  const [frozen, setFrozen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const onReady = useCallback((snap: () => Promise<string | null>) => {
    snapRef.current = snap;
  }, []);

  const shareImage = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    haptics.soft();
    try {
      if (!frozen) {
        const uri = await snapRef.current?.();
        if (uri) {
          setFrozen(uri);
          // 等一帧让 <Image> 真正画出来再合成
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      const out = await captureRef(cardRef, { format: "png", quality: 1, result: "tmpfile" });
      if (typeof out !== "string") throw new Error("capture-failed");
      if (!(await Sharing.isAvailableAsync())) throw new Error("sharing-unavailable");
      await Sharing.shareAsync(out, { mimeType: "image/png", dialogTitle: "分享学习档案卡", UTI: "public.png" });
    } catch {
      setFailed(true);
      try {
        await Share.share({ message: textOf(model) });
      } catch {
        // 用户取消
      }
    } finally {
      setBusy(false);
    }
  }, [frozen, model]);

  const shareText = useCallback(async () => {
    haptics.soft();
    try {
      await Share.share({ message: textOf(model) });
    } catch {
      // 忽略
    }
  }, [model]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="关闭分享" />
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>分享学习档案卡</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="关闭">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={styles.previewWrap}>
          <StudyShareCard model={model} frozenUri={frozen} cardRef={cardRef} onReady={onReady} />
        </View>
        {failed ? <Text style={styles.failText}>这台设备暂时存不了图片，已改用文字分享</Text> : null}
        <View style={styles.sheetBtns}>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={shareImage} disabled={busy}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.canvas} />
            ) : (
              <Ionicons name="share-social" size={16} color={colors.canvas} />
            )}
            <Text style={styles.btnPrimaryText}>{busy ? "正在生成图片…" : "分享图片"}</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnGhost]} onPress={shareText} disabled={busy}>
            <Ionicons name="text" size={16} color={colors.textMuted} />
            <Text style={styles.btnGhostText}>复制文字</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeCardStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      backgroundColor: colors.canvas,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing["2xl"],
      gap: spacing.md,
    },
    sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    sheetTitle: { ...typography.title2, fontWeight: "800", color: colors.text },
    previewWrap: { alignItems: "center" },
    sheetBtns: { flexDirection: "row", gap: spacing.sm },
    btn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: radius.lg,
    },
    btnPrimary: { backgroundColor: colors.primary },
    btnPrimaryText: { ...typography.body, fontWeight: "800", color: colors.canvas },
    btnGhost: { backgroundColor: colors.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    btnGhostText: { ...typography.body, fontWeight: "700", color: colors.textMuted },
    failText: { ...typography.caption, color: colors.warning, textAlign: "center" },

    /* 卡片本体：深色底 + 金色文字（闪光卡的语言） */
    card: {
      width: 320,
      height: 470,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor: "#0E1220",
      ...shadows.card,
    },
    /* 静态闪光底（GL 关闭时的默认背景） */
    staticBase: { backgroundColor: "#0B1020", borderRadius: 24 },
    staticBlob: { position: "absolute", borderRadius: 999 },
    staticBlobA: {
      width: 260,
      height: 260,
      right: -90,
      top: -70,
      backgroundColor: "#5B2BB0",
      opacity: 0.55,
    },
    staticBlobB: {
      width: 240,
      height: 240,
      left: -80,
      bottom: -90,
      backgroundColor: "#0E5C7A",
      opacity: 0.5,
    },
    staticSheen: {
      position: "absolute",
      top: -120,
      bottom: -120,
      left: 78,
      width: 44,
      backgroundColor: "rgba(255,246,214,0.18)",
      transform: [{ rotate: "18deg" }],
    },
    staticFrame: {
      position: "absolute",
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(242,217,160,0.42)",
    },
    overlay: { flex: 1, padding: 18, gap: 12 },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    brandChip: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(242,217,160,0.16)",
    },
    brandText: { flex: 1, minWidth: 0 },
    title: { ...typography.callout, fontWeight: "900", color: "#F6E7C6", letterSpacing: 0.5 },
    subtitle: { ...typography.micro, fontSize: 9, letterSpacing: 1.6, color: "rgba(246,231,198,0.6)" },
    edition: { ...typography.micro, fontWeight: "800", color: "#F2D9A0", ...tabularNums },
    hero: { gap: 2 },
    technique: { fontSize: 30, fontWeight: "900", color: "#FFF3D6", letterSpacing: 0.5 },
    tagline: { ...typography.caption, color: "rgba(255,243,214,0.78)" },
    panel: {
      flexDirection: "row",
      alignItems: "stretch",
      borderRadius: radius.lg,
      backgroundColor: "rgba(8,14,24,0.55)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(242,217,160,0.45)",
      paddingVertical: 12,
    },
    col: { flex: 1, gap: 9, paddingHorizontal: 12 },
    colDivider: { width: StyleSheet.hairlineWidth, backgroundColor: "rgba(242,217,160,0.3)" },
    row: { gap: 1 },
    rowLabel: { ...typography.micro, fontSize: 9.5, color: "rgba(190,198,214,0.9)" },
    rowValue: { ...typography.callout, fontWeight: "800", color: "#FFF6E4", ...tabularNums },
    flags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    flag: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(110,140,190,0.85)",
    },
    flagText: { ...typography.micro, fontSize: 10, fontWeight: "700", color: "#F2D9A0" },
    chartWrap: { marginTop: "auto", gap: 4 },
    chartHint: { ...typography.micro, fontSize: 9, color: "rgba(190,198,214,0.7)" },
    footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    footer: { ...typography.micro, fontSize: 9, color: "rgba(190,198,214,0.65)" },
  });
