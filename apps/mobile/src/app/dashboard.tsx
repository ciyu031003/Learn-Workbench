import { Redirect } from "expo-router";

/**
 * 兼容路由：V3 起首页统一为「今日」(`/today`)，dashboard 内容已并入其中。
 * 保留本文件避免旧版 OTA 客户端、深链与历史书签落到 Unmatched Route。
 */
export default function DashboardRedirect() {
  return <Redirect href="/today" />;
}
