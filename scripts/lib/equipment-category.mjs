/**
 * 装备品类判定（爬虫与数据清洗共用）：
 * 商品名里的关键词**有优先级**——服饰 > 鞋 > 拍/底板 > 胶皮 > 手套/球棒/护具 > 线 > 手胶 > 球。
 *
 * 为什么需要它：李宁商城按「篮球 / 足球 / 羽毛球」搜出来的结果里混着球鞋、球拍、文化衫，
 * 早期版本直接按搜索词的品类入库，于是「篮球鞋」被存成了篮球、「羽毛球拍」被存成了羽毛球 ——
 * 图库里一眼就能看出错（v1.18.0 清洗掉 79 条）。
 *
 * 返回值三态：具体种类 / "apparel"（服饰，一律不收）/ "other"（认不出，不作判断）。
 */

/** 非装备（服饰/周边），一律不收 */
export const APPAREL_RE = /(短袖|文化衫|风衣|外套|长裤|短裤|背心|裙|帽|袜|毛巾|卫衣|T恤|服饰|运动服|球拍袋|发球机|球台|水壶|\bBAG\b|BACKPACK|\bCASE\b|\bCOVER\b)/i;

/** 手胶/握把类（「Racket grip」这种名字里带 RACKET，必须排在球拍判定之前） */
export const ACCESSORY_RE = /(手胶|握把|毛巾胶|\bGRIP\b|GRIPS|TOWEL ?GRIP|HEADBAND|WRISTBAND|头带|护腕带)/i;

/** 品类后缀 → 判定用的「种类」 */
export const KIND_BY_SUFFIX = {
  racket: "racket",
  bat: "bat",
  shoes: "shoes",
  string: "string",
  shuttle: "ball",
  ball: "ball",
  rubber: "rubber",
  glove: "glove",
  knee: "guard",
  guard: "guard",
  accessory: "accessory",
};

/**
 * 由商品名推种类。顺序即优先级：鞋/拍 一定要排在「球」前面（「羽毛球拍」里也有「球」）。
 * 没有任何线索（纯型号串，如 "AEROSENSA 50"）→ "other"，交给调用方按搜索词兜底。
 */
export function kindFromModel(model) {
  const text = String(model ?? "");
  if (!text.trim()) return "other";
  if (APPAREL_RE.test(text)) return "apparel";
  if (/鞋|SHOES/i.test(text)) return "shoes";
  // 「Racket grip / 毛巾胶」是手胶不是球拍：配件判定要排在球拍前面
  if (ACCESSORY_RE.test(text)) return "accessory";
  if (/球拍|底板|RACKET|RACQUET/i.test(text)) return "racket";
  if (/胶皮|套胶|RUBBER/i.test(text)) return "rubber";
  if (/手套|GLOVE/i.test(text)) return "glove";
  if (/球棒|(^|[^\w])BAT([^\w]|$)/i.test(text)) return "bat";
  if (/护膝|KNEE/i.test(text)) return "guard";
  if (/护腿|GUARD/i.test(text)) return "guard";
  if (/线|STRING/i.test(text)) return "string";
  if (/球|BALL/i.test(text)) return "ball";
  return "other";
}

/** 该商品名是否配得上这个品类：服饰直接否，认不出放行（无从判断） */
export function matchesCategory(category, model) {
  const kind = kindFromModel(model);
  if (kind === "apparel") return false;
  if (kind === "other") return true;
  return KIND_BY_SUFFIX[String(category).split("-").pop()] === kind;
}

/** 种类 → 规范品类后缀（反向映射必须唯一：ball 只回球，不回 shuttle） */
const SUFFIX_BY_KIND = {
  racket: "racket",
  shoes: "shoes",
  string: "string",
  ball: "ball",
  rubber: "rubber",
  glove: "glove",
  bat: "bat",
  guard: "guard",
  accessory: "accessory",
};

/** 按商品名给出「应该属于的品类后缀」（认不出 / 服饰 → null），供数据清洗使用 */
export function suffixForModel(model) {
  const kind = kindFromModel(model);
  if (kind === "other" || kind === "apparel") return null;
  if (kind === "ball") return "ball";
  return SUFFIX_BY_KIND[kind] ?? null;
}

/** 品类的运动前缀（table-tennis-racket → table-tennis） */
export function sportOfCategory(category) {
  return String(category).replace(/-(racket|shoes|string|shuttle|ball|rubber|glove|bat|knee|guard|accessory)$/, "");
}
