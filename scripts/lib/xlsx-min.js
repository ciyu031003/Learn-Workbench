// ============================================================================
// xlsx-min —— 极简 .xlsx 读取器（无第三方依赖）
// 解析 ZIP 中央目录 + 共享字符串 + 第一个工作表，返回 string[][] 行数据
// 仅用于招花「公告→岗位表结构化」；不支持的格式（.xls 二进制）返回 null
// ============================================================================
import { inflateRawSync } from "node:zlib";

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

function readU16(buf, off) {
  return buf.readUInt16LE(off);
}
function readU32(buf, off) {
  return buf.readUInt32LE(off);
}

function decodeXmlEntities(s) {
  return String(s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 读取 ZIP 文件中的指定条目（返回解压后的 Buffer） */
function readZipEntry(buf, name) {
  // 找 EOCD
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const cdCount = readU16(buf, eocd + 10);
  const cdOffset = readU32(buf, eocd + 16);
  let off = cdOffset;
  for (let k = 0; k < cdCount; k++) {
    if (buf.readUInt32LE(off) !== CEN_SIG) break;
    const method = readU16(buf, off + 10);
    const compSize = readU32(buf, off + 20);
    const nameLen = readU16(buf, off + 28);
    const extraLen = readU16(buf, off + 30);
    const commentLen = readU16(buf, off + 32);
    const localOff = readU32(buf, off + 42);
    const entryName = buf.toString("utf8", off + 46, off + 46 + nameLen);
    if (entryName === name) {
      if (buf.readUInt32LE(localOff) !== LOC_SIG) return null;
      const lNameLen = readU16(buf, localOff + 26);
      const lExtraLen = readU16(buf, localOff + 28);
      const dataStart = localOff + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(dataStart, dataStart + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) {
        try {
          return inflateRawSync(data);
        } catch {
          return null;
        }
      }
      return null;
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function collectSharedStrings(xml) {
  const out = [];
  const siRe = /<si[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRe.exec(xml)) !== null) {
    const inner = m[1];
    // 处理 <r><t>..</t></r> 与 <t>..</t>
    const tRe = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let s = "";
    let tm;
    while ((tm = tRe.exec(inner)) !== null) s += tm[1];
    out.push(decodeXmlEntities(s));
  }
  return out;
}

function parseSheet(xml, shared) {
  const rows = [];
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRe.exec(xml)) !== null) {
    const cells = [];
    const cRe = /<c[^>]*r="([A-Z]+)\d+"[^>]*t="([^"]*)"[^>]*>([\s\S]*?)<\/c>|<c[^>]*r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/c>/g;
    let cm;
    while ((cm = cRe.exec(rm[2])) !== null) {
      const t = cm[2] || "";
      const inner = cm[3] || cm[5] || "";
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || "";
      let val = "";
      if (t === "s") {
        val = shared[Number(v)] ?? "";
      } else if (t === "inlineStr") {
        const is = (inner.match(/<is[^>]*>([\s\S]*?)<\/is>/) || [])[1] || "";
        const tm = is.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        val = tm ? decodeXmlEntities(tm[1]) : "";
      } else if (t === "str") {
        val = decodeXmlEntities(v);
      } else {
        val = decodeXmlEntities(v);
      }
      cells.push(val);
    }
    rows.push(cells);
  }
  return rows;
}

/** 读取 xlsx buffer → string[][]（第一个工作表），失败返回 null */
export function readXlsx(buffer) {
  try {
    const sharedXml = readZipEntry(buffer, "xl/sharedStrings.xml");
    const shared = sharedXml ? collectSharedStrings(sharedXml.toString("utf8")) : [];
    // 尝试 sheet1 / sheet 列表
    let sheetXml = readZipEntry(buffer, "xl/worksheets/sheet1.xml");
    if (!sheetXml) {
      const wbXml = readZipEntry(buffer, "xl/workbook.xml");
      if (wbXml) {
        const m = wbXml.toString("utf8").match(/<sheet[^>]*name="([^"]*)"[^>]*r:id="(rId\d+)"/);
        if (m) {
          const rels = readZipEntry(buffer, "xl/_rels/workbook.xml.rels");
          if (rels) {
            const relRe = new RegExp('Id="' + m[2] + '"[^>]*Target="([^"]+)"');
            const rm = rels.toString("utf8").match(relRe);
            if (rm) {
              let target = rm[1].replace(/^\//, "");
              if (!target.startsWith("xl/")) target = "xl/" + target;
              sheetXml = readZipEntry(buffer, target);
            }
          }
        }
      }
    }
    if (!sheetXml) return null;
    return parseSheet(sheetXml.toString("utf8"), shared);
  } catch {
    return null;
  }
}
