# deploy/host —— 宿主机事实（S4-7）

本目录把「只存在于服务器、不进仓库」的运维资产版本化，目的是：服务器坏掉/换机器时，
能按本目录把 crontab、nginx、cosfs 健康检查、磁盘清理原样重建，而不是靠人的记忆。

## 目录

| 文件 | 来源 | 说明 |
|---|---|---|
| ops/crontab.txt | `crontab -l` | 宿主机 crontab 快照（`x-cron-secret` 已脱敏为 <REDACTED>） |
| ops/nginx-learn-workbench.conf | `/etc/nginx/sites-available/learn-workbench` | 站点反代/静态/缓存规则 |
| ops/backup-db.host.sh | `/usr/local/bin/backup-db.sh` | 宿主机版每日备份（docker exec pg_dump + 自检） |
| ops/disk-clean.sh | 项目 scripts/disk-clean.sh（服务器版） | 每周 docker 构建缓存清理 |
| ops/cron.d-lwb-bing | `/etc/cron.d/lwb-bing` | 每日 Bing 壁纸抓取 |
| ops/cron.d-cosfs-data-health | `/etc/cron.d/cosfs-data-health` | 每日 COS 挂载健康检查 |
| ops/cosfs-data.sh | `/usr/local/sbin/cosfs-data.sh` | COSFS 挂载/健康检查脚本 |
| rollback-web.sh | 本仓库新增（S4-4） | 指定镜像 tag/本地 tag 一键回滚 + 健康检查 |

## 恢复步骤（新机器）

1. 安装 Docker / compose、nginx、cosfs；把 COS 桶挂到 `/data`（参考 ops/cosfs-data.sh 与 cron.d-cosfs-data-health）；
2. `crontab ops/crontab.txt`（把 <REDACTED> 替换成真实 `CRON_SECRET`）；
3. `sudo cp ops/nginx-learn-workbench.conf /etc/nginx/sites-available/learn-workbench && sudo ln -s ... sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx`；
4. `sudo cp ops/backup-db.host.sh /usr/local/bin/backup-db.sh && sudo chmod +x /usr/local/bin/backup-db.sh`；
5. `sudo cp ops/disk-clean.sh scripts/disk-clean.sh`；把 ops/cron.d-* 复制到 `/etc/cron.d/`；
6. 按 `deploy/RUNBOOK.md` 恢复数据库（scripts/restore-drill.mjs 验证），再启动 web。

## 注意

- **本目录不含任何密钥**：密码/secret 一律不落盘，恢复时从密码库/部署凭据文件取；
- 这里只是快照，不是「配置即代码」的最终形态：长期方向是 Ansible/Cloud-init（S7 讨论）。
