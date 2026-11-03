import type { SiteDict } from "../../lib/content/types.ts";
import { Demo } from "./Demo.tsx";
import { ArrowIcon, CheckIcon, DashIcon, FeatureGlyph, PlusIcon } from "./Icons.tsx";

type CSS = React.CSSProperties;

function SectionHead({ kicker, title, sub, tone = "light", center = false }: {
  kicker: string; title: string; sub?: string; tone?: "light" | "dark"; center?: boolean;
}) {
  const dark = tone === "dark";
  return (
    <div className={`reveal max-w-3xl ${center ? "mx-auto text-center" : ""}`}>
      <div className={`kicker ${dark ? "text-lime" : "text-sage"}`}>{kicker}</div>
      <h2
        className={`font-display mt-3 text-balance font-bold leading-[1.08] tracking-[-0.03em] [font-size:clamp(28px,4.2vw,46px)] ${
          dark ? "text-cream" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {sub ? <p className={`mt-4 text-pretty text-[16.5px] leading-relaxed ${dark ? "text-cream/70" : "text-ink-soft"}`}>{sub}</p> : null}
    </div>
  );
}

export function Hero({ t, demo }: { t: SiteDict["hero"]; demo: SiteDict["demo"] }) {
  return (
    <section className="glow relative isolate overflow-hidden pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="grain pointer-events-none absolute inset-0 -z-10 opacity-60" aria-hidden />
      <div className="container-x grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div>
          <div className="rise kicker inline-flex items-center gap-2 rounded-full border border-ink/12 bg-card/70 px-3 py-1.5 text-sage">
            <span className="h-1.5 w-1.5 rounded-full bg-olive" aria-hidden />
            {t.kicker}
          </div>
          <h1
            className="rise font-display mt-5 text-balance font-bold leading-[1.04] tracking-[-0.035em] text-ink [font-size:clamp(36px,4.5vw,58px)]"
            style={{ "--d": "0.08s" } as CSS}
          >
            {t.title}
          </h1>
          <p className="rise mt-5 max-w-[54ch] text-pretty text-[17px] leading-relaxed text-ink-soft md:text-[18.5px]" style={{ "--d": "0.18s" } as CSS}>
            {t.sub}
          </p>
          <div className="rise mt-8 flex flex-wrap items-center gap-3" style={{ "--d": "0.28s" } as CSS}>
            <a
              href="#access"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-[15.5px] font-semibold text-cream shadow-[0_14px_30px_-14px_rgba(22,52,26,0.7)] transition hover:bg-moss sm:w-auto"
            >
              {t.primary}
              <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a href="#how" className="inline-flex w-full items-center justify-center rounded-full border border-ink/20 px-6 py-4 text-[15.5px] font-semibold text-ink transition hover:border-ink/50 sm:w-auto">
              {t.secondary}
            </a>
          </div>
          <ul className="rise mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[13.5px] text-ink-mute" style={{ "--d": "0.38s" } as CSS}>
            {t.proof.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-sage" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rise lg:pl-4" style={{ "--d": "0.22s" } as CSS}>
          <Demo t={demo} />
        </div>
      </div>
    </section>
  );
}

export function Contrast({ t }: { t: SiteDict["contrast"] }) {
  return (
    <section className="container-x py-20 md:py-28">
      <SectionHead kicker={t.kicker} title={t.title} sub={t.sub} />
      <div className="mt-12 grid gap-4 md:grid-cols-2 md:gap-5">
        <div className="reveal rounded-[28px] border border-ink/10 bg-card p-7 md:p-9">
          <div className="text-[15px] font-semibold text-ink-mute">{t.them.label}</div>
          <ul className="mt-6 space-y-4">
            {t.them.items.map((item) => (
              <li key={item} className="flex gap-3 text-[16px] leading-snug text-ink-soft">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink/6 text-ink-mute">
                  <DashIcon className="h-3.5 w-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="reveal rounded-[28px] bg-forest p-7 text-cream md:p-9" style={{ "--d": "0.1s" } as CSS}>
          <div className="font-display text-[15px] font-bold text-lime">{t.us.label}</div>
          <ul className="mt-6 space-y-4">
            {t.us.items.map((item) => (
              <li key={item} className="flex gap-3 text-[16px] leading-snug text-cream/90">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lime text-forest">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function HowItWorks({ t }: { t: SiteDict["how"] }) {
  return (
    <section id="how" className="border-y border-ink/8 bg-card/60 py-20 md:py-28">
      <div className="container-x">
        <SectionHead kicker={t.kicker} title={t.title} />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {t.steps.map((step, i) => (
            <li
              key={step.title}
              className="reveal relative rounded-[24px] border border-ink/10 bg-paper p-6"
              style={{ "--d": `${i * 0.08}s` } as CSS}
            >
              <div className="font-display text-[13px] font-bold text-sage">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="font-display mt-4 text-[19px] font-bold leading-tight tracking-[-0.01em] text-ink">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Features({ t }: { t: SiteDict["features"] }) {
  return (
    <section id="features" className="container-x py-20 md:py-28">
      <SectionHead kicker={t.kicker} title={t.title} sub={t.sub} />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.items.map((f, i) => (
          <article
            key={f.title}
            className="reveal group rounded-[24px] border border-ink/10 bg-card p-6 transition-colors hover:border-ink/25"
            style={{ "--d": `${(i % 4) * 0.06}s` } as CSS}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink text-lime">
              <FeatureGlyph name={f.icon} className="h-[22px] w-[22px]" />
            </div>
            <h3 className="font-display mt-5 text-[17.5px] font-bold leading-snug tracking-[-0.01em] text-ink">{f.title}</h3>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">{f.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function UseCases({ t, lang }: { t: SiteDict["useCases"]; lang: string }) {
  const [open, close] = lang === "en" ? ["“", "”"] : ["«", "»"];
  return (
    <section id="for" className="bg-forest py-20 text-cream md:py-28">
      <div className="container-x">
        <SectionHead kicker={t.kicker} title={t.title} tone="dark" />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {t.items.map((u, i) => (
            <article
              key={u.title}
              className="reveal flex flex-col rounded-[24px] border border-cream/10 bg-forest-2 p-7"
              style={{ "--d": `${(i % 2) * 0.08}s` } as CSS}
            >
              <h3 className="font-display text-[20px] font-bold tracking-[-0.01em] text-cream">{u.title}</h3>
              <p className="mt-2.5 text-[15.5px] leading-relaxed text-cream/70">{u.text}</p>
              <div className="mt-6 rounded-2xl border border-cream/10 bg-forest px-4 py-3">
                <div className="kicker text-[10.5px] text-lime/80">{t.exampleLabel}</div>
                <p className="mt-1.5 text-[14.5px] leading-snug text-cream/90">
                  {open}
                  {u.example}
                  {close}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Faq({ t, email }: { t: SiteDict["faq"]; email: string }) {
  return (
    <section id="faq" className="container-x py-20 md:py-28">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <SectionHead kicker={t.kicker} title={t.title} />
          <p className="reveal mt-5 text-[15.5px] leading-relaxed text-ink-soft">
            {t.more}{" "}
            <a href={`mailto:${email}`} className="font-semibold text-ink underline underline-offset-4 hover:text-sage">
              {email}
            </a>
          </p>
        </div>
        <div className="reveal divide-y divide-ink/10 border-y border-ink/10">
          {t.items.map((item) => (
            <details key={item.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-left text-[16.5px] font-semibold text-ink">
                {item.q}
                <PlusIcon className="h-5 w-5 shrink-0 text-sage transition-transform duration-300 group-open:rotate-45" />
              </summary>
              <p className="pb-5 pr-10 text-[15.5px] leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ t }: { t: SiteDict["final"] }) {
  return (
    <section className="container-x pb-20 md:pb-28">
      <div className="reveal glow relative overflow-hidden rounded-[32px] border border-ink/10 bg-card px-7 py-14 text-center md:px-14 md:py-20">
        <h2 className="font-display mx-auto max-w-2xl text-balance font-bold leading-[1.08] tracking-[-0.03em] text-ink [font-size:clamp(28px,4vw,44px)]">
          {t.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16.5px] leading-relaxed text-ink-soft">{t.sub}</p>
        <a
          href="#access"
          className="group mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 text-[15.5px] font-semibold text-cream transition hover:bg-moss"
        >
          {t.cta}
          <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </section>
  );
}
