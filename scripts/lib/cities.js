/**
 * 招花 · 城市与平台编码（B1：单源化，消除脚本内嵌 CITY_MAP 与 shared SUPPORTED_CITIES 的漂移）
 * 前端城市列表（packages/shared SUPPORTED_CITIES）需与此保持一致（有测试守护）。
 * 城市不在表内时：zhilian 回落默认 489（全国），job51 不带 jobArea（全国）。
 */
export const SUPPORTED_CITIES = [
  "北京", "上海", "广州", "深圳", "杭州", "成都",
  "西安", "乌鲁木齐", "南京", "武汉", "苏州",
];

/** 各平台城市编码：zhilian(jl=) / job51(jobArea=) */
export const CITY_MAP = {
  "北京": { zhilian: "530", job51: "010000" },
  "上海": { zhilian: "538", job51: "020000" },
  "广州": { zhilian: "653", job51: "030200" },
  "深圳": { zhilian: "765", job51: "040000" },
  "杭州": { zhilian: "619", job51: "080200" },
  "成都": { zhilian: "801", job51: "090200" },
  "西安": { zhilian: "715", job51: "200200" },
  "乌鲁木齐": { zhilian: "749", job51: "330100" },
  "南京": { zhilian: "631", job51: "070200" },
  "武汉": { zhilian: "679", job51: "180200" },
  "苏州": { zhilian: "653", job51: "050200" },
};