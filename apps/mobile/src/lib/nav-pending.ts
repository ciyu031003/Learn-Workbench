/**
 * 同名路由重复 push「参数冻结」的场外参数通道（v1.51 修复）。
 *
 * 根因（真机取证 2026-11-01，nginx access log）：expo-router（~57.0.12）在 native
 * 上重复推入**同名路由**时，实例的 `useLocalSearchParams` 冻结在首次值——连续打开
 * 4 个不同科目的 408 知识点，5 次请求的 key 全部是第一次的 `ds-03-02`。对象形式与
 * 字符串 href 经 `resolveHref` 归一后是同一个 URL，**换写法无效**（v1.50 的教训）。
 *
 * 通道语义：
 * - **跳转方**在 `router.push/replace` 前调用 `setNavPendingParams(通道, 本次完整参数)`；
 *   空对象 `{}` 也是有效登记（表示"本次无参数"，如 /nutrition 无参推送），
 *   可覆盖复用实例上残留的旧 params。
 * - **目标页**在 `useFocusEffect` 里 `takeNavPendingParams(通道)` 优先消费（即取即清，
 *   返回 null 表示本次没有登记，回落到路由 params——深链/状态恢复/无参推送）。
 *   useFocusEffect 每次聚焦都会触发（冻结场景里每次点开都产生了重新请求），因此
 *   复用实例与新建实例两条路径都能拿到正确参数。
 * - **即取即清**的原因：A → 返回 → 打开 B 的正常栈场景里，B 的实例消费掉登记后，
 *   用户返回 A 的实例时不能把 A 重载成 B。
 *
 * 通道登记表（消费端 ↔ 跳转端必须成对维护，改名时全仓 grep）：
 *   quiz-408-point      /quiz/408-point?key=            exam-408.tsx
 *   quiz-chapter        /quiz/chapter?track=&stage=     quiz/[slug].tsx
 *   quiz-read           /quiz/read?track=&stage=&topic= chapter/read/session/learn
 *   quiz-session        /quiz/session?track=&mode=…     exam-408/chapter/read/review/[slug]/session
 *   quiz-paper-session  /quiz/paper-session?year=…      quiz/paper/[year].tsx
 *   nutrition           /nutrition?date=                trends.tsx
 *   workout-add         /workout-add?id=                workout.tsx
 *
 * 注意：只登记**带动态参数**的跳转。无参推送（如 wellness hub 的 /nutrition）不登记，
 * 由目标页回落 params——新实例 params 必正确；只有"推送被静默丢弃"这一罕见路径才可能
 * 让复用实例显示旧内容，与修复前的行为持平。
 */

type NavPendingParams = Record<string, string>;

const pendingByChannel = new Map<string, NavPendingParams>();

/** 跳转方在 push/replace 前调用，登记本次导航的完整参数（空对象表示"无参数"） */
export function setNavPendingParams(
  channel: string,
  params: NavPendingParams,
): void {
  pendingByChannel.set(channel, { ...params });
}

/** 目标页聚焦时调用：返回待用参数并清空（未登记返回 null，由调用方回落 params） */
export function takeNavPendingParams(
  channel: string,
): NavPendingParams | null {
  const params = pendingByChannel.get(channel);
  pendingByChannel.delete(channel);
  return params ? { ...params } : null;
}

/** 仅测试用：清空所有通道 */
export function __resetNavPending(): void {
  pendingByChannel.clear();
}
