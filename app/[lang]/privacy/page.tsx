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
          <a key={i} href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-ink underline underline-offset-4">
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
      <main id="main" className="container-x pb-20 pt-32 md:pb-28 md:pt-40">
        <article className="mx-auto max-w-3xl">
          <div className="kicker text-sage">{t.footer.privacy}</div>
          <h1 className="font-display mt-3 text-balance font-bold leading-[1.08] tracking-[-0.03em] text-ink [font-size:clamp(30px,4.6vw,48px)]">
            {t.privacy.title}
          </h1>
          <p className="mt-4 text-[14px] text-ink-mute">{t.privacy.updated}</p>
          <p className="mt-6 text-pretty text-[17.5px] leading-relaxed text-ink-soft">{t.privacy.intro}</p>
          <div className="mt-12 space-y-10">
            {t.privacy.sections.map((section) => (
              <section key={section.h}>
                <h2 className="font-display text-[21px] font-bold tracking-[-0.01em] text-ink">{section.h}</h2>
                {section.p.map((p) => (
                  <p key={p.slice(0, 40)} className="mt-3 text-pretty text-[16px] leading-relaxed text-ink-soft">
                    {withMailto(p)}
                  </p>
                ))}
              </section>
            ))}
          </div>
          <Link href={`/${lang}`} className="mt-14 inline-flex items-center rounded-full border border-ink/20 px-6 py-3 text-[15px] font-semibold text-ink hover:border-ink/50">
            {t.privacy.back}
          </Link>
        </article>
      </main>
      <Footer lang={lang} t={t.footer} nav={t.nav} appUrl={APP_URL} path="/privacy" />
    </>
  );
}
