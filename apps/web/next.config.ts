import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** 全站安全响应头（P0）：CSP / 点击劫持 / MIME 嗅探 / HSTS（仅生产） */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // connect-src 保留 http/https：设置页允许用户自定义后端地址（真机联调/自建服务）
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' http: https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // 图片处理用 sharp（原生模块）：声明为外部依赖，避免被打进 bundle
  serverExternalPackages: ["sharp"],
  /**
   * S3-5 图片优化：
   * - 现代格式优先（AVIF/WebP），由 Next 内置 sharp 转换；
   * - 内容图另有 `scripts/optimize-content-images.mjs` 生成的静态 WebP 变体（640w/1280w），
   *   生产环境即使绕过 /_next/image 也能直出小图；
   * - 缓存 1 天，减少回源（题目图文件名带 hash，可安全长缓存）。
   */
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1280, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
  },
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;