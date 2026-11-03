import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EarlyAccess } from "../../components/site/EarlyAccess.tsx";
import { Footer } from "../../components/site/Footer.tsx";
import { Header } from "../../components/site/Header.tsx";
import { Contrast, Faq, Features, FinalCta, Hero, HowItWorks, UseCases } from "../../components/site/Sections.tsx";
import { content } from "../../lib/content/index.ts";
import { LOCALES, isLang } from "../../lib/i18n.ts";
import { APP_URL, CONTACT_EMAIL, siteUrl } from "../../lib/site.ts";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = content[lang];
  return {
    title: { absolute: t.meta.title },
    alternates: {
      canonical: `/${lang}`,
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])), "x-default": "/en" },
    },
    openGraph: { url: `/${lang}`, title: t.meta.title, description: t.meta.description },
  };
}

function JsonLd({ description }: { description: string }) {
  const url = siteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Horsteppe",
    url,
    logo: `${url}/logo.png`,
    email: CONTACT_EMAIL,
    description,
  };
  // Вывод JSON внутри <script>: «<» экранируется, чтобы текст не закрыл тег.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const t = content[lang];
  return (
    <>
      <Header lang={lang} t={t.nav} appUrl={APP_URL} />
      <main id="main">
        <Hero t={t.hero} demo={t.demo} />
        <Contrast t={t.contrast} />
        <HowItWorks t={t.how} />
        <Features t={t.features} />
        <UseCases t={t.useCases} lang={lang} />
        <EarlyAccess lang={lang} t={t.access} />
        <Faq t={t.faq} email={CONTACT_EMAIL} />
        <FinalCta t={t.final} />
      </main>
      <Footer lang={lang} t={t.footer} nav={t.nav} appUrl={APP_URL} />
      <JsonLd description={t.meta.description} />
    </>
  );
}
