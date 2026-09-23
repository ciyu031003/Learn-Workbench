import { notFound } from "next/navigation";
import { PreviewClient } from "./preview-client";

/**
 * v13 UI 预览页外壳（服务端）：只有显式带 UI_PREVIEW=1 时才渲染，
 * 否则生产环境直接 404 —— 页面上不会有这条路由的入口。
 */
export const dynamic = "force-dynamic";

export default function UiPreviewPage() {
  if (process.env.NODE_ENV === "production" && process.env.UI_PREVIEW !== "1") notFound();
  return <PreviewClient />;
}
