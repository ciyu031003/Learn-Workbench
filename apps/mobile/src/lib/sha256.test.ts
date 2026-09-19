import { describe, it, expect } from "vitest";
import { Sha256, createSha256Stream, sha256Hex } from "./sha256";

/** 确定性字节序列（与生成期望向量时同一算法） */
function pattern(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 37 + 11) % 256;
  return out;
}

// 期望值由 node:crypto 的 createHash("sha256") 生成
const VECTORS: [number, string][] = [
  [0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  [1, "e7cf46a078fed4fafd0b5e3aff144802b853f8ae459a4f0c14add3314b7cc3a6"],
  [55, "2900465fcb533e05a158fd2b3be0e5e3b03740d83060aa3580e0d98a96bf2384"],
  [56, "31454ff48ef36af2f08fd511bdc37d9d5855ac23e992e5ff5445cb6b7674a674"],
  [63, "5f6401b96532c36de4e65beec0409b69b1d181864c8009b7a04f43e5d56350d1"],
  [64, "94eb5de4943613fd048dc93393ab06877405faa39c11f53e9386083339833e7e"],
  [65, "fc518669b6eb4b4dd91827ecacef86689c725bd5bab888fd3b26dbb196eec954"],
  [127, "0fe729ff19257bd6fec853acc2ea355f6b34b58e6c0f684c3e188fcdfcd9baae"],
  [128, "0aedd4856f8eba0963627336ad5144a9a7dbe12498e6066f0165fc97d8ddee4c"],
  [1000, "57799de80e3dd6e2ac4d40c41a150d1662f7f87d0d994776a2fdc37c39b0ea4e"],
  [65536, "6fc179cfd193754e6109ad043f56d146c7e7d7c3623ffceae318266286f58388"],
];

describe("sha256（纯 TS 增量实现）", () => {
  it("空串与 abc 的标准向量", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("长度 0/1/55/56/63/64/65/127/128/1000/65536 全部命中已知向量（覆盖 padding 边界）", () => {
    for (const [n, hex] of VECTORS) {
      expect(sha256Hex(pattern(n))).toBe(hex);
    }
  });

  it("分片 update 与一次 update 结果一致（模拟文件分片读）", () => {
    const data = pattern(3000);
    const expected = sha256Hex(data);
    for (const size of [1, 7, 63, 64, 65, 512, 1000]) {
      const h = new Sha256();
      for (let i = 0; i < data.length; i += size) h.update(data.subarray(i, Math.min(i + size, data.length)));
      expect(h.hex()).toBe(expected);
    }
  });

  it("createSha256Stream 与一次性哈希等价", () => {
    const stream = createSha256Stream();
    const data = pattern(1500);
    stream.push(data.subarray(0, 700));
    stream.push(data.subarray(700));
    expect(stream.hex()).toBe(sha256Hex(data));
  });

  it("digest 可重复调用；finalize 之后 update 抛错", () => {
    const h = new Sha256().update(pattern(10));
    expect(h.hex()).toBe(h.hex());
    expect(() => h.update(pattern(1))).toThrow("已 finalize");
  });
});
