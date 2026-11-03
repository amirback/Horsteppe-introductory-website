import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { RevealObserver } from "../../components/site/RevealObserver.tsx";
import { content } from "../../lib/content/index.ts";
import { LOCALES, LOCALE_META, isLang } from "../../lib/i18n.ts";
import { siteUrl } from "../../lib/site.ts";

const montserrat = Montserrat({ subsets: ["latin", "cyrillic"], variable: "--font-montserrat", display: "swap" });
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-body", display: "swap" });

// Только три языка; всё остальное — честный 404, а не пустая страница.
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const t = content[lang];
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t.meta.title, template: "%s · Horsteppe" },
    description: t.meta.description,
    applicationName: "Horsteppe",
    openGraph: {
      type: "website",
      siteName: "Horsteppe",
      locale: LOCALE_META[lang].ogLocale,
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "Horsteppe" }],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = { themeColor: "#f7f6e9", colorScheme: "light" };

/**
 * Класс .js ставится до отрисовки: только тогда блоки ниже первого экрана
 * прячутся до прокрутки. Страховка через 2.5 с показывает всё, если основной
 * скрипт не загрузился, — невидимой страница не останется ни при каком сбое.
 */
const BOOT =
  "document.documentElement.classList.add('js');setTimeout(function(){if(!window.__hsReveal){" +
  "document.querySelectorAll('.reveal').forEach(function(e){e.classList.add('is-visible')})}},2500);";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={LOCALE_META[lang].htmlLang} className={`${montserrat.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body className="min-h-screen bg-paper text-ink antialiased">
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
