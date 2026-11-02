import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { EmptyState } from "@/components/empty-state";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedIcon } from "@/components/themed-icon";
import { useHeaderTopInset } from "@/components/screen-header";
import { getApiUrl } from "@/config";
import { useLearningTracks } from "@/lib/content-store";
import { setNavPendingParams } from "@/lib/nav-pending";
import {
  RECENT_SEARCH_KEY,
  buildLearningSearchEntries,
  exam408HitRoute,
  learningEntryRoute,
  normalizeSearchQuery,
  pickExam408Groups,
  pushRecentSearch,
  sanitizeRecentSearches,
  searchLearning,
  type Exam408SearchGroup,
  type Exam408SearchResponse,
  type LocalSearchGroup,
  type SearchRoute,
} from "@/lib/search";
import { useTabBarSpace } from "@/lib/use-tab-bar-space";
import { useTheme } from "@/theme";
import { radius, spacing, typography, type ThemeColors } from "@/theme/tokens";

/**
 * P2-3 · 全局搜索（v1.62）。
 *
 * 两个源：
 * 1) 本地内容库（zustand content-store 的 LearningTrack[]，离线可用）→ 课程 / 主题 / 学习内容；
 * 2) 408 专区接口 GET /api/exam/408/search?q=（精读 + 知识点两组）；失败只降级不阻塞本地结果。
 *
 * 交互：进入自动聚焦 / 250ms 防抖 / 最近搜索（AsyncStorage ≤8，可清空）/ 加载·空·错误态 /
 * 键盘避让（ScrollView automaticallyAdjustKeyboardInsets + 点结果保持键盘不吞点击）。
 * 逻辑全在 lib/search.ts（纯函数、有单测），本文件只管渲染与跳转。
 */
const DEBOUNCE_MS = 250;
const API_TIMEOUT_MS = 6000;

type RemoteState = {
  status: "idle" | "loading" | "done" | "error";
  groups: Exam408SearchGroup[];
};

