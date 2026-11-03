"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SiteDict } from "../../lib/content/types.ts";
import type { Lang } from "../../lib/i18n.ts";
import { Emblem, Wordmark } from "./Brand.tsx";
import { ArrowIcon, CloseIcon, MenuIcon } from "./Icons.tsx";
import { LangSwitch } from "./LangSwitch.tsx";

type Props = { lang: Lang; t: SiteDict["nav"]; appUrl: string; path?: string; home?: boolean };

export function Header({ lang, t, appUrl, path = "", home = true }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Растянули окно до полной шапки — меню больше не нужно.
    const wide = window.matchMedia("(min-width: 1280px)");
    const onWide = () => wide.matches && setOpen(false);
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
      document.body.style.overflow = "";
    };
  }, [open]);

  // На внутренних страницах якоря ведут на главную того же языка.
  const anchor = (id: string) => (home ? `#${id}` : `/${lang}#${id}`);
  const links = [
    { href: anchor("how"), label: t.how },
    { href: anchor("features"), label: t.features },
    { href: anchor("for"), label: t.useCases },
    { href: anchor("faq"), label: t.faq },
  ];
  const signIn = `${appUrl}/${lang}/login`;
  const close = () => setOpen(false);

  // Под размытием фона fixed-меню считалось бы от шапки, а не от экрана, — поэтому при открытом меню размытия нет.
  const surface = open
    ? "border-gold/15 bg-night"
    : scrolled
      ? "border-pine/12 bg-parchment/92 backdrop-blur-md"
      : "border-transparent bg-transparent";

  return (
    <header
      // Открытое меню темнеет сразу: плавный переход оставил бы светлую надпись на светлом фоне на долю секунды.
      className={`fixed inset-x-0 top-0 z-50 border-b ${open ? "" : "transition-[background-color,border-color] duration-300"} ${surface}`}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-[0.25rem] focus:bg-pine focus:px-4 focus:py-2 focus:text-parchment"
      >
        {t.skip}
      </a>
      <div className="shell flex h-16 items-center gap-4 md:h-[4.5rem]">
        <Link href={`/${lang}`} className="-ml-1 flex shrink-0 items-center gap-2.5 rounded-[0.25rem] px-1 py-1" aria-label="Horsteppe" onClick={close}>
          <Emblem className="h-9 w-auto md:h-10" sizes="56px" priority />
          <Wordmark className={open ? "text-cream" : "text-pine"} />
        </Link>

        <nav aria-label="Main" className="ml-8 hidden items-center xl:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-[0.25rem] px-3 py-2 text-[0.875rem] font-medium text-ink-soft transition-colors hover:text-pine">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-4 xl:flex">
          <LangSwitch lang={lang} path={path} label={t.language} />
          <a href={signIn} className="rounded-[0.25rem] px-1 py-2 text-[0.875rem] font-medium text-ink-soft transition-colors hover:text-pine">
            {t.signIn}
          </a>
          <a href={anchor("access")} className="btn btn-primary min-h-10 px-4 py-2 text-[0.875rem]">
            {t.cta}
            <ArrowIcon className="arrow h-3.5 w-3.5" />
          </a>
        </div>

        <div className="ml-auto flex items-center gap-2 xl:hidden">
          {open ? null : (
            <a href={anchor("access")} className="btn btn-primary hidden min-h-10 px-4 py-2 text-[0.875rem] sm:inline-flex">
              {t.cta}
            </a>
          )}
          <button
            type="button"
            className={`-mr-2 inline-flex h-11 items-center gap-2 rounded-[0.25rem] px-2.5 text-[0.875rem] font-semibold ${open ? "text-cream" : "text-pine"}`}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? t.close : t.menu}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
            <span aria-hidden>{open ? t.close : t.menu}</span>
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-menu" className="on-dark fixed inset-x-0 bottom-0 top-16 overflow-y-auto overscroll-contain bg-night text-cream md:top-[4.5rem] xl:hidden">
          <div aria-hidden className="hatch-dark pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_top,#000,transparent_60%)]" />
          <div className="shell relative flex min-h-full flex-col pb-[max(2rem,env(safe-area-inset-bottom))] pt-2">
            <nav aria-label="Mobile">
              <ol>
                {links.map((l, i) => (
                  <li key={l.href} className="border-b border-gold/15">
                    <a href={l.href} onClick={close} className="flex items-baseline gap-4 py-4 sm:py-5">
                      <span className="w-6 shrink-0 font-mono text-[0.75rem] text-gold/70">{String(i + 1).padStart(2, "0")}</span>
                      <span className="font-serif text-[clamp(1.75rem,1.2rem+2.6vw,2.5rem)] font-semibold leading-tight text-cream">{l.label}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="mt-auto pt-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <LangSwitch lang={lang} path={path} label={t.language} tone="dark" size="lg" />
                <a href={signIn} className="inline-flex min-h-11 items-center text-[0.9375rem] font-medium text-cream-soft hover:text-cream">
                  {t.signIn}
                </a>
              </div>
              <a href={anchor("access")} onClick={close} className="btn btn-gold mt-6 min-h-14 w-full text-base">
                {t.cta}
                <ArrowIcon className="arrow h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
