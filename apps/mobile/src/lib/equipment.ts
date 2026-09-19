import { getApiUrl } from "@/config";

/** 装备图库条目（服务端返回站内相对路径，这里补成绝对地址） */
export interface EquipmentItem {
  id: number;
  category: string;
  brand: string;
  model: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
}

function absolute(url: string): string {
  if (/^https?:/i.test(url)) return url;
  return getApiUrl().replace(/\/+$/, "") + (url.startsWith("/") ? url : "/" + url);
}

export async function fetchEquipment(params: {
  category?: string;
  q?: string;
  brand?: string;
  limit?: number;
}): Promise<EquipmentItem[]> {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.q) search.set("q", params.q);
  if (params.brand) search.set("brand", params.brand);
  search.set("limit", String(params.limit ?? 60));
  const res = await fetch(getApiUrl() + "/api/equipment?" + search.toString());
  if (!res.ok) throw new Error("图库加载失败");
  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((item: EquipmentItem) => ({ ...item, imageUrl: absolute(String(item.imageUrl ?? "")) }));
}
