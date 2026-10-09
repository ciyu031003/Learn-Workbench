/**
 * 招花 · 城市与平台编码（B1：单源化，消除脚本内嵌 CITY_MAP 与 shared SUPPORTED_CITIES 的漂移）
 * 前端城市列表（packages/shared SUPPORTED_CITIES）需与此保持一致（有测试守护）。
 * 城市不在表内时：zhilian 回落默认 489（全国），job51 不带 jobArea（全国）。
 *
 * 编码来源（2026-10-09 核对）：
 *  - zhilian: https://fe-api.zhaopin.com/c/i/city（message 字段中的城市字典）
 *  - job51: https://js.51jobcdn.com/in/js/2023/dd/dd_area_translation.json
 */
export const SUPPORTED_CITIES = [
  "北京", "上海", "广州", "深圳", "杭州", "成都",
  "西安", "重庆", "南京", "武汉", "苏州",
  "天津", "长沙", "郑州", "青岛", "宁波", "合肥",
  "厦门", "福州", "济南", "大连", "沈阳", "哈尔滨",
  "长春", "昆明", "贵阳", "南宁", "海口", "太原",
  "石家庄", "南昌",
  "乌鲁木齐", "克拉玛依", "吐鲁番", "哈密", "昌吉",
  "伊犁", "喀什", "阿克苏", "和田",
];

/** 城市名正则片段：由 SUPPORTED_CITIES 派生，避免在爬虫解析里再维护一份名单 */
export const CITY_NAME_PATTERN = SUPPORTED_CITIES.join("|");

/** 各平台城市编码：zhilian(jl=) / job51(jobArea=) */
export const CITY_MAP = {
  "北京": { zhilian: "530", job51: "010000" },
  "上海": { zhilian: "538", job51: "020000" },
  "广州": { zhilian: "763", job51: "030200" },
  "深圳": { zhilian: "765", job51: "040000" },
  "杭州": { zhilian: "653", job51: "080200" },
  "成都": { zhilian: "801", job51: "090200" },
  "西安": { zhilian: "854", job51: "200200" },
  "重庆": { zhilian: "551", job51: "060000" },
  "南京": { zhilian: "635", job51: "070200" },
  "武汉": { zhilian: "736", job51: "180200" },
  "苏州": { zhilian: "639", job51: "070300" },
  "天津": { zhilian: "531", job51: "050000" },
  "长沙": { zhilian: "749", job51: "190200" },
  "郑州": { zhilian: "719", job51: "170200" },
  "青岛": { zhilian: "703", job51: "120300" },
  "宁波": { zhilian: "654", job51: "080300" },
  "合肥": { zhilian: "664", job51: "150200" },
  "厦门": { zhilian: "682", job51: "110300" },
  "福州": { zhilian: "681", job51: "110200" },
  "济南": { zhilian: "702", job51: "120200" },
  "大连": { zhilian: "600", job51: "230300" },
  "沈阳": { zhilian: "599", job51: "230200" },
  "哈尔滨": { zhilian: "622", job51: "220200" },
  "长春": { zhilian: "613", job51: "240200" },
  "昆明": { zhilian: "831", job51: "250200" },
  "贵阳": { zhilian: "822", job51: "260200" },
  "南宁": { zhilian: "785", job51: "140200" },
  "海口": { zhilian: "799", job51: "100200" },
  "太原": { zhilian: "576", job51: "210200" },
  "石家庄": { zhilian: "565", job51: "160200" },
  "南昌": { zhilian: "691", job51: "130200" },
  "乌鲁木齐": { zhilian: "890", job51: "310200" },
  "克拉玛依": { zhilian: "891", job51: "310300" },
  "吐鲁番": { zhilian: "892", job51: "311400" },
  "哈密": { zhilian: "893", job51: "310700" },
  "昌吉": { zhilian: "894", job51: "311200" },
  "伊犁": { zhilian: "901", job51: "310500" },
  "喀什": { zhilian: "899", job51: "310400" },
  "阿克苏": { zhilian: "897", job51: "310600" },
  "和田": { zhilian: "900", job51: "311600" },
};
