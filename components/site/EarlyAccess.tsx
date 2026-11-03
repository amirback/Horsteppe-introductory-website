import type { SiteDict } from "../../lib/content/types.ts";
import type { Lang } from "../../lib/i18n.ts";
import { CONTACT_EMAIL } from "../../lib/site.ts";
import { CheckIcon } from "./Icons.tsx";
import { LeadForm } from "./LeadForm.tsx";

export function EarlyAccess({ lang, t }: { lang: Lang; t: SiteDict["access"] }) {
  return (
    <section id="access" className="relative overflow-hidden bg-forest py-20 text-cream md:py-28">
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-olive/20 blur-3xl" aria-hidden />
      <div className="container-x relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="reveal">
          <div className="kicker text-lime">{t.kicker}</div>
          <h2 className="font-display mt-3 text-balance font-bold leading-[1.06] tracking-[-0.03em] [font-size:clamp(30px,4.4vw,50px)]">
            {t.title}
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-cream/75">{t.sub}</p>
          <ul className="mt-8 space-y-4">
            {t.perks.map((perk) => (
              <li key={perk} className="flex gap-3 text-[16px] leading-snug text-cream/90">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime text-forest">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-[14.5px] text-cream/55">
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-cream/85 underline-offset-4 hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
        <div className="reveal relative rounded-[28px] bg-paper p-6 text-ink shadow-[0_40px_90px_-40px_rgba(0,0,0,0.6)] sm:p-8" style={{ "--d": "0.1s" } as React.CSSProperties}>
          <LeadForm lang={lang} t={t.form} privacyHref={`/${lang}/privacy`} />
        </div>
      </div>
    </section>
  );
}
