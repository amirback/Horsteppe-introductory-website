export const LOCALES = ["en", "ru", "kk"] as const;
export type Lang = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Lang = "en";

export const LOCALE_META: Record<Lang, { label: string; native: string; htmlLang: string; ogLocale: string }> = {
  en: { label: "EN", native: "English", htmlLang: "en", ogLocale: "en_US" },
  ru: { label: "RU", native: "Русский", htmlLang: "ru", ogLocale: "ru_RU" },
  kk: { label: "KK", native: "Қазақша", htmlLang: "kk", ogLocale: "kk_KZ" },
};

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Язык по заголовку Accept-Language с учётом весов q.
 *
 * Казахстанские браузеры шлют то kk-KZ, то ru-KZ, а иногда устаревшее «kz» —
 * его считаем казахским.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Lang {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      const weight = q ? Number(q.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0];
    if (isLang(base)) return base;
    if (base === "kz") return "kk";
  }
  return DEFAULT_LOCALE;
}
