"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SiteDict } from "../../lib/content/types.ts";
import type { Lang } from "../../lib/i18n.ts";
import { CloseIcon, MenuIcon } from "./Icons.tsx";
import { LangSwitch } from "./LangSwitch.tsx";
import { LogoMark, Wordmark } from "./Logo.tsx";

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
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // На внутренних страницах якоря ведут на главную того же языка.
  const anchor = (id: string) => (home ? `#${id}` : `/${lang}#${id}`);
  const links = [
    { href: anchor("features"), label: t.features },
    { href: anchor("how"), label: t.how },
    { href: anchor("for"), label: t.useCases },
    { href: anchor("faq"), label: t.faq },
  ];
  const signIn = `${appUrl}/${lang}/login`;

  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled || open ? "bg-paper/95 shadow-[0_1px_0_rgba(22,52,26,0.08)] backdrop-blur-xl" : "bg-transparent",
      ].join(" ")}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-cream"
      >
        {t.skip}
      </a>
      <div className="container-x flex h-16 items-center justify-between gap-4 md:h-[72px]">
        <Link href={`/${lang}`} className="flex items-center gap-2.5 text-ink" aria-label="Horsteppe">
          <LogoMark className="h-8 w-8" />
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-[14.5px] font-medium text-ink-soft transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LangSwitch lang={lang} path={path} label={t.language} />
          <a href={signIn} className="text-[14.5px] font-medium text-ink-soft transition-colors hover:text-ink">
            {t.signIn}
          </a>
          <a
            href={anchor("access")}
            className="inline-flex items-center rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-cream transition hover:bg-moss"
          >
            {t.cta}
          </a>
        </div>

        <button
          type="button"
          className="-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-ink lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t.close : t.menu}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {open ? (
        <div id="mobile-menu" className="container-x h-[calc(100svh-4rem)] overflow-y-auto pb-10 lg:hidden">
          <nav aria-label="Mobile" className="flex flex-col border-t border-ink/10 pt-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="font-display border-b border-ink/8 py-4 text-[22px] font-semibold tracking-[-0.01em] text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 flex items-center justify-between">
            <LangSwitch lang={lang} path={path} label={t.language} />
            <a href={signIn} className="text-[15px] font-medium text-ink-soft">
              {t.signIn}
            </a>
          </div>
          <a
            href={anchor("access")}
            onClick={() => setOpen(false)}
            className="mt-6 flex w-full items-center justify-center rounded-full bg-ink px-6 py-4 text-[16px] font-semibold text-cream"
          >
            {t.cta}
          </a>
        </div>
      ) : null}
    </header>
  );
}
