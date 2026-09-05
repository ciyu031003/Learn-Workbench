import { Redirect } from "expo-router";

// 冷启动初始 URL 为 learnworkbench:///（空路径），
// 没有 index 路由时会落到 Unmatched Route，这里统一重定向到「今天」。
export default function Index() {
  return <Redirect href="/dashboard" />;
}
