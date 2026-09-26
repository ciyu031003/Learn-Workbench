import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { SkeletonList } from "@/components/skeleton";
import { UploadCard, uploadAcceptHint } from "@/components/upload-card";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { radius } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";

/** 简历文件（v12 P2-2）：PDF / Word ≤5MB，文件本体在 COS 桶（resume/ 私有目录） */
interface ResumeFileRow {
  id: number;
  fileName: string;
  mime: string;
  bytes: number;
  createdAt: string;
}

const MAX_BYTES = 5 * 1024 * 1024;

function sizeText(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export function ResumeFilesCard() {
  const { colors } = useTheme();
  const styles = useMemo2(colors);
  const token = useAppStore((s) => s.token);
  const [files, setFiles] = useState<ResumeFileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const headers = (): Record<string, string> => (token ? { Authorization: "Bearer " + token } : {});

  const load = useCallback(async () => {
    try {
      const r = await fetch(getApiUrl() + "/api/resume-files", { headers: headers() });
      if (!r.ok) return;
      const d = await r.json();
      setFiles(Array.isArray(d.files) ? d.files : []);
    } catch {
      // 离线：保留上次
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  /** 选文件 → 上传（类型与大小先本地拦一道，服务端还会再校验） */
  const upload = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      if (asset.size && asset.size > MAX_BYTES) {
        Alert.alert("文件太大", "简历文件上限 5MB，请压缩后再传");
        return;
      }
      /**
       * 服务端按**扩展名**校验（只认 pdf/doc/docx）。Android 各家文件提供方经常给不出带扩展名的
       * 文件名，于是被 400 掉（真机"简历上传失败"）。这里按 mime 反推扩展名补齐。
       */
      const extFromMime = (mime?: string | null): string | null => {
        const m = (mime ?? "").toLowerCase();
        if (m === "application/pdf") return "pdf";
        if (m === "application/msword") return "doc";
        if (m.includes("wordprocessingml")) return "docx";
        return null;
      };
      const rawName = asset.name ?? "";
      const withExt = /\.(pdf|doc|docx)$/i.test(rawName)
        ? rawName
        : (rawName.replace(/\.[a-z0-9]+$/i, "").trim() || "resume") + "." + (extFromMime(asset.mimeType) ?? "pdf");
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: withExt,
        type: asset.mimeType || "application/pdf",
      } as unknown as Blob);
      setBusy(true);
      const r = await fetch(getApiUrl() + "/api/resume-files", { method: "POST", headers: headers(), body: form });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw new Error(typeof d?.error === "string" ? d.error : "上传失败");
      await load();
    } catch (e) {
      Alert.alert("上传失败", e instanceof Error ? e.message : "请稍后重试");
    } finally {
      setBusy(false);
    }
  };

  /** 预览：走私有接口 + 会话 token（浏览器带不了 Bearer 头） */
  const open = async (row: ResumeFileRow) => {
    const url = getApiUrl() + "/api/resume-files/" + row.id + (token ? "?token=" + encodeURIComponent(token) : "");
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("打不开", "请稍后重试");
    }
  };

  const remove = (row: ResumeFileRow) => {
    Alert.alert("删除简历", "确定删除「" + row.fileName + "」吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              const r = await fetch(getApiUrl() + "/api/resume-files/" + row.id, { method: "DELETE", headers: headers() });
              if (!r.ok) throw new Error("删除失败");
              await load();
            } catch (e) {
              Alert.alert("删除失败", e instanceof Error ? e.message : "请稍后重试");
            }
          })();
        },
      },
    ]);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headLeft}>
          <ThemedIcon name="document-text-outline" size={18} color={colors.primary} />
          <Text style={styles.title}>简历文件</Text>
        </View>
        <Text style={styles.hint}>PDF / Word · ≤5MB</Text>
      </View>

      {loading ? (
        <SkeletonList count={2} />
      ) : files.length === 0 ? (
        <Text style={styles.empty}>还没有上传简历，从下面选一个文件（存在你的私有目录里，只有你能看）</Text>
      ) : (
        <View style={styles.list}>
          {files.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => void open(row)}
              onLongPress={() => remove(row)}
              delayLongPress={320}
              style={styles.row}
              accessibilityLabel={"预览 " + row.fileName + "，长按删除"}
            >
              <ThemedIcon name="document-attach-outline" size={16} color={colors.textMuted} />
              <View style={styles.rowBody}>
                <Text style={styles.rowName} numberOfLines={1}>{row.fileName}</Text>
                <Text style={styles.rowMeta}>
                  {sizeText(row.bytes)} · {String(row.createdAt).slice(0, 10)}
                </Text>
              </View>
              <ThemedIcon name="open-outline" size={16} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
      )}

      {/* v13 U7：上传卡（技法参考 uiverse.io/Jerome-W-90/shy-jellyfish-2, MIT）——
          expo-document-picker 的选择逻辑、大小拦截与错误提示保持原样，只换视觉 */}
      <UploadCard
        title="上传简历（PDF / Word）"
        hint="点「选择文件」挑一份，存在你的私有目录"
        acceptHint={`PDF / Word · ${uploadAcceptHint(MAX_BYTES)}`}
        busy={busy}
        onPick={() => void upload()}
        pickLabel={busy ? "上传中…" : "选择文件"}
      />
      <Text style={styles.tip}>点文件预览、长按删除；文件存在你的专属目录，别人拿不到直链。</Text>
    </Card>
  );
}

function useMemo2(colors: ThemeColors) {
  return StyleSheet.create({
    card: { gap: 10 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { fontSize: 15, fontWeight: "800", color: colors.text },
    hint: { fontSize: 11, color: colors.textMuted },
    empty: { fontSize: 12, lineHeight: 18, color: colors.textMuted },
    list: { gap: 8 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    rowBody: { flex: 1, gap: 2 },
    rowName: { fontSize: 13, fontWeight: "700", color: colors.text },
    rowMeta: { fontSize: 11, color: colors.textMuted },
    tip: { fontSize: 11, color: colors.textMuted },
  });
}
