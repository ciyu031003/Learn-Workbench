import { getApiUrl } from "@/config";
import { useAppStore } from "@/store/app-store";

/**
 * AI 每日建议：登录态拉取，失败/未配置/未登录一律返回 null（调用方回落规则版建议）。
 * 服务端未配置 AI_API_KEY 时返回 503 { enabled:false }（env 门控约定）。
 */
export async function fetchAiTip(): Promise<string | null> {
  const { token } = useAppStore.getState();
  if (!token) return null;
  try {
    const r = await fetch(`${getApiUrl()}/api/ai/tip`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { tip?: unknown };
    return typeof d.tip === "string" && d.tip.trim() ? d.tip.trim() : null;
  } catch {
    return null;
  }
}
