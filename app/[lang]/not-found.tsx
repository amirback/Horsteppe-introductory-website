import Link from "next/link";
import { headers } from "next/headers";
import { LogoMark } from "../../components/site/Logo.tsx";
import { content } from "../../lib/content/index.ts";
import { DEFAULT_LOCALE, isLang } from "../../lib/i18n.ts";

/** Язык страницы 404 подсказывает middleware: сама страница параметров не получает. */
export default async function NotFound() {
  const raw = (await headers()).get("x-hs-lang");
  const lang = isLang(raw) ? raw : DEFAULT_LOCALE;
  const t = content[lang].notFound;
  return (
    <main className="glow flex min-h-[100svh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto h-12 w-12" />
        <div className="font-display mt-8 text-[64px] font-bold leading-none tracking-[-0.04em] text-ink/15">404</div>
        <h1 className="font-display mt-4 text-[30px] font-bold tracking-[-0.02em] text-ink">{t.title}</h1>
        <p className="mt-3 text-[16px] text-ink-soft">{t.text}</p>
        <Link href={`/${lang}`} className="mt-8 inline-flex rounded-full bg-ink px-6 py-3.5 text-[15px] font-semibold text-cream hover:bg-moss">
          {t.home}
        </Link>
      </div>
    </main>
  );
}
