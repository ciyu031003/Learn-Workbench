#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bing 每日壁纸爬虫（ICT 学习工作台背景图系统）

从 Bing HPImageArchive 接口抓取“今日推荐壁纸”，下载到本地目录，
并可选写入数据库 Learn-Workbench 的 background_images 表。

用法示例：
  python scripts/fetch_bing_wallpaper.py                     # 抓今天，保存到 assets/backgrounds/bing
  python scripts/fetch_bing_wallpaper.py --date 2026-08-12   # 抓指定日期
  python scripts/fetch_bing_wallpaper.py --idx -1            # 抓昨天
  python scripts/fetch_bing_wallpaper.py --res UHD           # 用 UHD 分辨率（默认 1920x1080）
  python scripts/fetch_bing_wallpaper.py --db "host=127.0.0.1 port=5432 dbname=Learn-Workbench user=postgres"
                                                             # 同时写入 background_images 表
依赖：仅 Python 标准库（urllib），无需 pip 安装。
"""

import argparse
import datetime
import hashlib
import json
import os
import struct
import subprocess
import sys
import urllib.error
import urllib.request

BING_API = "https://www.bing.com/HPImageArchive.aspx?format=js&idx={idx}&n=1&mkt={mkt}"
BING_BASE = "https://www.bing.com"
DEFAULT_MKT = "zh-CN"
DEFAULT_OUT = os.path.join("assets", "backgrounds", "bing")
DEFAULT_RES = "1920x1080"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def fetch_json(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def download(url, dest, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp, open(dest, "wb") as f:
        while True:
            chunk = resp.read(65536)
            if not chunk:
                break
            f.write(chunk)


def md5_of(path):
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def jpeg_size(path):
    """从 JPEG 头部解析宽高；失败返回 (None, None)。"""
    try:
        with open(path, "rb") as f:
            data = f.read(2)
            if data != b"\xff\xd8":
                return None, None
            while True:
                marker = f.read(2)
                if len(marker) < 2:
                    return None, None
                if marker[0] != 0xFF:
                    return None, None
                if marker[1] in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    f.read(3)
                    height, width = struct.unpack(">HH", f.read(4))
                    return width, height
                length = struct.unpack(">H", f.read(2))[0]
                f.read(length - 2)
    except Exception:
        return None, None


def run_psql(conn, sql):
    """通过 psql 执行 SQL（无驱动依赖）。"""
    psql = os.environ.get(
        "PSQL_BIN",
        os.path.join("F:", os.sep, "CodeFiles", "Learn-Workbench", ".tools", "pg", "Library", "bin", "psql.exe"),
    )
    if not os.path.exists(psql):
        print("[warn] 未找到 psql，跳过数据库写入：%s" % psql, file=sys.stderr)
        return False
    cmd = [psql, "-w", "-v", "ON_ERROR_STOP=1", "-c", sql]
    if conn:
        cmd.insert(1, conn)
    else:
        cmd += ["-d", "Learn-Workbench", "-h", "127.0.0.1", "-p", "5432", "-U", "postgres"]
    subprocess.run(cmd, check=False)
    return True


def quote_sql(s):
    return "'" + (s or "").replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser(description="Bing 每日壁纸爬虫")
    ap.add_argument("--date", default=None, help="目标日期 YYYY-MM-DD（默认今天）")
    ap.add_argument("--idx", type=int, default=0, help="Bing 图片索引：0=今天，-1=昨天，依次类推")
    ap.add_argument("--mkt", default=DEFAULT_MKT, help="市场地区，如 zh-CN / en-US")
    ap.add_argument("--res", default=DEFAULT_RES, help="分辨率，1920x1080 或 UHD")
    ap.add_argument("--out", default=DEFAULT_OUT, help="图片保存目录（相对仓库根目录）")
    ap.add_argument("--db", default=None, help="PostgreSQL 连接串，提供则写入 background_images 表")
    args = ap.parse_args()

    target = args.date or datetime.date.today().isoformat()
    api_url = BING_API.format(idx=args.idx, mkt=args.mkt)
    print("[info] 请求 Bing 接口：%s" % api_url)

    data = fetch_json(api_url)
    if not data.get("images"):
        print("[error] Bing 接口未返回图片数据", file=sys.stderr)
        sys.exit(1)

    img = data["images"][0]
    urlbase = img.get("urlbase", "")
    url = img.get("url", "")
    clean_url = BING_BASE + urlbase + "_" + args.res + ".jpg" if urlbase else (BING_BASE + url)
    copyright_text = img.get("copyright", "")

    os.makedirs(args.out, exist_ok=True)
    dest = os.path.join(args.out, target + ".jpg")
    print("[info] 下载：%s -> %s" % (clean_url, dest))
    download(clean_url, dest)

    width, height = jpeg_size(dest)
    digest = md5_of(dest)
    size_kb = os.path.getsize(dest) // 1024
    print("[ok] 已保存 %s（%dx%d，%.1f MB，md5=%s）" % (dest, width or 0, height or 0, size_kb / 1024.0, digest[:12]))

    manifest_path = os.path.join(args.out, "index.json")
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    manifest[target] = {
        "file": os.path.basename(dest),
        "remote_url": clean_url,
        "copyright": copyright_text,
        "width": width,
        "height": height,
        "md5": digest,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("[ok] 清单已更新：%s" % manifest_path)

    if args.db is not None:
        sql = (
            "INSERT INTO background_images (source, image_date, file_name, remote_url, local_path, width, height, md5_hash) VALUES "
            "('bing', %s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (source, image_date) DO UPDATE SET "
            "file_name = EXCLUDED.file_name, remote_url = EXCLUDED.remote_url, "
            "local_path = EXCLUDED.local_path, width = EXCLUDED.width, height = EXCLUDED.height, "
            "md5_hash = EXCLUDED.md5_hash, created_at = now()"
            % (
                quote_sql(target),
                quote_sql(os.path.basename(dest)),
                quote_sql(clean_url),
                quote_sql(dest.replace("\\", "/")),
                "NULL" if width is None else str(width),
                "NULL" if height is None else str(height),
                quote_sql(digest),
            )
        )
        run_psql(args.db, sql)

    print("[done] 完成：%s" % target)


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print("[error] 网络请求失败：%s" % e, file=sys.stderr)
        sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print("[error] %s" % e, file=sys.stderr)
        sys.exit(1)