export default function GlobalSearchScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tracks = useLearningTracks();
  const entries = useMemo(() => buildLearningSearchEntries(tracks), [tracks]);
  const headerTop = useHeaderTopInset("compact");
  const tabBarSpace = useTabBarSpace();
  const inputRef = useRef<TextInput | null>(null);

  const [input, setInput] = useState("");
  /** 防抖后的实际检索词（空串 = 未搜索，展示最近搜索/引导） */
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [remote, setRemote] = useState<RemoteState>({ status: "idle", groups: [] });
  const [retryKey, setRetryKey] = useState(0);

  // 自动聚焦：autoFocus 在部分 ROM 上会被页面转场吞掉，转场后补一次 focus
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 160);
    return () => clearTimeout(timer);
  }, []);

  // 最近搜索：读盘失败按空列表处理（搜索本身不受影响）
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(RECENT_SEARCH_KEY)
      .then((raw) => {
        if (!alive) return;
        let parsed: unknown = [];
        try {
          parsed = raw ? (JSON.parse(raw) as unknown) : [];
        } catch {
          parsed = [];
        }
        setRecent(sanitizeRecentSearches(parsed));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 250ms 防抖：连续输入只在停手后检索一次
  useEffect(() => {
    const next = normalizeSearchQuery(input);
    const timer = setTimeout(() => setQuery(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const localGroups = useMemo(() => searchLearning(entries, query), [entries, query]);

  // 408 远程搜索：query 变化即取消上一发（AbortController + 6s 超时）
  useEffect(() => {
    const q = query;
    if (!q) return;
    const controller = new AbortController();
    let alive = true;
    const run = async () => {
      // 先过一拍再置 loading：避免在 effect 体里同步 setState（级联渲染）
      await Promise.resolve();
      if (!alive) return;
      setRemote({ status: "loading", groups: [] });
      const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      try {
        const response = await fetch(
          getApiUrl() + "/api/exam/408/search?q=" + encodeURIComponent(q),
          { signal: controller.signal, headers: { accept: "application/json" } },
        );
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = (await response.json()) as Exam408SearchResponse;
        if (!alive) return;
        setRemote({ status: "done", groups: pickExam408Groups(data) });
      } catch {
        if (!alive) return;
        setRemote({ status: "error", groups: [] });
      } finally {
        clearTimeout(timer);
      }
    };
    void run();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [query, retryKey]);

  const rememberSearch = useCallback((value: string) => {
    setRecent((prev) => {
      const next = pushRecentSearch(prev, value);
      void AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /** 提交搜索（键盘回车 / 点最近搜索）：立即生效并写入最近搜索 */
  const commitSearch = useCallback(
    (raw?: string) => {
      const next = normalizeSearchQuery(raw ?? input);
      if (!next) return;
      setInput(next);
      setQuery(next);
      rememberSearch(next);
    },
    [input, rememberSearch],
  );

  const clearRecent = useCallback(() => {
    setRecent([]);
    void AsyncStorage.removeItem(RECENT_SEARCH_KEY).catch(() => {});
  }, []);

  /** 命中跳转：需要场外通道的页面（阅读页 / 408 精读）先写 params，再 push */
  const openRoute = useCallback((route: SearchRoute, keyword: string) => {
    if (keyword) rememberSearch(keyword);
    if (route.navChannel && route.navParams) setNavPendingParams(route.navChannel, route.navParams);
    router.push(route.href as never);
  }, [rememberSearch]);

  const remoteLoading = remote.status === "loading";
  const remoteFailed = remote.status === "error";
  const localEmpty = localGroups.length === 0;
  const remoteEmpty = remote.status === "done" && remote.groups.length === 0;
  const showEmpty = Boolean(query) && localEmpty && remote.status !== "loading" && (remoteEmpty || remoteFailed);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: headerTop }]}>
        <PressableScale
          hitSlop={10}
          scaleTo={0.9}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="返回"
        >
          <ThemedIcon name="chevron-back" size={22} color={colors.text} />
        </PressableScale>
        <View style={styles.searchBox}>
          <ThemedIcon name="search" size={16} color={colors.textFaint} />
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            placeholder="搜索课程 / 知识点 / 408 内容"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            onSubmitEditing={() => commitSearch()}
            accessibilityLabel="全局搜索输入框"
          />
          {input ? (
            <Pressable
              hitSlop={10}
              onPress={() => {
                setInput("");
                setQuery("");
                inputRef.current?.focus();
              }}
              accessibilityRole="button"
              accessibilityLabel="清空搜索词"
            >
              <ThemedIcon name="close-circle" size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: tabBarSpace + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {!query ? (
          <>
            {recent.length > 0 ? (
              <View style={styles.block}>
                <View style={styles.blockHead}>
                  <Text style={styles.blockTitle}>最近搜索</Text>
                  <Pressable hitSlop={10} onPress={clearRecent} accessibilityRole="button" accessibilityLabel="清空最近搜索">
                    <Text style={styles.blockAction}>清空</Text>
                  </Pressable>
                </View>
                <View style={styles.chipRow}>
                  {recent.map((item) => (
                    <PressableScale
                      key={item}
                      hitSlop={4}
                      scaleTo={0.96}
                      style={styles.chip}
                      onPress={() => commitSearch(item)}
                      accessibilityRole="button"
                      accessibilityLabel={"搜索 " + item}
                    >
                      <Text style={styles.chipText} numberOfLines={1}>
                        {item}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.block}>
              <Text style={styles.blockTitle}>搜点什么</Text>
              <Text style={styles.hintText}>
                课程 / 主题 / 学习内容来自本机内容库，离线也能搜；408 精读与知识点来自专区搜索接口，
                断网时只显示本地结果，不影响阅读与刷题。
              </Text>
            </View>
          </>
        ) : (
          <>
            {localGroups.map((group) => (
              <LocalGroup
                key={group.group}
                group={group}
                keyword={query}
                onPress={(hit) => openRoute(learningEntryRoute(hit), query)}
              />
            ))}

            {remoteLoading && localEmpty ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>正在搜索 408 专区…</Text>
              </View>
            ) : null}

            {remoteFailed ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>408 搜索暂时不可用，已显示本地结果。</Text>
                <Pressable hitSlop={8} onPress={() => setRetryKey((value) => value + 1)} accessibilityRole="button" accessibilityLabel="重试 408 搜索">
                  <Text style={styles.blockAction}>重试</Text>
                </Pressable>
              </View>
            ) : null}

            {remote.groups.map((group) => (
              <RemoteGroup
                key={group.kind}
                group={group}
                keyword={query}
                onPress={(hit) => openRoute(exam408HitRoute(hit), query)}
              />
            ))}

            {showEmpty ? (
              <EmptyState
                icon="search-outline"
                title="没有找到相关内容"
                hint={"换个关键词试试，比如「索引」「死锁」「TCP」。"}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LocalGroup({
  group,
  keyword,
  onPress,
}: {
  group: LocalSearchGroup;
  keyword: string;
  onPress: (hit: LocalSearchGroup["hits"][number]) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <BlockHead title={group.label} count={group.total} keyword={keyword} />
      <View style={styles.hitList}>
        {group.hits.map((hit) => (
          <PressableScale
            key={hit.key}
            hitSlop={2}
            scaleTo={0.99}
            style={styles.hit}
            onPress={() => onPress(hit)}
            accessibilityRole="button"
            accessibilityLabel={group.label + "：" + hit.title}
          >
            <View style={styles.hitBody}>
              <Text style={styles.hitTitle} numberOfLines={1}>
                {hit.title}
              </Text>
              {hit.snippet ? (
                <Text style={styles.hitSnippet} numberOfLines={2}>
                  {hit.snippet}
                </Text>
              ) : null}
              <Text style={styles.hitMeta} numberOfLines={1}>
                {hit.meta}
              </Text>
            </View>
            <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function RemoteGroup({
  group,
  keyword,
  onPress,
}: {
  group: Exam408SearchGroup;
  keyword: string;
  onPress: (hit: Exam408SearchGroup["hits"][number]) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.block}>
      <BlockHead title={group.label} count={group.total} keyword={keyword} />
      <View style={styles.hitList}>
        {group.hits.map((hit) => (
          <PressableScale
            key={hit.kind + ":" + hit.key}
            hitSlop={2}
            scaleTo={0.99}
            style={styles.hit}
            onPress={() => onPress(hit)}
            accessibilityRole="button"
            accessibilityLabel={group.label + "：" + hit.title}
          >
            <View style={styles.hitBody}>
              <Text style={styles.hitTitle} numberOfLines={1}>
                {hit.title}
              </Text>
              {hit.snippet ? (
                <Text style={styles.hitSnippet} numberOfLines={2}>
                  {hit.snippet}
                </Text>
              ) : null}
              <Text style={styles.hitMeta} numberOfLines={1}>
                {hit.meta}
              </Text>
            </View>
            <ThemedIcon name="chevron-forward" size={15} color={colors.textFaint} />
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function BlockHead({ title, count, keyword }: { title: string; count: number; keyword: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.blockHead}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockCount} numberOfLines={1}>
        {count} 条 · 「{keyword}」
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.canvas,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    searchBox: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 38,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
    },
    input: { ...typography.body, flex: 1, minWidth: 0, color: colors.text, padding: 0 },
    scroll: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg },
    block: { gap: spacing.sm },
    blockHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
    blockTitle: { ...typography.callout, fontWeight: "800", color: colors.text },
    blockCount: { ...typography.micro, fontWeight: "400", color: colors.textMuted, flexShrink: 1 },
    blockAction: { ...typography.caption, fontWeight: "700", color: colors.primary },
    hintText: { ...typography.caption, fontWeight: "400", color: colors.textSecondary, lineHeight: 20 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    chip: {
      maxWidth: "48%",
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    chipText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
    hitList: { gap: spacing.xs },
    hit: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceStrong,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    hitBody: { flex: 1, minWidth: 0, gap: 2 },
    hitTitle: { ...typography.callout, fontWeight: "700", color: colors.text },
    hitSnippet: { ...typography.caption, fontWeight: "400", color: colors.textSecondary, lineHeight: 18 },
    hitMeta: { ...typography.micro, fontWeight: "400", color: colors.textMuted },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
    loadingText: { ...typography.caption, fontWeight: "400", color: colors.textMuted },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.warningSoft,
    },
    errorText: { ...typography.caption, fontWeight: "500", color: colors.warning, flex: 1 },
  });
