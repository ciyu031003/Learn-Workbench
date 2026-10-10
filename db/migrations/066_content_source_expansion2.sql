-- 066：内容来源扩容第二批（组二 · 内容充实；配合新增三门课程）
--
-- 新增算法 / 后端工程 / 应用安全三门课程，为此登记 12 个来源。
-- 许可逐个用 GitHub License API 核验（`/repos/<owner>/<repo>/license`），默认分支用 `/repos/<owner>/<repo>` 的
-- `default_branch` 读取，不靠记忆：
--   MIT（可 import）：TheAlgorithms/Go、fastapi、gin、pytest、vitest、
--                    javascript-testing-best-practices、juice-shop、project-based-learning
--   其余只做 reference（仅外链引用，不复制正文）：
--     OWASP CheatSheetSeries / wstg（CC BY-SA 4.0，含 share-alike 义务）、
--     Spring Boot（Apache-2.0）、Coding Interview University（CC BY-SA 4.0）
--
-- 幂等：ON CONFLICT (key) DO NOTHING；db/schema.sql 已同步登记。

INSERT INTO content_source (key, name, url, repo, ref, license, usage, obligation, note, verified_at)
VALUES
  ('algorithms-go', 'TheAlgorithms/Go', 'https://github.com/TheAlgorithms/Go', 'TheAlgorithms/Go', 'master', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '算法与数据结构的 Go 实现，用于核对边界与复杂度', now()),
  ('fastapi', 'FastAPI', 'https://github.com/fastapi/fastapi', 'fastapi/fastapi', 'master', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '依赖注入、请求校验与 OpenAPI 契约生成的工程范式', now()),
  ('gin', 'Gin', 'https://github.com/gin-gonic/gin', 'gin-gonic/gin', 'master', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', 'Go Web 框架的中间件链与上下文传递实现参考', now()),
  ('pytest', 'pytest', 'https://github.com/pytest-dev/pytest', 'pytest-dev/pytest', 'main', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', 'fixture、参数化与断言重写的测试工程参考', now()),
  ('vitest', 'Vitest', 'https://github.com/vitest-dev/vitest', 'vitest-dev/vitest', 'main', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', 'JS/TS 侧测试运行器与覆盖率的实现参考', now()),
  ('js-testing-best-practices', 'JavaScript Testing Best Practices', 'https://github.com/goldbergyoni/javascript-testing-best-practices', 'goldbergyoni/javascript-testing-best-practices', 'master', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '测试分层、可读性与维护性的实践清单', now()),
  ('juice-shop', 'OWASP Juice Shop', 'https://github.com/juice-shop/juice-shop', 'juice-shop/juice-shop', 'master', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '故意含漏洞的靶场，用于说明漏洞成因与修复验证', now()),
  ('project-based-learning', 'Project Based Learning', 'https://github.com/practical-tutorials/project-based-learning', 'practical-tutorials/project-based-learning', 'master', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '按项目组织的学习路径索引，用于实践选题', now()),
  ('owasp-cheatsheets', 'OWASP Cheat Sheet Series', 'https://github.com/OWASP/CheatSheetSeries', 'OWASP/CheatSheetSeries', 'master', 'CC BY-SA 4.0', 'reference',
   '仅外链引用，不复制正文；保留署名（CC BY-SA 4.0，含相同方式共享义务）', '防护措施速查表，作为写原理时的权威参照', now()),
  ('owasp-wstg', 'OWASP Web Security Testing Guide', 'https://github.com/OWASP/wstg', 'OWASP/wstg', 'master', 'CC BY-SA 4.0', 'reference',
   '仅外链引用，不复制正文；保留署名（CC BY-SA 4.0，含相同方式共享义务）', '测试与验证方法参考，不复制正文', now()),
  ('spring-boot', 'Spring Boot', 'https://github.com/spring-projects/spring-boot', 'spring-projects/spring-boot', 'main', 'Apache-2.0', 'reference',
   '仅外链引用，不复制正文；保留署名（Apache-2.0）', '自动配置与约定优于配置的实现参考', now()),
  ('coding-interview-university', 'Coding Interview University', 'https://github.com/jwasham/coding-interview-university', 'jwasham/coding-interview-university', 'main', 'CC BY-SA 4.0', 'reference',
   '仅外链引用，不复制正文；保留署名（CC BY-SA 4.0）', '计算机基础知识清单，用于校对知识覆盖面', now())
ON CONFLICT (key) DO NOTHING;
