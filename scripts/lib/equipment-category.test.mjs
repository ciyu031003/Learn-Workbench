import { test } from "node:test";
import assert from "node:assert/strict";
import { kindFromModel, matchesCategory, sportOfCategory, suffixForModel } from "./equipment-category.mjs";

test("鞋优先于球：篮球鞋不是篮球", () => {
  assert.equal(kindFromModel("利刃7 北斗七星男子篮球专业比赛鞋ABAW043-14"), "shoes");
  assert.equal(matchesCategory("basketball-ball", "利刃7 北斗七星男子篮球专业比赛鞋ABAW043-14"), false);
  assert.equal(matchesCategory("basketball-shoes", "利刃7 北斗七星男子篮球专业比赛鞋ABAW043-14"), true);
});

test("拍优先于球：羽毛球拍不是羽毛球，网球拍不是网球", () => {
  assert.equal(kindFromModel("战戟 5000(4U)羽毛球拍（单拍无线）AYPT373-4"), "racket");
  assert.equal(matchesCategory("badminton-shuttle", "战戟 5000(4U)羽毛球拍AYPT373-4"), false);
  assert.equal(matchesCategory("badminton-racket", "战戟 5000(4U)羽毛球拍AYPT373-4"), true);
  assert.equal(matchesCategory("tennis-ball", "JETIC100CLSJR深墨绿网球拍AWPV013-1"), false);
  assert.equal(matchesCategory("tennis-racket", "JETIC100CLSJR深墨绿网球拍AWPV013-1"), true);
});

test("服装与周边不收", () => {
  assert.equal(kindFromModel("【“王”者雄狮】李宁乒乓球系列夏季宽松短袖文化衫AHSW941-1"), "apparel");
  assert.equal(kindFromModel("乒乓球拍袋"), "apparel");
  assert.equal(kindFromModel("双鱼乒乓球台"), "apparel");
  assert.equal(matchesCategory("table-tennis-ball", "李宁乒乓球系列短袖文化衫"), false);
});

test("正常型号仍然认得出", () => {
  assert.equal(kindFromModel("双鱼V40+三星乒乓球"), "ball");
  assert.equal(matchesCategory("table-tennis-ball", "双鱼V40+三星乒乓球"), true);
  assert.equal(matchesCategory("badminton-shuttle", "AEROSENSA 50"), true);
  assert.equal(kindFromModel("1615诡胶王"), "other", "没有「胶皮/套胶」字样 → 认不出，不做判断");
  assert.equal(matchesCategory("table-tennis-rubber", "1615诡胶王"), true, "认不出就放行");
});

test("运动前缀与反向后缀唯一", () => {
  assert.equal(sportOfCategory("table-tennis-racket"), "table-tennis");
  assert.equal(sportOfCategory("basketball-ball"), "basketball");
  assert.equal(sportOfCategory("soccer-guard"), "soccer");
  assert.equal(suffixForModel("篮球"), "ball");
  assert.equal(suffixForModel("羽毛球"), "ball");
  assert.equal(suffixForModel("羽毛球拍"), "racket");
  assert.equal(suffixForModel("短袖文化衫"), null);
});

test("「Racket grip」是手胶不是球拍", () => {
  assert.equal(kindFromModel("Racket towel grip Kawasaki B10"), "accessory");
  assert.equal(matchesCategory("badminton-accessory", "Racket towel grip Kawasaki B10"), true);
  assert.equal(matchesCategory("badminton-racket", "Racket grip Kawasaki B10"), false);
  assert.equal(kindFromModel("Racket bag Kawasaki"), "apparel");
});

test("护具/手套/球棒各自归位", () => {
  assert.equal(matchesCategory("soccer-guard", "护腿板"), true);
  assert.equal(matchesCategory("volleyball-knee", "护膝"), true);
  assert.equal(matchesCategory("baseball-glove", "棒球手套"), true);
  assert.equal(matchesCategory("baseball-bat", "垒球棒"), true);
});
