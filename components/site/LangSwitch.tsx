import Link from "next/link";
import { LOCALES, LOCALE_META, type Lang } from "../../lib/i18n.ts";

/**
 * Переключатель языка: ведёт на ту же страницу на другом языке. Текущий язык
 * обведён тонкой рамкой. size="lg" — для меню на телефоне и подвала: кнопки 44 px.
 */
export function LangSwitch({
  lang, path = "", label, tone = "light", size = "sm",
}: { lang: Lang; path?: string; label: string; tone?: "light" | "dark"; size?: "sm" | "lg" }) {
  const dark = tone === "dark";
  const box = size === "lg" ? "h-11 min-w-12 px-3 text-[0.75rem]" : "h-8 min-w-9 px-2 text-[0.6875rem]";
  return (
    <nav aria-label={label} className="flex items-center gap-0.5">
      {LOCALES.map((l) => {
        const active = l === lang;
        const look = active
          ? dark ? "border-gold/50 text-gold" : "border-pine/40 text-pine"
          : dark ? "border-transparent text-cream-mute hover:text-cream" : "border-transparent text-ink-mute hover:text-pine";
        return (
          <Link
            key={l}
            href={`/${l}${path}`}
            hrefLang={LOCALE_META[l].htmlLang}
            lang={LOCALE_META[l].htmlLang}
            aria-current={active ? "page" : undefined}
            title={LOCALE_META[l].native}
            className={`eyebrow inline-flex items-center justify-center rounded-[0.1875rem] border transition-colors ${box} ${look}`}
          >
            {LOCALE_META[l].label}
          </Link>
        );
      })}
    </nav>
  );
}
