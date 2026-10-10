# 数据库工程工件（组三 · H1）

| 文件 | 内容 | 再生命令 |
|---|---|---|
| `index-inventory.md` | 每张表的索引 / 约束 / 审计列覆盖率清单（事实源是 DDL 文本） | `pnpm db:inventory` |

## 迁移纪律（正向）

1. 迁移只**追加**：新文件编号 `NNN_*.sql`，不改历史文件。
2. 必须同步登记进 `db/schema.sql`（全新库靠它，既有库靠迁移，两条路径要收敛）。
3. 幂等优先：`ADD COLUMN IF NOT EXISTS`、`CREATE TABLE/INDEX IF NOT EXISTS`、
   `ADD CONSTRAINT` 用 `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` 包起来。
4. 提交前跑：
   ```bash
   node scripts/verify-migrations.mjs     # 编号连续 + 新表已登记 schema.sql
   node scripts/check-schema-fresh.mjs    # 空库依次应用 schema.sql + 全部迁移，零失败
   ```

## 迁移纪律（回滚）

回滚不是注释，是**可执行契约**：配套写 `db/migrations/down/NNN_*.down.sql`，只 DROP 本迁移新增的对象。

`down/` 放在子目录里，因此 `verify-migrations` / `check-schema-fresh` 的 `*.sql` 扫描不会把它当正向迁移。

提交前跑：

```bash
pnpm db:drill   # 一次性演练库上「正向 → 回滚 → 再正向」，逐条断言对象消失又复原
```

断言是**从 down 文件里解析**出来的（`DROP INDEX` / `DROP CONSTRAINT` / `DROP COLUMN`），
所以 down 文件漏写哪个对象，演练就不会覆盖它 —— 漏写比写错更容易被发现：

```text
[migration-drill] ✔ 064_h1_data_hardening.down.sql：回滚 29 个对象 → 再正向 → 全部复原
```

## 环境变量

`PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD`（默认 `127.0.0.1:5432 postgres` 无密码）；
演练库名可改：`node scripts/migration-drill.mjs --db=lwb_migration_drill --keep`（`--keep` 保留库以便排查）。
