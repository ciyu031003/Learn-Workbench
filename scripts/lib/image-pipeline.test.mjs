import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_QUALITY,
  DEFAULT_WIDTHS,
  buildManifest,
  formatBytes,
  manifestKey,
  parseCliArgs,
  planFile,
  summarize,
  variantFileName,
  widthsForIntrinsic,
} from "./image-pipeline.mjs";

test("variantFileName 保留原 stem（含 hash）并换 webp 后缀", () => {
  assert.equal(variantFileName("2016-01.png", 640), "2016-01@640w.webp");
  assert.equal(
    variantFileName("2009-03-1-redraw.06248cc2ed2a.png", 1280),
    "2009-03-1-redraw.06248cc2ed2a@1280w.webp"
  );
  assert.throws(() => variantFileName("", 640));
  assert.throws(() => variantFileName("a.png", 0));
});

test("manifestKey 与数据库里的图片 URL 一致", () => {
  assert.equal(manifestKey("2016-01.png"), "/content-images/2016-01.png");
});

test("widthsForIntrinsic 不放大、去重、升序", () => {
  assert.deepEqual(widthsForIntrinsic(1600), [640, 1280]);
  assert.deepEqual(widthsForIntrinsic(1280), [640]);
  assert.deepEqual(widthsForIntrinsic(700), [640]);
  assert.deepEqual(widthsForIntrinsic(500), [500]);
  assert.deepEqual(widthsForIntrinsic(1366, [1280, 640, 640]), [640, 1280]);
  assert.throws(() => widthsForIntrinsic(0));
});

test("planFile 组合出单图计划", () => {
  assert.deepEqual(planFile("x.png", 1500), { fileName: "x.png", intrinsicWidth: 1500, widths: [640, 1280] });
});

test("buildManifest 按 URL 排序、紧凑元组且变体宽度去重升序", () => {
  const manifest = buildManifest([
    {
      key: "/content-images/b.png",
      intrinsicWidth: 1400,
      intrinsicHeight: 900,
      variants: [
        { w: 1280, src: "/content-images/b@1280w.webp" },
        { w: 640, src: "/content-images/b@640w.webp" },
      ],
    },
    { key: "/content-images/a.png", intrinsicWidth: 1200, intrinsicHeight: 800, variants: [{ w: 640, src: "/content-images/a@640w.webp" }] },
  ]);
  assert.deepEqual(Object.keys(manifest), ["/content-images/a.png", "/content-images/b.png"]);
  assert.deepEqual(manifest["/content-images/a.png"], [1200, 800, [640]]);
  assert.deepEqual(manifest["/content-images/b.png"], [1400, 900, [640, 1280]]);
});

test("summarize 计算体积比与各档总量", () => {
  const s = summarize({
    files: 2,
    pngBytes: 1000,
    variants: [
      { width: 640, bytes: 100 },
      { width: 640, bytes: 150 },
      { width: 1280, bytes: 400 },
      { width: 1280, bytes: 250 },
    ],
  });
  assert.equal(s.variants, 4);
  assert.equal(s.variantBytes, 900);
  assert.equal(s.perWidthBytes[640], 250);
  assert.equal(s.perWidthBytes[1280], 650);
  assert.equal(s.largestWidth, 1280);
  assert.equal(s.largestRatio, 0.65);
  assert.equal(s.ratio, 0.9);
  assert.equal(s.pngHuman, "1000 B");
});

test("formatBytes", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1023), "1023 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(2 * 1024 * 1024), "2.00 MB");
});

test("parseCliArgs 默认值与开关", () => {
  const defaults = parseCliArgs([]);
  assert.equal(defaults.dryRun, false);
  assert.equal(defaults.quality, DEFAULT_QUALITY);
  assert.deepEqual(defaults.widths, DEFAULT_WIDTHS);
  assert.equal(parseCliArgs(["--dry-run"]).dryRun, true);
  assert.equal(parseCliArgs(["--only-missing"]).onlyMissing, true);
  assert.equal(parseCliArgs(["--force"]).force, true);
});

test("parseCliArgs 自定义质量与宽度并归一化", () => {
  const opts = parseCliArgs(["--quality=90", "--widths=1280,640,640"]);
  assert.equal(opts.quality, 90);
  assert.deepEqual(opts.widths, [640, 1280]);
});

test("parseCliArgs 环境变量兜底", () => {
  assert.equal(parseCliArgs([], { CONTENT_IMAGE_QUALITY: "78" }).quality, 78);
  assert.equal(parseCliArgs(["--quality=88"], { CONTENT_IMAGE_QUALITY: "78" }).quality, 88);
});

test("parseCliArgs 拒绝非法输入与破坏性操作", () => {
  assert.throws(() => parseCliArgs(["--quality=0"]));
  assert.throws(() => parseCliArgs(["--quality=101"]));
  assert.throws(() => parseCliArgs(["--widths=abc"]));
  assert.throws(() => parseCliArgs(["--unknown"]));
  assert.throws(() => parseCliArgs(["--prune-originals"]), /破坏性/);
  assert.doesNotThrow(() => parseCliArgs(["--prune-originals", "--force"]));
});
