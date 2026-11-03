import Link from "next/link";
import { LOCALES, LOCALE_META, type Lang } from "../../lib/i18n.ts";

/** Переключатель языка: ведёт на ту же страницу на другом языке. */
export function LangSwitch({
  lang, path = "", label, tone = "light",
}: { lang: Lang; path?: string; label: string; tone?: "light" | "dark" }) {
  const idle = tone === "dark" ? "text-cream/55 hover:text-cream" : "text-ink-mute hover:text-ink";
  const active = tone === "dark" ? "text-cream" : "text-ink";
  return (
    <nav aria-label={label} className="flex items-center gap-1">
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 ? <span className={tone === "dark" ? "text-cream/25" : "text-ink/20"} aria-hidden>·</span> : null}
          <Link
            href={`/${l}${path}`}
            hrefLang={LOCALE_META[l].htmlLang}
            lang={LOCALE_META[l].htmlLang}
            aria-current={l === lang ? "page" : undefined}
            title={LOCALE_META[l].native}
            className={`kicker rounded-md px-1.5 py-1 transition-colors ${l === lang ? active : idle}`}
          >
            {LOCALE_META[l].label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
