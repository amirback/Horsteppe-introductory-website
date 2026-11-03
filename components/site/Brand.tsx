import Image from "next/image";
import emblem from "../../public/brand/emblem.png";

/**
 * Знак ознакомительного сайта — лошадь на дубовых листьях из логотипа основателя,
 * вырезанная без фона (scripts/brand/cutout.py). У продукта знак свой, его не трогаем.
 *
 * Картинку сжимает и отдаёт в нужном размере Next (webp/avif). sizes — ширина, с
 * которой знак рисуется на странице: по ней браузер берёт файл подходящего размера.
 */
export function Emblem({ className = "h-9 w-auto", sizes = "48px", priority = false }: {
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return <Image src={emblem} alt="" aria-hidden className={className} sizes={sizes} priority={priority} draggable={false} />;
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif text-[1.375rem] font-semibold leading-none tracking-[-0.005em] ${className}`}>Horsteppe</span>
  );
}
