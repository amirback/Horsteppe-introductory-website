import Link from "next/link";
import type { SiteDict } from "../../lib/content/types.ts";
import type { Lang } from "../../lib/i18n.ts";
import { CONTACT_EMAIL } from "../../lib/site.ts";
import { LangSwitch } from "./LangSwitch.tsx";
import { LogoMark, Wordmark } from "./Logo.tsx";

export function Footer({ lang, t, nav, appUrl, path = "" }: {
  lang: Lang; t: SiteDict["footer"]; nav: SiteDict["nav"]; appUrl: string; path?: string;
}) {
  return (
    <footer className="bg-forest text-cream">
      <div className="container-x grid gap-10 border-t border-cream/10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href={`/${lang}`} className="flex items-center gap-2.5" aria-label="Horsteppe">
            <LogoMark className="h-8 w-8" inverted />
            <Wordmark className="text-cream" />
          </Link>
          <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-cream/60">{t.tagline}</p>
          <p className="mt-4 text-[13px] text-cream/45">{t.orda}</p>
        </div>
        <div>
          <div className="kicker text-[11px] text-cream/45">{t.contact}</div>
          <a href={`mailto:${CONTACT_EMAIL}`} className="mt-3 block text-[15px] text-cream/90 hover:text-lime">
            {CONTACT_EMAIL}
          </a>
          <a href={`${appUrl}/${lang}/login`} className="mt-2 block text-[15px] text-cream/90 hover:text-lime">
            {t.signIn}
          </a>
          <Link href={`/${lang}/privacy`} className="mt-2 block text-[15px] text-cream/90 hover:text-lime">
            {t.privacy}
          </Link>
        </div>
        <div>
          <div className="kicker text-[11px] text-cream/45">{nav.language}</div>
          <div className="mt-2 -ml-1.5">
            <LangSwitch lang={lang} path={path} label={nav.language} tone="dark" />
          </div>
        </div>
      </div>
      <div className="container-x flex flex-wrap items-center justify-between gap-3 border-t border-cream/10 py-6 text-[13px] text-cream/45">
        <span>
          © {new Date().getFullYear()} Horsteppe. {t.rights}
        </span>
        <a href={`/${lang}#access`} className="hover:text-cream">
          {nav.cta}
        </a>
      </div>
    </footer>
  );
}
