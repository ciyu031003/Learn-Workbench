/** 页面展示名：优先云端昵称，缺失时回落到登录名，再回落到品牌名 */
export function identityName(displayName: string | null | undefined, username: string | null | undefined): string {
  const nick = displayName?.trim();
  if (nick) return nick;
  const login = username?.trim();
  return login || "学习工作台";
}

/** 头像首字：按 Unicode code point 取第一个字符，避免把 emoji 切成半个 */
export function identityInitial(name: string | null | undefined): string {
  const chars = Array.from((name ?? "").trim());
  return chars[0]?.toUpperCase() ?? "旅";
}
