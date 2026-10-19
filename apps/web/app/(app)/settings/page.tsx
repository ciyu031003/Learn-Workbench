"use client";

import { Badge } from "@/components/ui/badge";
import { QuickLinks } from "@/components/settings/quick-links";
import { AppearanceSection, AboutCard } from "./_components/appearance-section";
import { JobsSettingsCard, SubscriptionsCard } from "./_components/jobs-settings-card";
import { AccountCards } from "./_components/account-cards";
import { useBackupSettings } from "./_hooks/use-backup-settings";
import { useJobsSettings } from "./_hooks/use-jobs-settings";
import { useAccountSettings } from "./_hooks/use-account-settings";

/**
 * 设置页（S6-4 拆分后只做编排）。
 *
 * 领域状态：
 *  - useBackupSettings：数据库状态 / JSON 导出导入
 *  - useJobsSettings：招聘爬虫配置、运行日志、信息源、订阅
 *  - useAccountSettings：账号信息 / 修改密码 / 退出登录
 * 展示：
 *  - AppearanceSection：外观、专注背景、数据备份、云同步、关于
 *  - JobsSettingsCard / SubscriptionsCard：招聘爬虫与订阅
 *  - AccountCards：账号与修改密码
 */
export default function SettingsPage() {
  const backup = useBackupSettings();
  const jobs = useJobsSettings();
  const account = useAccountSettings();

  return (
    <div className="page-enter flex flex-col gap-6">
      <div>
        <h1 className="page-title text-2xl font-bold tracking-tight lg:text-3xl">设置</h1>
        <p className="page-subtitle mt-1 text-sm">外观、背景图、数据备份与同步</p>
      </div>

      {backup.msg ? <Badge variant="success">{backup.msg}</Badge> : null}

      {/* v8 P2：与 APP「我的」页一致的分组快捷入口（账号 / 学习与数据 / 健康 / 账号与安全） */}
      <QuickLinks />

      <AppearanceSection backup={backup} />

      <JobsSettingsCard jobs={jobs} />

      <SubscriptionsCard jobs={jobs} />

      <AccountCards account={account} />

      <AboutCard />
    </div>
  );
}
