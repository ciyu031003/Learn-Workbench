/**
 * 招花 · 城市与平台编码（B1：单源化，消除脚本内嵌 CITY_MAP 与 shared SUPPORTED_CITIES 的漂移）
 * 前端城市列表（packages/shared SUPPORTED_CITIES）需与此保持一致（有测试守护）。
 * 城市不在表内时：zhilian 回落默认 489（全国），job51 不带 jobArea（全国）。
 */
export const SUPPORTED_CITIES = [
  "北京", "上海", "广州", "深圳", "杭州", "成都",
  "西安", "重庆", "南京", "武汉", "苏州",
  "乌鲁木齐", "克拉玛依", "吐鲁番", "哈密", "昌吉",
  "伊犁", "喀什", "阿克苏", "和田",
];

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
