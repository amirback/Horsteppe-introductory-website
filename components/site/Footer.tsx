import Link from "next/link";
import type { SiteDict } from "../../lib/content/types.ts";
import type { Lang } from "../../lib/i18n.ts";
import { CONTACT_EMAIL } from "../../lib/site.ts";
import { Emblem, Wordmark } from "./Brand.tsx";
import { LangSwitch } from "./LangSwitch.tsx";

export function Footer({ lang, t, nav, appUrl, path = "" }: {
  lang: Lang; t: SiteDict["footer"]; nav: SiteDict["nav"]; appUrl: string; path?: string;
}) {
  const link = "inline-flex min-h-11 items-center text-[0.9375rem] text-cream transition-colors hover:text-gold";
  return (
    <footer className="on-dark bg-night text-cream">
      <div className="shell">
        <div className="grid gap-10 border-t border-gold/15 py-14 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5">
            <Link href={`/${lang}`} className="-ml-1 inline-flex items-center gap-2.5 rounded-[0.25rem] px-1 py-1" aria-label="Horsteppe">
              <Emblem className="h-10 w-auto" sizes="56px" />
              <Wordmark className="text-cream" />
            </Link>
            <p className="mt-5 max-w-sm text-pretty text-[0.9375rem] leading-relaxed text-cream-soft">{t.tagline}</p>
            <p className="mt-4 text-[0.8125rem] text-cream-mute">{t.orda}</p>
          </div>
          <div className="md:col-span-4">
            <div className="eyebrow text-[0.6875rem] text-cream-mute">{t.contact}</div>
            <ul className="mt-3">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <a href={`${appUrl}/${lang}/login`} className={link}>
                  {t.signIn}
                </a>
              </li>
              <li>
                <Link href={`/${lang}/privacy`} className={link}>
                  {t.privacy}
                </Link>
              </li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <div className="eyebrow text-[0.6875rem] text-cream-mute">{nav.language}</div>
            <div className="-ml-1 mt-3">
              <LangSwitch lang={lang} path={path} label={nav.language} tone="dark" size="lg" />
            </div>
          </div>
        </div>

        {/* Большое имя во всю ширину — подпись под всем сайтом. */}
        <div aria-hidden className="select-none overflow-hidden border-t border-gold/15 pt-8">
          <div className="whitespace-nowrap text-center font-serif font-semibold leading-[0.78] tracking-[-0.02em] text-gold/[0.14] [font-size:clamp(4.25rem,18.5vw,17.5rem)]">
            Horsteppe
          </div>
        </div>

        <div className="flex flex-col gap-1 border-t border-gold/15 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 text-[0.8125rem] text-cream-mute sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} Horsteppe. {t.rights}
          </span>
          <a href={`/${lang}#access`} className="inline-flex min-h-11 items-center transition-colors hover:text-cream">
            {nav.cta}
          </a>
        </div>
      </div>
    </footer>
  );
}
