#!/usr/bin/env python3
"""给 learn-workbench 的 nginx 站点补上「OTA 清单/下载页必须实时」的缓存规则（幂等）。

背景（2026-09-16 线上事故）：
  站点里有 `location ~* \\.(...|json)$ { expires 30d; add_header Cache-Control "public, max-age=2592000"; }`
  → `/mobile-update.json` 被浏览器**和 RN 的 OkHttp 磁盘缓存**缓存 30 天；
  App 内 `fetch(..., {cache:"no-store"})` 在 RN 上不生效（RN 走 OkHttp，不认 fetch 的 cache 选项）
  → 已安装用户永远读到「发布当天」的清单，检查更新始终显示已是最新，无法升级。

修法：用 nginx 的精确匹配 location（优先级高于正则）覆盖这两个 URL。
"""
import shutil
import sys

PATH = "/etc/nginx/sites-available/learn-workbench"
BACKUP = "/etc/nginx/sites-available/learn-workbench.bak-ota-cache-fix"
MARK = "location = /mobile-update.json"

BLOCK = """
    # ---- OTA 更新清单：必须实时（2026-09-16 事故修复）----------------------
    # 正则 location 里的 `expires 30d` 会让 RN(OkHttp) 把清单缓存 30 天，
    # App 端 fetch 的 cache:"no-store" 在 RN 上无效 → 用户永远升级不了。
    # 精确匹配 location 优先级高于正则，这里显式禁缓存。
    location = /mobile-update.json {
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
        add_header Pragma "no-cache" always;
        expires -1;
        try_files $uri =404;
    }

    # ---- 下载页：版本号要能立刻反映最新包 ---------------------------------
    location = /download.html {
        add_header Cache-Control "no-cache, must-revalidate" always;
        expires -1;
        try_files $uri =404;
    }
"""


def main() -> int:
    with open(PATH, encoding="utf-8") as f:
        src = f.read()

    if MARK in src:
        print("已修补过，无需改动")
        return 0

    anchor = "    location ~* \\.bak {"
    if anchor not in src:
        print("找不到锚点 location ~* \\.bak {，请人工检查", file=sys.stderr)
        return 1

    shutil.copy(PATH, BACKUP)
    patched = src.replace(anchor, BLOCK.rstrip("\n") + "\n\n" + anchor, 1)
    with open(PATH, "w", encoding="utf-8") as f:
        f.write(patched)
    print(f"已修补 {PATH}（备份：{BACKUP}）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
