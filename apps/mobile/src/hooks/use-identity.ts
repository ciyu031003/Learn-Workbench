import { useAppStore } from "@/store/app-store";
import { identityInitial, identityName } from "@/lib/identity-name";

/** 今日页 / 我的页共用同一份身份来源，避免 admin / 学习工作台 / 我 三套文案并存 */
export function useIdentity() {
  const displayName = useAppStore((s) => s.displayName);
  const username = useAppStore((s) => s.username);
  const avatarUrl = useAppStore((s) => s.avatarUrl);
  const name = identityName(displayName, username);
  return { name, initial: identityInitial(name), avatarUrl };
}
