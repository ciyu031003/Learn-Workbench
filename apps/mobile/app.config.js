/**
 * Expo 动态配置（P0）：
 * - API 地址：默认生产域名 https://learn.yuanabd.cn，可用 EXPO_PUBLIC_API_URL 覆盖（如本地/模拟器）
 * - usesCleartextTraffic：仅当显式设置 EXPO_PUBLIC_ALLOW_CLEARTEXT=1 才允许明文 HTTP（开发联调用）
 * 用法：
 *   EXPO_PUBLIC_API_URL=http://10.0.2.2:3001 EXPO_PUBLIC_ALLOW_CLEARTEXT=1 npx expo start
 */
const base = require("./app.json");

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "https://learn.yuanabd.cn";
const allowCleartext = process.env.EXPO_PUBLIC_ALLOW_CLEARTEXT === "1";

module.exports = () => {
  const plugins = (base.expo.plugins || []).map((p) => {
    if (Array.isArray(p) && p[0] === "expo-build-properties") {
      const android = { ...(p[1]?.android ?? {}), usesCleartextTraffic: allowCleartext };
      return ["expo-build-properties", { ...p[1], android }];
    }
    return p;
  });
  return {
    ...base,
    expo: {
      ...base.expo,
      extra: { ...(base.expo.extra ?? {}), apiUrl },
      plugins,
    },
  };
};