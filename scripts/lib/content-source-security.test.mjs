import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assertSafeGitRef,
  assertSafeRelativePath,
  assertSafeRepoUrl,
} from "./content-source.mjs";

test("assertSafeRepoUrl：放行登记的 GitHub https 来源", () => {
  for (const url of [
    "https://github.com/Snailclimb/JavaGuide",
    "https://github.com/TheAlgorithms/Shell",
    "https://raw.githubusercontent.com/foo/bar/main/README.md",
  ]) {
    assert.equal(assertSafeRepoUrl(url), url);
  }
});

test("assertSafeRepoUrl：拒绝 file/ext/ssh/内网/内嵌凭据", () => {
  for (const url of [
    "file:///etc/passwd",
    "ext::sh -c 'curl evil'",
    "ssh://git@github.com/foo/bar",
    "http://github.com/foo/bar",
    "https://127.0.0.1/foo/bar",
    "https://169.254.169.254/latest/meta-data",
    "https://user:pass@github.com/foo/bar",
    "https://evil.example.com/foo/bar",
    "not a url",
  ]) {
    assert.throws(() => assertSafeRepoUrl(url), /来源/, `应拒绝：${url}`);
  }
});

test("assertSafeGitRef：放行正常 ref（分支 / tag / sha）", () => {
  for (const ref of ["main", "master", "v1.2.3", "release/2026-10", "a".repeat(40)]) {
    assert.equal(assertSafeGitRef(ref), ref);
  }
});

test("assertSafeGitRef：拒绝选项注入与畸形 ref", () => {
  for (const ref of [
    "--upload-pack=/tmp/evil.sh",
    "-c",
    "feature/../..",
    "a//b",
    "refs/heads/main/",
    "branch.lock",
    "with space",
    "semi;colon",
    "",
  ]) {
    assert.throws(() => assertSafeGitRef(ref), /git ref/, `应拒绝：${ref}`);
  }
});

test("assertSafeRelativePath：放行仓库内相对路径", () => {
  for (const rel of ["README.md", "src/a/b.md", "./docs/x.md"]) {
    assert.equal(assertSafeRelativePath(rel), rel);
  }
});

test("assertSafeRelativePath：拒绝穿越 / 绝对路径 / 反斜杠 / NUL", () => {
  for (const rel of ["../etc/passwd", "/etc/passwd", "C:\\Windows\\win.ini", "a/../../b", "a\\b.md", "x\0.md", ""]) {
    assert.throws(() => assertSafeRelativePath(rel), /相对路径/, `应拒绝：${JSON.stringify(rel)}`);
  }
});
