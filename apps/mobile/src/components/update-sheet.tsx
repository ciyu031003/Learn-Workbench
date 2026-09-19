import { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/button";
import { useUpdateStore } from "@/store/update-store";
import { APP_VERSION_NAME, DOWNLOAD_PAGE_URL } from "@/lib/ota";
import type { ThemeColors } from "@/theme/tokens";
import { useTheme } from "@/theme";

/**
 * 应用内升级弹层（v11）：发现新版本 → 应用内下载（进度/暂停/续传）→ 校验 → 直接安装。
 * 全程不跳浏览器；安装走系统安装器，覆盖安装不丢数据与登录态。
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "未知大小";
  const mb = bytes / 1024 / 1024;
  if (mb >= 100) return mb.toFixed(0) + " MB";
  return mb.toFixed(1) + " MB";
}

export function UpdateSheet() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const visible = useUpdateStore((s) => s.visible);
  const phase = useUpdateStore((s) => s.phase);
  const target = useUpdateStore((s) => s.target);
  const progress = useUpdateStore((s) => s.progress);
  const error = useUpdateStore((s) => s.error);
  const notice = useUpdateStore((s) => s.notice);
  const dismiss = useUpdateStore((s) => s.dismiss);
  const start = useUpdateStore((s) => s.start);
  const pause = useUpdateStore((s) => s.pause);
  const resume = useUpdateStore((s) => s.resume);
  const cancel = useUpdateStore((s) => s.cancel);
  const install = useUpdateStore((s) => s.install);
  const ignore = useUpdateStore((s) => s.ignore);
  const retry = useUpdateStore((s) => s.retry);

  if (!target) return null;

  const busy = phase === "downloading" || phase === "verifying" || phase === "installing";
  const percent = Math.round((progress.ratio || 0) * 100);
  const totalText = formatBytes(target.sizeBytes ?? progress.totalBytes);

  const openBrowser = () => {
    void Linking.openURL(target.apkUrl || DOWNLOAD_PAGE_URL).catch(() => {});
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={busy ? () => {} : dismiss}
      title={"发现新版本 v" + target.versionName}
      height="74%"
    >
      <View style={styles.wrap}>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>当前 v{APP_VERSION_NAME}</Text>
          <Text style={styles.meta}>{totalText}</Text>
        </View>

        {target.releaseNotes.length > 0 ? (
          <View style={styles.notes}>
            {target.releaseNotes.slice(0, 6).map((note, index) => (
              <View key={index} style={styles.noteRow}>
                <Text style={styles.noteDot}>•</Text>
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {phase === "downloading" || phase === "paused" || phase === "verifying" || phase === "ready" ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.progressText}>
                {phase === "verifying"
                  ? "正在校验安装包…"
                  : phase === "ready"
                    ? "下载完成 · 校验通过"
                    : percent + "%"}
              </Text>
              <Text style={styles.meta}>
                {formatBytes(progress.bytesWritten)} / {totalText}
              </Text>
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.actions}>
          {phase === "available" || phase === "error" ? (
            <>
              <Button
                label={phase === "error" ? "重新下载" : "立即更新"}
                icon="cloud-download-outline"
                onPress={() => {
                  retry();
                  void start();
                }}
              />
              <Button label="稍后再说" variant="ghost" onPress={dismiss} />
              <Button label="忽略此版本" variant="ghost" onPress={() => void ignore()} />
              <Button label="用浏览器下载" variant="ghost" onPress={openBrowser} />
            </>
          ) : null}

          {phase === "downloading" ? (
            <>
              <Button label="暂停" icon="pause-outline" variant="secondary" onPress={() => void pause()} />
              <Button label="取消下载" variant="ghost" onPress={() => void cancel()} />
            </>
          ) : null}

          {phase === "paused" ? (
            <>
              <Button label="继续下载" icon="play-outline" onPress={() => void resume()} />
              <Button label="取消下载" variant="ghost" onPress={() => void cancel()} />
            </>
          ) : null}

          {phase === "verifying" ? <Button label="校验中…" loading disabled /> : null}

          {phase === "ready" ? (
            <>
              <Button label="立即安装" icon="download-outline" onPress={() => void install()} />
              <Button label="稍后安装" variant="ghost" onPress={dismiss} />
            </>
          ) : null}

          {phase === "installing" ? <Button label="正在打开安装器…" loading disabled /> : null}
        </View>

        <Text style={styles.tip}>
          覆盖安装不会清除数据，登录状态会自动保留；安装包已内置校验（大小 + sha256）。
        </Text>
      </View>
    </BottomSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { gap: 12 },
    metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    meta: { fontSize: 12, color: colors.textMuted },
    notes: { gap: 6 },
    noteRow: { flexDirection: "row", gap: 8 },
    noteDot: { fontSize: 12, lineHeight: 19, color: colors.primary },
    noteText: { flex: 1, fontSize: 12, lineHeight: 19, color: colors.text },
    progressBlock: { gap: 6 },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceMuted,
      overflow: "hidden",
    },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
    progressText: { fontSize: 12, fontWeight: "700", color: colors.text },
    error: { fontSize: 12, lineHeight: 19, color: colors.danger },
    notice: { fontSize: 12, lineHeight: 19, color: colors.textMuted },
    actions: { gap: 8, marginTop: 4 },
    tip: { fontSize: 11, lineHeight: 17, color: colors.textMuted },
  });
