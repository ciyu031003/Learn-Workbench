/**
 * 公开区路由组（S3-3）：不挂 AppShell、不做会话校验。
 * 目前包含 /（落地页）、/login、/share/**、/ui-preview（env 门禁）。
 */
export default function PublicGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
