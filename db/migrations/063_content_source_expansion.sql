-- 063：内容扩容（组二 · 阶段 11）新增三个方向的来源登记
--
-- 数据库 / 云平台 / 网络工程三个新方向的来源。许可**逐个用 GitHub License API 核验过**
-- （2026-10-10 实跑，spdx_id 见下），不靠记忆填写；verified_at 记核验日期。
--
-- 口径与 062 一致：usage='import' 的来源必须在内容契约允许的许可白名单内
-- （MIT / BSD / CC BY）—— Apache-2.0、GPL、MPL 只能作为 reference（只保留外链，不复制正文）。
--
-- 幂等：INSERT ... ON CONFLICT (key) DO NOTHING；schema.sql 已同步登记。

INSERT INTO content_source (key, name, url, repo, ref, license, usage, obligation, note, verified_at)
VALUES
  -- 数据库（spdx: MIT / PostgreSQL / 公有领域）
  ('cmu-bustub', 'CMU 15-445 BusTub', 'https://github.com/cmu-db/bustub', 'cmu-db/bustub', 'master', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '教学数据库引擎：缓冲池、B-Tree 索引与查询执行的实现参考', now()),
  ('postgresql', 'PostgreSQL', 'https://github.com/postgres/postgres', 'postgres/postgres', 'master', 'PostgreSQL License', 'reference',
   '仅外链引用，不复制正文；保留署名（PostgreSQL License）', '官方实现与回归测试，SQL 语义和查询计划的行为依据', now()),
  ('sqlite', 'SQLite', 'https://github.com/sqlite/sqlite', 'sqlite/sqlite', 'master', 'Public Domain (SQLite Blessing)', 'reference',
   '仅外链引用，不复制正文；保留署名（Public Domain）', '精简 SQL 引擎实现，用于理解 B-Tree 组织与查询计划', now()),

  -- 云平台（spdx: MIT / Apache-2.0）
  ('az104', 'Microsoft AZ-104 Azure Administrator', 'https://github.com/MicrosoftLearning/AZ-104-MicrosoftAzureAdministrator', 'MicrosoftLearning/AZ-104-MicrosoftAzureAdministrator', 'main', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', '微软官方 Azure 管理实验室与运维任务结构', now()),
  ('aks-labs', 'Azure Samples AKS Labs', 'https://github.com/Azure-Samples/aks-labs', 'Azure-Samples/aks-labs', 'main', 'MIT', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（MIT）', 'AKS 集群动手实验：发布、扩缩与排障', now()),
  ('kubernetes', 'Kubernetes', 'https://github.com/kubernetes/kubernetes', 'kubernetes/kubernetes', 'master', 'Apache-2.0', 'reference',
   '仅外链引用，不复制正文；保留署名（Apache-2.0）', '上游实现与 API 约定参考', now()),
  ('k8s-hard-way', 'Kubernetes The Hard Way', 'https://github.com/kelseyhightower/kubernetes-the-hard-way', 'kelseyhightower/kubernetes-the-hard-way', 'master', 'Apache-2.0', 'reference',
   '仅外链引用，不复制正文；保留署名（Apache-2.0）', '从零搭建集群的步骤参考', now()),

  -- 网络工程（spdx: BSD-3-Clause / Apache-2.0 / GPL-2.0）
  ('tailscale', 'Tailscale', 'https://github.com/tailscale/tailscale', 'tailscale/tailscale', 'main', 'BSD-3-Clause', 'import',
   '保留 LICENSE 与署名；仅导入许可范围内内容（BSD-3-Clause）', 'WireGuard 组网与密钥管理的工程实现参考', now()),
  ('napalm', 'NAPALM', 'https://github.com/napalm-automation/napalm', 'napalm-automation/napalm', 'develop', 'Apache-2.0', 'reference',
   '仅外链引用，不复制正文；保留署名（Apache-2.0）', '多厂商设备自动化抽象层参考', now()),
  ('wireshark', 'Wireshark', 'https://github.com/wireshark/wireshark', 'wireshark/wireshark', 'master', 'GPL-2.0', 'reference',
   '仅外链引用，不复制正文；保留署名（GPL-2.0）', '抓包与协议解析参考，不复制正文', now())
ON CONFLICT (key) DO NOTHING;
