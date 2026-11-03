/** Постоянные данные сайта. Адреса — из окружения, с честными умолчаниями. */

export const BRAND = "Horsteppe";
export const CONTACT_EMAIL = "Horsteppe@gmail.com";

/**
 * Адрес этого сайта для канонических ссылок, карты сайта и карточек соцсетей.
 *
 * На Vercel адрес боевого развёртывания приходит сам (VERCEL_PROJECT_PRODUCTION_URL),
 * поэтому до покупки своего домена ничего настраивать не нужно. Свой домен —
 * NEXT_PUBLIC_SITE_URL.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

/** Сам продукт: туда ведёт «Войти» для действующих клиентов. */
export const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://horsteppe.vercel.app").replace(/\/+$/, "");
