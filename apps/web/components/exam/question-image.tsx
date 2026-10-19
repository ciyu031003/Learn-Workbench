import { cn } from "@/lib/utils";
import { contentImageMeta, contentImageSrcSet } from "@/lib/content-image";

/**
 * 408 题目配图（S3-5）。
 *
 * - 有 WebP 变体时输出 `<picture>`（640w/1280w + sizes），无 WebP 支持的浏览器回退原 PNG；
 * - 用清单里的固有宽高设置 width/height，图片加载前就占好位，消除 CLS；
 * - 只对 `/content-images/` 下且已跑过管线的图启用变体，其它 URL（COS/外部）保持原样。
 */
export function QuestionImage({
  src,
  alt,
  className,
  wrapperClassName,
  sizes = "(max-width: 640px) 100vw, 50vw",
}: {
  src: string;
  alt: string;
  /** 图片本体额外类名（默认 `max-h-80`） */
  className?: string;
  /** 外层链接额外类名（默认圆角 + 细边框 + 白底） */
  wrapperClassName?: string;
  sizes?: string;
}) {
  const meta = contentImageMeta(src);
  const srcSet = contentImageSrcSet(src);

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- 变体由 <picture> 提供，next/image 无法直接消费外部生成的 srcSet
    <img
      src={src}
      alt={alt}
      width={meta?.width}
      height={meta?.height}
      loading="lazy"
      decoding="async"
      className={cn("h-auto w-full object-contain", className)}
    />
  );

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className={cn("block overflow-hidden rounded-lg border border-border/60 bg-white", wrapperClassName)}
    >
      {srcSet ? (
        <picture>
          <source type="image/webp" srcSet={srcSet} sizes={sizes} />
          {image}
        </picture>
      ) : (
        image
      )}
    </a>
  );
}
