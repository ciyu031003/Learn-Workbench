import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useAppStore } from "@/store/app-store";

/** 每日 Bing 壁纸背景：每天自动换一张风景照，配深色渐变遮罩保证可读性 */
export function DailyBackground({ children }: { children: React.ReactNode }) {
  const enabled = useAppStore((s) => s.backgroundEnabled);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN")
      .then((r) => r.json())
      .then((d) => {
        const img = d?.images?.[0];
        if (!alive || !img) return;
        const base: string = img.urlbase ?? "";
        const u = base
          ? "https://www.bing.com" + base + "_1080x1920.jpg"
          : "https://www.bing.com" + img.url;
        setUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.root}>
      {enabled && url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]} />
      )}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fallback: { backgroundColor: "#eef2ff" },
  overlay: { backgroundColor: "rgba(8,8,14,0.38)" },
  content: { flex: 1 },
});
