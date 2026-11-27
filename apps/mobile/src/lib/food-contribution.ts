import { getApiUrl } from "@/config";

export type FoodContributionInput = {
  name: string;
  unit: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  meal?: string;
};

/**
 * 把手动录入的食材匿名沉淀到公共食物库。
 *
 * 服务端按名称去重；失败不影响主流程（餐次记录已经落库或进发件箱）。
 * 不阻塞 UI：调用方用 void 触发即可。
 */
export async function contributeFoodItem(
  input: FoodContributionInput,
  headers: Record<string, string>
): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl() + "/api/foods/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(input),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
