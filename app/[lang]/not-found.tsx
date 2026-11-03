import Link from "next/link";
import { headers } from "next/headers";
import { Emblem } from "../../components/site/Brand.tsx";
import { content } from "../../lib/content/index.ts";
import { DEFAULT_LOCALE, isLang } from "../../lib/i18n.ts";

/** Язык страницы 404 подсказывает middleware: сама страница параметров не получает. */
export default async function NotFound() {
  const raw = (await headers()).get("x-hs-lang");
  const lang = isLang(raw) ? raw : DEFAULT_LOCALE;
  const t = content[lang].notFound;
  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center px-6 py-16">
      <div aria-hidden className="hatch pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(55%_55%_at_50%_45%,#000,transparent)]" />
      <div className="max-w-md text-center">
        <Emblem className="mx-auto h-auto w-36" sizes="144px" priority />
        <div className="mt-8 font-serif text-[5rem] font-semibold leading-none text-brass/40 [font-variant-numeric:lining-nums]">404</div>
        <h1 className="display mt-3 text-[2.25rem] text-pine">{t.title}</h1>
        <p className="mt-3 text-pretty text-[1rem] text-ink-soft">{t.text}</p>
        <Link href={`/${lang}`} className="btn btn-primary mt-8">
          {t.home}
        </Link>
      </div>
    </main>
  );
}
