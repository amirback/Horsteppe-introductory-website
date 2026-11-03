import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "../../../components/site/Footer.tsx";
import { Header } from "../../../components/site/Header.tsx";
import { content } from "../../../lib/content/index.ts";
import { LOCALES, isLang } from "../../../lib/i18n.ts";
import { APP_URL, CONTACT_EMAIL } from "../../../lib/site.ts";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = content[lang];
  return {
    title: t.footer.privacy,
    description: t.privacy.intro,
    alternates: {
      canonical: `/${lang}/privacy`,
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/privacy`])),
    },
    openGraph: { url: `/${lang}/privacy`, title: t.privacy.title, description: t.privacy.intro },
  };
}

/** Почту в тексте делаем ссылкой: так написать проще, чем копировать адрес. */
function withMailto(text: string) {
  const parts = text.split(CONTACT_EMAIL);
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <a key={i} href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-pine underline decoration-pine/40 underline-offset-4 hover:decoration-pine">
            {CONTACT_EMAIL}
          </a>,
          part,
        ],
  );
}

export default async function Privacy({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = content[lang];
  return (
    <>
      <Header lang={lang} t={t.nav} appUrl={APP_URL} path="/privacy" home={false} />
      <main id="main" className="shell pb-20 pt-32 md:pb-28 md:pt-40">
        <article className="mx-auto max-w-3xl">
          <p className="eyebrow flex items-center gap-3 text-brass">
            <span className="h-px w-8 bg-current opacity-50" aria-hidden />
            {t.footer.privacy}
          </p>
          <h1 className="display mt-5 text-pine [font-size:clamp(2.25rem,1.4rem+3.2vw,3.75rem)]">{t.privacy.title}</h1>
          <p className="mt-5 text-[0.875rem] text-ink-mute">{t.privacy.updated}</p>
          <p className="mt-6 text-pretty font-serif text-[1.375rem] leading-snug text-ink-soft sm:text-[1.5rem]">{t.privacy.intro}</p>
          <div className="mt-12 border-t border-pine/15">
            {t.privacy.sections.map((section, i) => (
              <section key={section.h} className="grid gap-3 border-b border-pine/15 py-8 sm:grid-cols-[3.5rem_1fr] sm:gap-6">
                <span className="font-mono text-[0.75rem] tabular-nums text-brass sm:pt-2">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h2 className="font-serif text-[1.625rem] font-semibold leading-tight text-pine">{section.h}</h2>
                  {section.p.map((p) => (
                    <p key={p.slice(0, 40)} className="mt-3 text-pretty text-[1rem] leading-relaxed text-ink-soft">
                      {withMailto(p)}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <Link href={`/${lang}`} className="btn btn-line mt-12">
            {t.privacy.back}
          </Link>
        </article>
      </main>
      <Footer lang={lang} t={t.footer} nav={t.nav} appUrl={APP_URL} path="/privacy" />
    </>
  );
}
