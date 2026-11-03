import type { SiteDict } from "../../lib/content/types.ts";
import type { Lang } from "../../lib/i18n.ts";
import { CONTACT_EMAIL } from "../../lib/site.ts";
import { Emblem } from "./Brand.tsx";
import { LeadForm } from "./LeadForm.tsx";

const ROMAN = ["I", "II", "III", "IV", "V"];

/**
 * Заявка на ранний доступ — как приглашение в рамке: слева тёмная половина с
 * условиями, справа форма. На телефоне — одно под другим.
 */
export function EarlyAccess({ lang, t }: { lang: Lang; t: SiteDict["access"] }) {
  return (
    <section id="access" className="py-20 md:py-28">
      <div className="shell">
        <div className="reveal rounded-[0.5rem] border border-pine/15 bg-vellum p-1.5 shadow-[0_50px_100px_-70px_rgba(28,43,27,0.7)] sm:p-2.5">
          <div className="grid overflow-hidden rounded-[0.25rem] border border-brass/25 lg:grid-cols-12">
            <div className="on-dark relative isolate overflow-hidden bg-night p-6 text-cream sm:p-10 lg:col-span-5 lg:p-12">
              <div aria-hidden className="hatch-dark pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_top,#000,transparent_70%)]" />
              <Emblem
                className="pointer-events-none absolute -bottom-10 -right-12 -z-10 h-auto w-64 opacity-[0.12] sm:w-80"
                sizes="320px"
              />
              <p className="eyebrow flex items-center gap-3 text-gold">
                <span className="tabular-nums">05</span>
                <span className="h-px w-8 bg-current opacity-40" aria-hidden />
                <span>{t.kicker}</span>
              </p>
              <h2 className="display mt-6 text-cream [font-size:clamp(1.875rem,1.25rem+2.2vw,3rem)]">{t.title}</h2>
              <p className="mt-5 max-w-xl text-pretty text-[1rem] leading-relaxed text-cream-soft">{t.sub}</p>
              <ol className="mt-9 space-y-5">
                {t.perks.map((perk, i) => (
                  <li key={perk} className="grid grid-cols-[2rem_1fr] items-baseline gap-3 border-t border-gold/15 pt-5">
                    <span className="font-serif text-[1.25rem] leading-none text-gold">{ROMAN[i]}</span>
                    <span className="text-[0.9375rem] leading-snug text-cream">{perk}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-10 text-[0.875rem]">
                <a href={`mailto:${CONTACT_EMAIL}`} className="link-line font-semibold text-cream">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
            <div className="bg-vellum p-5 sm:p-10 lg:col-span-7 lg:p-12">
              <LeadForm lang={lang} t={t.form} privacyHref={`/${lang}/privacy`} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
