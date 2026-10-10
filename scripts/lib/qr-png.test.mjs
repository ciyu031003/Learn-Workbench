import assert from "node:assert/strict";
import test from "node:test";
import { decodeQrPng, renderQrPng } from "./qr-png.mjs";

/**
 * 发布二维码必须"生成得出来 + 解码能对上"——只检查 PNG 更新过是不够的
 * （看板里记过这个坑：静态二维码要实际反解码核验）。
 */

test("renderQrPng → decodeQrPng 回环一致（下载地址）", () => {
  const url = "https://learn.yuanabd.cn/download/learn-workbench-v1.42.0.apk";
  const png = renderQrPng(url);
  assert.equal(decodeQrPng(png), url);
});

test("渲染尺寸为正方形且等于 sizePx", () => {
  const png = renderQrPng("https://learn.yuanabd.cn/download/a.apk", { sizePx: 320 });
  // PNG 头：IHDR 宽高在 16/20 字节处（大端）
  assert.equal(png.readUInt32BE(16), 320);
  assert.equal(png.readUInt32BE(20), 320);
});

test("空内容直接失败（避免生成一张扫不出东西的图）", () => {
  assert.throws(() => renderQrPng("   "), /内容为空/);
});

test("不同版本号生成不同二维码（防止复用上一版导致扫到旧包）", () => {
  const a = renderQrPng("https://learn.yuanabd.cn/download/learn-workbench-v1.41.0.apk");
  const b = renderQrPng("https://learn.yuanabd.cn/download/learn-workbench-v1.42.0.apk");
  assert.notEqual(a.toString("base64"), b.toString("base64"));
  assert.match(decodeQrPng(b) ?? "", /v1\.42\.0\.apk$/);
});
