/**
 * OTA 清单验签公钥（Ed25519，**raw 32 字节**，base64url 无 padding）。
 *
 * 为什么要内置公钥：更新清单决定"给用户装哪个 APK"。清单走 HTTPS，但 CDN/中间人/误操作
 * 仍可能替换它；只校验 APK 的 sha256 不够（攻击者可以连清单里的 sha256 一起换掉）。
 * 所以发布脚本用**离线私钥**对清单签名，客户端用这里的内置公钥验签 —— 换包必须同时换签名，
 * 而私钥不在仓库/服务器上。
 *
 * ---- 格式 ----
 * - 公钥：Ed25519 raw public key 的 32 字节，base64url（RFC 4648 §5，无 '=' padding）。
 * - 签名：64 字节，base64url；签名对象见 scripts/lib/ota-manifest.mjs 的 canonicalOtaManifestJson
 *   （固定字段顺序的紧凑 JSON，排除 signature 字段）。
 * - 环境变量覆盖：EXPO_PUBLIC_OTA_PUBLIC_KEY（可逗号分隔多把，用于轮换过渡），
 *   打包时由 Expo 内联；不设置则用下面的默认值。
 *
 * ---- 生成（发布机执行，一次性）----
 *   node -e "const{generateKeyPairSync}=require('node:crypto');const{publicKey,privateKey}=generateKeyPairSync('ed25519');console.log('PUBLIC(写入本文件):',publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64url'));console.log(privateKey.export({type:'pkcs8',format:'pem'}))"
 *   私钥保存到发布机密位置：本机 .local/ota-signing-key.pem（.local/ 已 gitignore），
 *   或 CI Secret OTA_SIGNING_KEY_PEM（内容为 PKCS#8 PEM 原文）。**私钥绝不入库、不进 APK。**
 *
 * ---- 轮换 ----
 * 1. 生成新密钥对，把新公钥设为 OTA_PUBLIC_KEY_BASE64URL，旧公钥加入
 *    PREVIOUS_PUBLIC_KEYS_BASE64URL（或同时放进 EXPO_PUBLIC_OTA_PUBLIC_KEY 逗号列表）；
 * 2. 先随 App 发版（客户端同时信任新旧公钥）；
 * 3. 等目标用户覆盖到该版本后，发布脚本切换到新私钥；旧私钥停止使用；
 * 4. 下个版本再把旧公钥从信任列表移除。
 */
export const OTA_PUBLIC_KEY_BASE64URL = "0l-hdEqgHGotMZNGY5XRc7ZAJmiQEgLn3yri90ROmm0";

/** 轮换过渡期仍可信的旧公钥（默认空） */
const PREVIOUS_PUBLIC_KEYS_BASE64URL: string[] = [];

/**
 * 当前可信公钥列表（默认内置 + 历史过渡 + 环境变量覆盖）。
 * 顺序：环境变量里的优先（测试/灰度可用），其次默认，最后过渡旧钥。
 */
export function getOtaPublicKeysBase64Url(): string[] {
  const env = typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_OTA_PUBLIC_KEY : undefined;
  const fromEnv = typeof env === "string" ? env.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const all = [...fromEnv, OTA_PUBLIC_KEY_BASE64URL, ...PREVIOUS_PUBLIC_KEYS_BASE64URL].filter(Boolean);
  return [...new Set(all)];
}

/** 主公钥（发布脚本打印/排查用） */
export function getOtaPublicKeyBase64Url(): string {
  return getOtaPublicKeysBase64Url()[0] ?? "";
}
