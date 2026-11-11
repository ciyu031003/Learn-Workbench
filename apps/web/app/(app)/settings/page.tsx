"use client";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
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
    <div className="page-enter flex flex-col gap-5">
      <PageHeader title="设置" description="外观、背景图、数据备份与同步" />

      {backup.msg ? <Badge variant="success" className="self-start">{backup.msg}</Badge> : null}

      {/* 账号与同步优先：设置页第一屏先解决身份与数据归属 */}
      <div id="account">
        <AccountCards account={account} />
      </div>

      <AppearanceSection backup={backup} />

      <QuickLinks />

      <JobsSettingsCard jobs={jobs} />

      <SubscriptionsCard jobs={jobs} />

      <AboutCard />
    </div>
  );
}
