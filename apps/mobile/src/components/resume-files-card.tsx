import { makeUploadPart } from "@/lib/upload-part";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as WebBrowser from "expo-web-browser";
import { ThemedIcon } from "@/components/themed-icon";
import { Card } from "@/components/card";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { PressableScale } from "@/components/pressable-scale";
import { SkeletonList } from "@/components/skeleton";
import { UploadCard, uploadAcceptHint } from "@/components/upload-card";
import { useTheme } from "@/theme";
import type { ThemeColors } from "@/theme/tokens";
import { radius, typography } from "@/theme/tokens";
import { useAppStore } from "@/store/app-store";
import { getApiUrl } from "@/config";
import {
  RESUME_FILE_NAME_MAX,
  applyResumeDefault,
  applyResumeLabel,
  isWordResume,
  normalizeResumeFileName,
  normalizeResumeLabel,
  resumeDefaultBadge,
  resumeExtOfName,
  resumeFileMetaText,
  resumeLabelOptions,
  resumeLabelText,
  resumeRenameDraft,
  resumeRenameMaxLength,
} from "@/lib/resume-files";
import { friendlyError } from "@/lib/friendly-error";

/** 简历文件（v12 P2-2）：PDF / Word ≤5MB，文件本体在 COS 桶（resume/ 私有目录） */
interface ResumeFileRow {
  id: number;
  fileName: string;
  mime: string;
  bytes: number;
  createdAt: string;
  /** 领域标签（后端/前端/数据/算法/通用/其他），null = 未打标 */
  label?: string | null;
  /** 是否默认简历（服务端部分唯一索引 uq_resume_files_default 保证唯一） */
  isDefault?: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * 简历文件卡（P13）：
 *  - 点行 / 点文件名 → 预览（ticket + sig，5 分钟一次性票据；老实现把 30 天 token 放 URL 已下线）；
 *  - 点右侧 ⋯ 或长按 → 操作弹层（预览 / 重命名 / 删除）；
 *  - 重命名：BottomSheet 输入（预填当前主干 + 固定扩展名后缀），乐观改列表、失败回滚并提示；
 *  - 列表第二行给「类型 · 大小 · 上传日期」，文件名可读（服务端只改显示名，不动存储对象键）。
 */
export function ResumeFilesCard() {
  const { colors } = useTheme();
  const styles = useMemo2(colors);
  const token = useAppStore((s) => s.token);
  const [files, setFiles] = useState<ResumeFileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  /** 操作弹层当前针对的文件 */
  const [menuRow, setMenuRow] = useState<ResumeFileRow | null>(null);
  /** 重命名弹层当前针对的文件 */
  const [renameRow, setRenameRow] = useState<ResumeFileRow | null>(null);
  /** 领域标签弹层当前针对的文件 */
  const [labelRow, setLabelRow] = useState<ResumeFileRow | null>(null);
  const [labelBusy, setLabelBusy] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  const headers = useCallback(
    (): Record<string, string> => (token ? { Authorization: "Bearer " + token } : {}),
    [token]
  );

  const load = useCallback(async () => {
    try {
      const r = await fetch(getApiUrl() + "/api/resume-files", { headers: headers() });
      if (!r.ok) return;
      const d = await r.json();
      const list: ResumeFileRow[] = Array.isArray(d.files) ? d.files : [];
      // P1-5：label 归一（脏值当未打标）+ isDefault 转布尔；老服务端没有这两列时也能安全渲染
      setFiles(
        list.map((file) => ({
          ...file,
          label: normalizeResumeLabel(file.label),
          isDefault: Boolean(file.isDefault),
        }))
      );
    } catch {
      // 离线：保留上次
    } finally {
      setLoading(false);
    }
  }, [headers]);

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
      const { part, filename } = await makeUploadPart(asset.uri, asset.mimeType || "application/pdf", withExt);
      form.append("file", part, filename);
      setBusy(true);
      const r = await fetch(getApiUrl() + "/api/resume-files", { method: "POST", headers: headers(), body: form });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        /**
         * 真机反馈修复：约 11MB 的 PDF 上传失败，却只弹兜底文案「上传失败」看不到原因。
         * 真根因是 **nginx client_max_body_size 只有 10m → 回 413 + text/html**，
         * 于是 r.json() 取不到 error 字段（服务端 nginx 已抬到 32m）。
         * 这里把状态码与常见原因显式带出来，便于以后一眼定位。
         */
        if (r.status === 413) throw new Error("文件超过服务器上限，请压缩后重试");
        throw new Error(typeof d?.error === "string" ? d.error : "上传失败（HTTP " + r.status + "）");
      }
      await load();
    } catch (e) {
      Alert.alert("上传失败", friendlyError(e, "请稍后重试"));
    } finally {
      setBusy(false);
    }
  };

  /**
   * 预览（S2-3）：先用 Bearer 换一张 5 分钟一次性票据，再把 **票据** 拼进 URL。
   * 旧实现把 30 天会话 token 放在 ?token= 里，会被 nginx access log / 浏览器历史 /
   * Referer 带走；票据只对这一份文件有效且很快过期，泄漏面小得多。
   */
  const openWithTicket = useCallback(
    async (row: ResumeFileRow) => {
      try {
        const r = await fetch(getApiUrl() + "/api/resume-files/" + row.id + "/ticket", {
          method: "POST",
          headers: headers(),
        });
        const d = await r.json().catch(() => null);
        const sig = typeof d?.sig === "string" ? d.sig : "";
        if (!r.ok || !sig) {
          throw new Error(typeof d?.error === "string" ? d.error : "预览票据获取失败（HTTP " + r.status + "）");
        }
        const url = getApiUrl() + "/api/resume-files/" + row.id + "?sig=" + encodeURIComponent(sig);
        await WebBrowser.openBrowserAsync(url);
      } catch (e) {
        Alert.alert("打不开", friendlyError(e, "请稍后重试"));
      }
    },
    [headers]
  );

  /** Word 不能像 PDF 那样被系统浏览器内联渲染：先说明，再走系统浏览器/在线预览兜底 */
  const open = (row: ResumeFileRow) => {
    if (isWordResume(row.fileName)) {
      Alert.alert(
        "Word 文件预览",
        "系统浏览器通常不能直接渲染 Word。会用浏览器打开原始文件，多数机型会转给在线预览或让你下载后用 Word 打开。",
        [
          { text: "取消", style: "cancel" },
          { text: "用浏览器打开", onPress: () => void openWithTicket(row) },
        ]
      );
      return;
    }
    void openWithTicket(row);
  };

  const startRename = (row: ResumeFileRow) => {
    setMenuRow(null);
    setRenameRow(row);
    setRenameDraft(resumeRenameDraft(row.fileName));
    setRenameError("");
  };

  const closeRename = () => {
    if (renameBusy) return;
    setRenameRow(null);
    setRenameError("");
  };

  /**
   * 保存重命名：先乐观改列表并关弹层（手感），失败再回滚 + 提示。
   * 服务端只改显示名 file_name，存储对象键与预览链接都不变；扩展名以原文件为准。
   */
  const submitRename = async () => {
    const row = renameRow;
    if (!row || renameBusy) return;
    const normalized = normalizeResumeFileName(renameDraft, row.fileName);
    if (!normalized.ok) {
      setRenameError(normalized.error);
      return;
    }
    if (normalized.fileName === row.fileName) {
      setRenameRow(null);
      return;
    }
    const previous = files;
    setRenameError("");
    setRenameBusy(true);
    setFiles((list) => list.map((item) => (item.id === row.id ? { ...item, fileName: normalized.fileName } : item)));
    setRenameRow(null);
    try {
      const r = await fetch(getApiUrl() + "/api/resume-files/" + row.id, {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: normalized.fileName }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        throw new Error(typeof d?.error === "string" ? d.error : "重命名失败（HTTP " + r.status + "）");
      }
      const confirmed = typeof d?.fileName === "string" && d.fileName ? d.fileName : normalized.fileName;
      setFiles((list) => list.map((item) => (item.id === row.id ? { ...item, fileName: confirmed } : item)));
    } catch (e) {
      setFiles(previous);
      Alert.alert("重命名失败", friendlyError(e, "请稍后重试"));
    } finally {
      setRenameBusy(false);
    }
  };

  /**
   * 改领域标签（P1-5）：乐观更新 + 失败回滚。
   * 服务端只接受白名单（后端/前端/数据/算法/通用/其他）；null 表示清除标签。
   */
  const applyLabel = async (row: ResumeFileRow, label: string | null) => {
    if (labelBusy) return;
    const normalized = normalizeResumeLabel(label);
    const previous = files;
    setLabelBusy(true);
    setLabelRow(null);
    setFiles((list) => applyResumeLabel(list, row.id, normalized));
    try {
      const r = await fetch(getApiUrl() + "/api/resume-files/" + row.id, {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ label: normalized }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        throw new Error(typeof d?.error === "string" ? d.error : "标签保存失败（HTTP " + r.status + "）");
      }
      // 以服务端回包为准（理论上与本地一致）
      setFiles((list) => applyResumeLabel(list, row.id, normalizeResumeLabel(d?.label)));
    } catch (e) {
      setFiles(previous);
      Alert.alert("标签保存失败", friendlyError(e, "请稍后重试"));
    } finally {
      setLabelBusy(false);
    }
  };

  /**
   * 设为默认简历（P1-5）：本地先把其它行清掉（互斥），服务端在同一事务里保证最终一致；
   * 成功后重新拉列表（默认行以外可能还有并发变更），失败回滚并提示。
   */
  const setDefault = async (row: ResumeFileRow) => {
    if (row.isDefault) return;
    setMenuRow(null);
    const previous = files;
    setFiles((list) => applyResumeDefault(list, row.id));
    try {
      const r = await fetch(getApiUrl() + "/api/resume-files/" + row.id, {
        method: "PATCH",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        throw new Error(typeof d?.error === "string" ? d.error : "设置默认失败（HTTP " + r.status + "）");
      }
      await load();
    } catch (e) {
      setFiles(previous);
      Alert.alert("设置默认失败", friendlyError(e, "请稍后重试"));
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
              Alert.alert("删除失败", friendlyError(e, "请稍后重试"));
            }
          })();
        },
      },
    ]);
  };

  const renameExt = renameRow ? resumeExtOfName(renameRow.fileName) : null;
  const renameMax = renameRow ? resumeRenameMaxLength(renameRow.fileName) : undefined;

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
            <View key={row.id} style={styles.rowWrap}>
              <Pressable
                onPress={() => open(row)}
                onLongPress={() => setMenuRow(row)}
                delayLongPress={320}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={
                  "预览 " +
                  row.fileName +
                  (row.isDefault ? "（默认简历）" : "") +
                  (row.label ? "，标签 " + row.label : "") +
                  "，长按更多操作"
                }
              >
                <ThemedIcon name="document-attach-outline" size={16} color={colors.textMuted} />
                <View style={styles.rowBody}>
                  <View style={styles.rowNameRow}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {row.fileName}
                    </Text>
                    {/* P1-5：默认简历徽标 */}
                    {resumeDefaultBadge(row.isDefault) ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>默认</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.rowMetaRow}>
                    {/* P1-5：领域标签 chip（未打标不渲染，避免每行多一块灰底） */}
                    {row.label ? (
                      <View style={styles.labelChip}>
                        <Text style={styles.labelChipText}>{resumeLabelText(row.label)}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {resumeFileMetaText({ fileName: row.fileName, bytes: row.bytes, createdAt: row.createdAt })}
                    </Text>
                  </View>
                </View>
                <ThemedIcon name="open-outline" size={16} color={colors.textFaint} />
              </Pressable>
              <PressableScale
                haptic
                onPress={() => setMenuRow(row)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={"更多操作 " + row.fileName}
                style={styles.moreButton}
              >
                <ThemedIcon name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </PressableScale>
            </View>
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
      <Text style={styles.tip}>
        点文件预览，点右侧 ⋯（或长按）可重命名 / 打领域标签 / 设为默认 / 删除；文件存在你的专属目录，别人拿不到直链。
      </Text>

      {/* 操作弹层：预览 / 重命名 / 删除（比长按直接删除安全，也给重命名留入口） */}
      <BottomSheet
        visible={menuRow !== null}
        onClose={() => setMenuRow(null)}
        title={menuRow?.fileName ?? "文件操作"}
        subtitle="选择要执行的操作"
        icon="document-text-outline"
      >
        <View style={styles.menu}>
          <Button
            label="预览"
            icon="eye-outline"
            variant="secondary"
            onPress={() => {
              const row = menuRow;
              setMenuRow(null);
              if (row) open(row);
            }}
          />
          <Button
            label="重命名"
            icon="create-outline"
            variant="secondary"
            onPress={() => {
              if (menuRow) startRename(menuRow);
            }}
          />
          <Button
            label={"领域标签" + (menuRow?.label ? " · " + menuRow.label : " · 未标注")}
            icon="pricetag-outline"
            variant="secondary"
            onPress={() => {
              const row = menuRow;
              setMenuRow(null);
              // 取列表里的最新行（菜单打开期间列表可能被刷新过），避免用陈旧 label 预选
              if (row) setLabelRow(files.find((file) => file.id === row.id) ?? row);
            }}
          />
          <Button
            label={menuRow?.isDefault ? "已是默认简历" : "设为默认简历"}
            icon="star-outline"
            variant="secondary"
            disabled={menuRow?.isDefault}
            onPress={() => {
              const row = menuRow;
              if (row) void setDefault(row);
            }}
          />
          <Button
            label="删除"
            icon="trash-outline"
            variant="danger"
            onPress={() => {
              const row = menuRow;
              setMenuRow(null);
              if (row) remove(row);
            }}
          />
          <Button label="取消" icon="close" variant="ghost" onPress={() => setMenuRow(null)} />
        </View>
      </BottomSheet>

      {/* 重命名弹层：自适应高度（BottomSheet P12 autoHeight），扩展名固定为后缀不可编辑 */}
      <BottomSheet
        visible={renameRow !== null}
        onClose={closeRename}
        title="重命名简历"
        subtitle="只改显示名，文件内容与预览链接都不变"
        icon="create-outline"
      >
        <View style={styles.renameBody}>
          <Text style={styles.renameLabel}>文件名</Text>
          <View style={styles.renameInputRow}>
            <TextInput
              style={styles.renameInput}
              value={renameDraft}
              onChangeText={(text) => {
                setRenameDraft(text);
                if (renameError) setRenameError("");
              }}
              placeholder="例如：后端-社招-简历"
              placeholderTextColor={colors.textFaint}
              maxLength={renameMax}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void submitRename()}
              accessibilityLabel="新的文件名"
            />
            {renameExt ? <Text style={styles.renameExt}>.{renameExt}</Text> : null}
          </View>
          <Text style={styles.renameHint}>
            最多 {RESUME_FILE_NAME_MAX} 字符（含扩展名），不能包含 / 或 \；扩展名跟着原文件走
          </Text>
          {renameError ? <Text style={styles.renameError}>{renameError}</Text> : null}
          <View style={styles.renameActions}>
            <Button label="取消" variant="ghost" onPress={closeRename} />
            <Button
              label="保存"
              icon="checkmark"
              loading={renameBusy}
              disabled={!renameDraft.trim()}
              onPress={() => void submitRename()}
            />
          </View>
        </View>
      </BottomSheet>

      {/* 领域标签弹层（P1-5）：点一个 chip 立即保存并关闭，底部可清除标签；BottomSheet P12 自适应高度 */}
      <BottomSheet
        visible={labelRow !== null}
        onClose={() => {
          if (!labelBusy) setLabelRow(null);
        }}
        title="领域标签"
        subtitle="打一个领域标记，列表里一眼分辨投递方向"
        icon="pricetag-outline"
      >
        <View style={styles.labelBody}>
          <View style={styles.labelGrid}>
            {resumeLabelOptions(labelRow?.label).map((option) => (
              <Pressable
                key={option.label}
                onPress={() => {
                  if (labelRow) void applyLabel(labelRow, option.label);
                }}
                disabled={labelBusy || labelRow?.label === option.label}
                hitSlop={6}
                style={[styles.labelOption, option.active && styles.labelOptionActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: option.active }}
                accessibilityLabel={"标签 " + option.label}
              >
                <Text style={[styles.labelOptionText, option.active && styles.labelOptionTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button
            label="清除标签"
            icon="close-circle-outline"
            variant="ghost"
            disabled={labelBusy || !labelRow?.label}
            onPress={() => {
              if (labelRow) void applyLabel(labelRow, null);
            }}
          />
          <Text style={styles.labelHint}>标签只影响列表展示，不会改文件名与文件内容；标签由服务端白名单校验。</Text>
        </View>
      </BottomSheet>
    </Card>
  );
}

function useMemo2(colors: ThemeColors) {
  return StyleSheet.create({
    card: { gap: 10 },
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { ...typography.callout, fontWeight: "800", color: colors.text },
    hint: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    empty: { ...typography.caption, fontWeight: "400", lineHeight: 18, color: colors.textMuted },
    list: { gap: 8 },
    rowWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: radius.control,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    moreButton: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
    },
    rowBody: { flex: 1, gap: 2 },
    // 文件名占满剩余宽度，默认徽标因此贴在同一行的右侧（行内容右上角）
    rowNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowName: { ...typography.callout, fontWeight: "700", color: colors.text, flex: 1, minWidth: 0 },
    rowMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    rowMeta: { ...typography.caption, fontWeight: "400", color: colors.textMuted, flexShrink: 1 },
    /* P1-5：默认徽标 + 领域标签 chip（token 字号，不新增裸 fontSize） */
    defaultBadge: {
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: colors.primarySoft,
    },
    defaultBadgeText: { ...typography.micro, color: colors.primary },
    labelChip: {
      borderRadius: radius.pill,
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    labelChipText: { ...typography.micro, color: colors.textSecondary },
    tip: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    menu: { gap: 8 },
    renameBody: { gap: 8 },
    renameLabel: { ...typography.caption, color: colors.textMuted },
    renameInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceStrong,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    renameInput: { ...typography.body, flex: 1, color: colors.text, padding: 0 },
    renameExt: { ...typography.body, color: colors.textMuted },
    renameHint: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
    renameError: { ...typography.caption, color: colors.danger, lineHeight: 18 },
    renameActions: { flexDirection: "row", gap: 8, marginTop: 4 },
    /* 领域标签弹层 */
    labelBody: { gap: 8 },
    labelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    labelOption: {
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    labelOptionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    labelOptionText: { ...typography.caption, color: colors.text },
    labelOptionTextActive: { ...typography.caption, fontWeight: "800", color: colors.primary },
    labelHint: { ...typography.micro, color: colors.textMuted, lineHeight: 16 },
  });
}
