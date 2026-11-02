import { describe, expect, it } from "vitest";
import {
  CITY_PROVINCE,
  HOT_CITIES,
  OTHER_PROVINCE,
  PROVINCE_CITIES,
  SUPPORTED_CITIES,
  cityProvinceLabel,
  getCitiesOfProvince,
  getProvinceOfCity,
  groupCitiesByProvince,
  searchCities,
} from "./labels";

const ALL_GROUPED_CITIES = PROVINCE_CITIES.flatMap((group) => group.cities);

describe("PROVINCE_CITIES（省份 → 城市分组）", () => {
  it("分组覆盖 SUPPORTED_CITIES 全部城市，且不多不少", () => {
    expect([...ALL_GROUPED_CITIES].sort()).toEqual([...SUPPORTED_CITIES].sort());
  });

  it("每个城市只属于一个省，没有重复项", () => {
    expect(new Set(ALL_GROUPED_CITIES).size).toBe(ALL_GROUPED_CITIES.length);
    expect(new Set(PROVINCE_CITIES.map((group) => group.province)).size).toBe(PROVINCE_CITIES.length);
  });

  it("每个分组都非空", () => {
    for (const group of PROVINCE_CITIES) {
      expect(group.cities.length, group.province).toBeGreaterThan(0);
      for (const city of group.cities) expect(city.trim()).toBe(city);
    }
  });

  it("直辖市按「北京市」这类完整名单独成组，一组只有一个城市", () => {
    for (const province of ["北京市", "上海市", "天津市", "重庆市"]) {
      const group = PROVINCE_CITIES.find((item) => item.province === province);
      expect(group, province).toBeTruthy();
      expect(group!.cities).toHaveLength(1);
    }
    expect(getProvinceOfCity("北京")).toBe("北京市");
    expect(getProvinceOfCity("重庆")).toBe("重庆市");
  });

  it("多城市省份的城市顺序保持稳定（广州在深圳前 / 乌鲁木齐在新疆首位）", () => {
    expect(getCitiesOfProvince("广东")).toEqual(["广州", "深圳"]);
    expect(getCitiesOfProvince("新疆")[0]).toBe("乌鲁木齐");
  });
});

describe("CITY_PROVINCE 反向索引", () => {
  it("由分组派生，城市数 = 分组城市数", () => {
    expect(Object.keys(CITY_PROVINCE)).toHaveLength(ALL_GROUPED_CITIES.length);
  });

  it("热门城市都能查到省份（热门组必须是受支持城市）", () => {
    expect(HOT_CITIES.length).toBeGreaterThan(0);
    for (const city of HOT_CITIES) {
      expect(SUPPORTED_CITIES.includes(city), city).toBe(true);
      expect(getProvinceOfCity(city), city).toBeTruthy();
    }
  });
});

describe("未知城市兜底", () => {
  it("getProvinceOfCity 对未知/空值返回 null", () => {
    expect(getProvinceOfCity("火星")).toBeNull();
    expect(getProvinceOfCity("")).toBeNull();
    expect(getProvinceOfCity("   ")).toBeNull();
  });

  it("getCitiesOfProvince 对未知省份返回空数组", () => {
    expect(getCitiesOfProvince("不存在省")).toEqual([]);
    expect(getCitiesOfProvince("")).toEqual([]);
  });

  it("cityProvinceLabel 已知返回「省 · 市」，未知原样返回", () => {
    expect(cityProvinceLabel("深圳")).toBe("广东 · 深圳");
    expect(cityProvinceLabel("北京")).toBe("北京市 · 北京");
    expect(cityProvinceLabel("火星")).toBe("火星");
    expect(cityProvinceLabel("")).toBe("");
  });

  it("groupCitiesByProvince 把未知城市收进「其他」组并放在末尾", () => {
    const groups = groupCitiesByProvince(["深圳", "火星市", "北京", "月球"]);
    expect(groups.map((group) => group.province)).toEqual(["北京市", "广东", OTHER_PROVINCE]);
    expect(groups[groups.length - 1].cities).toEqual(["火星市", "月球"]);
    expect(groups.find((group) => group.province === "广东")!.cities).toEqual(["深圳"]);
  });

  it("groupCitiesByProvince 去重、忽略空值，且不返回空组", () => {
    const groups = groupCitiesByProvince(["深圳", "深圳", "  ", "杭州"]);
    expect(groups.map((group) => group.province)).toEqual(["广东", "浙江"]);
    expect(groups.flatMap((group) => group.cities)).toEqual(["深圳", "杭州"]);
  });
});

describe("groupCitiesByProvince（结果页动态城市）", () => {
  it("不传参时等价于按 SUPPORTED_CITIES 全量分组，顺序与 PROVINCE_CITIES 一致", () => {
    const groups = groupCitiesByProvince();
    expect(groups.map((group) => group.province)).toEqual(PROVINCE_CITIES.map((group) => group.province));
    expect(groups.flatMap((group) => group.cities)).toEqual(ALL_GROUPED_CITIES);
  });
});

describe("searchCities（搜索匹配）", () => {
  it("空查询返回全部城市副本", () => {
    const result = searchCities("  ");
    expect(result).toEqual([...SUPPORTED_CITIES]);
    expect(result).not.toBe(SUPPORTED_CITIES);
  });

  it("按城市名子串匹配", () => {
    expect(searchCities("深")).toEqual(["深圳"]);
    expect(searchCities("乌鲁木齐")).toEqual(["乌鲁木齐"]);
  });

  it("按省份名匹配该省全部城市", () => {
    expect(searchCities("广东")).toEqual(["广州", "深圳"]);
    expect(searchCities("新疆")).toEqual(getCitiesOfProvince("新疆"));
  });

  it("无匹配返回空数组；结果保持入参顺序", () => {
    expect(searchCities("火星")).toEqual([]);
    expect(searchCities("州", ["杭州", "广州", "深圳"])).toEqual(["杭州", "广州"]);
  });

  it("未知城市也能按城市名命中（兜底不影响搜索）", () => {
    expect(searchCities("火星", ["深圳", "火星市"])).toEqual(["火星市"]);
  });
});
