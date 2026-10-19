import { PageSkeleton } from "@/components/shell/page-skeleton";

/** 今日页 loading 边界（S6-2）：只加骨架，不改 today 页面本身（s1-web 的改动不受影响）。 */
export default function TodayLoading() {
  return <PageSkeleton variant="today" />;
}
