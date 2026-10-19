import { PageSkeleton } from "@/components/shell/page-skeleton";

/** 登录区路由组级 loading 边界（S6-2）：服务端取数期间显示骨架，避免白屏。 */
export default function AppGroupLoading() {
  return <PageSkeleton variant="default" />;
}
