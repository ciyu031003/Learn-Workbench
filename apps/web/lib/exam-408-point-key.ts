/**
 * 408 知识点 key 的「展示前缀」与「内部主键」换算（P7 / v1.55）。
 *
 * 背景：数据主键仍是 beokayy-408/*（exam_408_* 表、映射、内容源全部不动），
 * 但对外 URL / 链接统一显示为 yuanabd-408/*。转换只发生在「边界」：
 * - API 入参与页面路由参数：yuanabd → beokayy（internalize）；已是 beokayy 或其它 key 原样返回；
 * - 链接 / API 返回给前端：beokayy → yuanabd（externalize）。
 *
 * 旧链接（beokayy-408/*）必须继续 200：页面 decode 后先 internalize 再查库即可兼容。
 */

export const INTERNAL_EXAM408_POINT_PREFIX = "beokayy-408/";
export const EXTERNAL_EXAM408_POINT_PREFIX = "yuanabd-408/";

/** yuanabd-408/* → beokayy-408/*；已是内部前缀 / 其它 key 原样（trim 后） */
export function internalizePointKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(EXTERNAL_EXAM408_POINT_PREFIX)) {
    return INTERNAL_EXAM408_POINT_PREFIX + trimmed.slice(EXTERNAL_EXAM408_POINT_PREFIX.length);
  }
  return trimmed;
}

/** beokayy-408/* → yuanabd-408/*；已是外部前缀 / 其它 key 原样（trim 后） */
export function externalizePointKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(INTERNAL_EXAM408_POINT_PREFIX)) {
    return EXTERNAL_EXAM408_POINT_PREFIX + trimmed.slice(INTERNAL_EXAM408_POINT_PREFIX.length);
  }
  return trimmed;
}

/** 是否 408 知识点 key（两种前缀都认；用于 API/页面参数校验） */
export function isExam408PointKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    trimmed.startsWith(INTERNAL_EXAM408_POINT_PREFIX) ||
    trimmed.startsWith(EXTERNAL_EXAM408_POINT_PREFIX)
  );
}

/** 知识点页规范链接（外部前缀；路径保持未编码的 "/"，与 catch-all 路由一致） */
export function exam408PointHref(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "/learn/408/points";
  return "/learn/408/points/" + externalizePointKey(trimmed);
}
