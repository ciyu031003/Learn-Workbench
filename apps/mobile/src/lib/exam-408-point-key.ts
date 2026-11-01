/**
 * 408 知识点 key 的「展示前缀 / 内部主键」换算（App 侧，P7 / v1.55）。
 *
 * 与 Web 端 lib/exam-408-point-key.ts 同一语义（App 不能跨端 import Web 代码，纯函数本地复制）：
 * - API 入参 / 路由参数：yuanabd-408/* → beokayy-408/*（internalize）；
 * - 页面跳转 href：beokayy-408/* → yuanabd-408/*（externalize）。
 * 旧链接（beokayy-408/*）继续可用：知识点页收到后 internalize 再请求。
 */

export const INTERNAL_EXAM408_POINT_PREFIX = "beokayy-408/";
export const EXTERNAL_EXAM408_POINT_PREFIX = "yuanabd-408/";

export function internalizePointKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(EXTERNAL_EXAM408_POINT_PREFIX)) {
    return INTERNAL_EXAM408_POINT_PREFIX + trimmed.slice(EXTERNAL_EXAM408_POINT_PREFIX.length);
  }
  return trimmed;
}

export function externalizePointKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(INTERNAL_EXAM408_POINT_PREFIX)) {
    return EXTERNAL_EXAM408_POINT_PREFIX + trimmed.slice(INTERNAL_EXAM408_POINT_PREFIX.length);
  }
  return trimmed;
}

export function isExam408PointKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    trimmed.startsWith(INTERNAL_EXAM408_POINT_PREFIX) ||
    trimmed.startsWith(EXTERNAL_EXAM408_POINT_PREFIX)
  );
}
