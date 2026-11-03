import Image from "next/image";
import artwork from "../../public/brand/artwork.jpg";
import type { FeatureIcon, SiteDict } from "../../lib/content/types.ts";
import { Emblem } from "./Brand.tsx";
import { Demo, SHOTS } from "./Demo.tsx";
import { ArrowIcon, CheckIcon, DashIcon, FeatureGlyph, PlusIcon } from "./Icons.tsx";

type CSS = React.CSSProperties;
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Шапка раздела в духе журнальной вёрстки: слева номер и рубрика, справа
 * крупный заголовок. На телефоне — одно под другим.
 */
function SectionHead({ index, kicker, title, sub, tone = "light" }: {
  index: number; kicker: string; title: string; sub?: string; tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div className="reveal grid gap-5 xl:grid-cols-12 xl:gap-10">
      <p className={`eyebrow flex items-center gap-3 self-start xl:col-span-3 xl:pt-4 ${dark ? "text-gold" : "text-brass"}`}>
        <span className="tabular-nums">{pad2(index)}</span>
        <span className="h-px w-8 bg-current opacity-40" aria-hidden />
        <span>{kicker}</span>
      </p>
      <div className="xl:col-span-9">
        <h2 className={`display [font-size:clamp(2rem,1.2rem+2.7vw,3.375rem)] ${dark ? "text-cream" : "text-pine"}`}>{title}</h2>
        {sub ? (
          <p className={`mt-5 max-w-2xl text-pretty text-[1.0625rem] leading-relaxed ${dark ? "text-cream-soft" : "text-ink-soft"}`}>{sub}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Заголовок первого экрана: выделенная часть — курсивом и золотом. */
function AccentTitle({ title, accent }: { title: string; accent: string }) {
  const at = title.indexOf(accent);
  if (at < 0) return <>{title}</>;
  return (
    <>
      {title.slice(0, at)}
      <em className="font-medium text-brass">{accent}</em>
      {title.slice(at + accent.length)}
    </>
  );
}

export function Hero({ t, demo }: { t: SiteDict["hero"]; demo: SiteDict["demo"] }) {
  return (
    <section className="relative isolate overflow-hidden pb-16 pt-28 sm:pt-32 md:pb-20 md:pt-36 xl:pb-24">
      <div
        aria-hidden
        className="hatch pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(65%_60%_at_88%_18%,#000_0%,transparent_72%)]"
      />
      <div className="shell grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <p className="rise eyebrow flex items-center gap-3 text-brass">
            <span className="h-px w-8 bg-current opacity-50" aria-hidden />
            {t.kicker}
          </p>
          <h1
            className="rise display mt-6 text-pine [font-size:clamp(2.5rem,1.3rem+4.1vw,4.75rem)]"
            style={{ "--d": "0.08s" } as CSS}
          >
            <AccentTitle title={t.title} accent={t.accent} />
          </h1>
          <p className="rise mt-6 max-w-[36rem] text-pretty text-[1.0625rem] leading-relaxed text-ink-soft md:text-[1.1875rem]" style={{ "--d": "0.18s" } as CSS}>
            {t.sub}
          </p>
          <div className="rise mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" style={{ "--d": "0.28s" } as CSS}>
            <a href="#access" className="btn btn-primary min-h-[3.25rem] px-6 text-base">
              {t.primary}
              <ArrowIcon className="arrow h-4 w-4" />
            </a>
            <a href="#how" className="btn btn-line min-h-[3.25rem] px-6 text-base">
              {t.secondary}
            </a>
          </div>
          <ul className="rise mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-ink-mute" style={{ "--d": "0.38s" } as CSS}>
            {t.proof.map((p, i) => (
              <li key={p} className="flex items-center gap-5">
                {i > 0 ? <span className="hidden h-3.5 w-px bg-pine/20 sm:block" aria-hidden /> : null}
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rise lg:col-span-5" style={{ "--d": "0.2s" } as CSS}>
          <figure className="relative mx-auto w-full max-w-[24rem] sm:max-w-[30rem] lg:max-w-none">
            {/* Логотип в паспарту: внешняя рамка, поле, тонкая золотая линия. */}
            <div className="rounded-[0.375rem] border border-pine/15 bg-vellum p-2.5 shadow-[0_40px_80px_-50px_rgba(28,43,27,0.6)] sm:p-3">
              <div className="overflow-hidden rounded-[0.1875rem] ring-1 ring-brass/30">
                <Image
                  src={artwork}
                  alt=""
                  priority
                  placeholder="blur"
                  sizes="(min-width: 1280px) 30rem, (min-width: 1024px) 38vw, (min-width: 640px) 30rem, 90vw"
                  className="drift h-auto w-full"
                />
              </div>
            </div>
            {/* Карточка готового файла — то, чем заканчивается каждый заказ. */}
            <div className="on-dark absolute -bottom-6 left-3 flex items-center gap-3 rounded-[0.25rem] border border-gold/20 bg-night px-4 py-3 text-cream shadow-[0_24px_40px_-24px_rgba(18,29,19,0.9)] sm:-left-5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-pine">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-semibold leading-tight">{demo.done}</span>
                <span className="block whitespace-nowrap font-mono text-[0.6875rem] leading-tight text-cream-soft">{demo.file}</span>
              </span>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}

export function Stats({ t }: { t: SiteDict["stats"] }) {
  // 2 × 2 на телефоне, 4 в ряд на ноутбуке: линии и поля переставляются вместе с сеткой,
  // крайние колонки прижаты к краю содержимого.
  const cells = [
    "pr-4 sm:pr-6",
    "border-l pl-4 sm:pl-6 lg:pr-6",
    "border-t pr-4 sm:pr-6 lg:border-l lg:border-t-0 lg:pl-6",
    "border-l border-t pl-4 sm:pl-6 lg:border-t-0",
  ];
  return (
    <section aria-label={t.label} className="shell">
      <dl className="grid grid-cols-2 border-y border-pine/15 lg:grid-cols-4">
        {t.items.map((s, i) => (
          <div
            key={s.value}
            className={`reveal flex flex-col border-pine/15 py-7 sm:py-9 ${cells[i] ?? ""}`}
            style={{ "--d": `${i * 0.06}s` } as CSS}
          >
            <dt className="order-2 mt-3 max-w-[16rem] text-pretty text-[0.875rem] leading-snug text-ink-mute">{s.text}</dt>
            <dd className="order-1 font-serif font-medium leading-none text-pine [font-size:clamp(2.5rem,1.7rem+2.6vw,4.25rem)] [font-variant-numeric:lining-nums]">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function HowItWorks({ t, demo }: { t: SiteDict["how"]; demo: SiteDict["demo"] }) {
  return (
    <section id="how" className="py-20 md:py-28">
      <div className="shell">
        <SectionHead index={1} kicker={t.kicker} title={t.title} />
        <div className="mt-12 grid gap-12 lg:mt-16 lg:grid-cols-12 lg:gap-10">
          <ol className="lg:col-span-5">
            {t.steps.map((step, i) => (
              <li
                key={step.title}
                className="reveal grid grid-cols-[2.75rem_1fr] gap-x-3 border-t border-pine/15 py-6 last:border-b sm:grid-cols-[3.5rem_1fr] sm:py-7"
                style={{ "--d": `${i * 0.06}s` } as CSS}
              >
                <span className="font-serif text-[1.625rem] leading-none text-brass">{ROMAN[i]}</span>
                <div>
                  <h3 className="font-serif text-[1.375rem] font-semibold leading-tight text-pine sm:text-[1.5rem]">{step.title}</h3>
                  <p className="mt-2 text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="lg:col-span-7">
            <div className="reveal lg:sticky lg:top-28" style={{ "--d": "0.1s" } as CSS}>
              <Demo t={demo} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Contrast({ t }: { t: SiteDict["contrast"] }) {
  return (
    <section className="border-y border-pine/10 bg-vellum py-20 md:py-28">
      <div className="shell">
        <SectionHead index={2} kicker={t.kicker} title={t.title} sub={t.sub} />
        <div className="reveal mt-12 lg:mt-16 lg:grid lg:grid-cols-12 lg:gap-10">
          <table className="w-full table-fixed border-collapse text-left lg:col-span-12 xl:col-span-9 xl:col-start-4">
            <caption className="sr-only">{t.title}</caption>
            <thead>
              <tr className="border-b border-pine/20">
                <th scope="col" className="eyebrow pb-4 pr-3 align-bottom text-[0.6875rem] font-semibold text-ink-mute sm:pr-6">
                  {t.them.label}
                </th>
                <th scope="col" className="bg-sand/45 px-3 pb-4 pt-5 align-bottom sm:px-6">
                  <span className="eyebrow flex items-center gap-2 text-[0.6875rem] text-pine">
                    <Emblem className="h-5 w-auto" sizes="32px" />
                    {t.us.label}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {t.them.items.map((them, i) => (
                <tr key={them} className="border-b border-pine/12 align-top">
                  <td className="py-5 pr-3 sm:py-6 sm:pr-6">
                    <span className="flex flex-col gap-2 text-[0.875rem] leading-snug text-ink-mute sm:flex-row sm:gap-3 sm:text-[0.9375rem]">
                      <DashIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute/70" />
                      {them}
                    </span>
                  </td>
                  <td className="bg-sand/45 px-3 py-5 sm:px-6 sm:py-6">
                    <span className="flex flex-col gap-2 text-[0.9375rem] font-medium leading-snug text-pine sm:flex-row sm:gap-3 sm:text-[1rem]">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
                      {t.us.items[i]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** Мини-таймлайн внутри карточки «Настоящее AI-видео». */
function MotionStrip({ real, camera }: { real: string; camera: string }) {
  return (
    <div className="mt-8" aria-hidden>
      <div className="flex h-10 gap-1">
        {SHOTS.map((shot, i) => (
          <span key={i} className={`h-full rounded-[0.125rem] ${shot.real ? "demo-real" : "bg-sand"}`} style={{ flexGrow: shot.w }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem] text-ink-mute">
        <span className="flex items-center gap-2"><span className="h-2 w-3 rounded-[1px] bg-steppe" />{real}</span>
        <span className="flex items-center gap-2"><span className="h-2 w-3 rounded-[1px] bg-sand" />{camera}</span>
      </div>
    </div>
  );
}

/** Три рамки форматов в масштабе — внутри карточки «Форматы соцсетей». */
function FormatFrames() {
  const frames = [
    { ratio: "9:16", className: "h-24 w-[3.375rem]" },
    { ratio: "1:1", className: "h-[4.5rem] w-[4.5rem]" },
    { ratio: "16:9", className: "h-[4.5rem] w-32" },
  ];
  return (
    <div className="mt-8 flex flex-wrap items-end gap-5" aria-hidden>
      {frames.map((f) => (
        <div key={f.ratio} className="flex flex-col items-center gap-2">
          <span className={`rounded-[0.1875rem] border border-pine/30 bg-[linear-gradient(160deg,var(--color-sand),transparent)] ${f.className}`} />
          <span className="font-mono text-[0.6875rem] text-ink-mute">{f.ratio}</span>
        </div>
      ))}
    </div>
  );
}

const WIDE: Partial<Record<FeatureIcon, string>> = {
  motion: "order-first sm:col-span-2",
  formats: "sm:col-span-2",
  quality: "lg:col-span-2",
  honest: "lg:col-span-2",
};

export function Features({ t, demo }: { t: SiteDict["features"]; demo: SiteDict["demo"] }) {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="shell">
        <SectionHead index={3} kicker={t.kicker} title={t.title} sub={t.sub} />
        {/* Сетка с волосяными линиями: промежуток 1 px поверх цвета линии. */}
        <div className="mt-12 grid gap-px border border-pine/15 bg-pine/15 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {t.items.map((f, i) => (
            <article
              key={f.title}
              className={`reveal flex flex-col bg-parchment p-6 sm:p-8 ${WIDE[f.icon] ?? ""}`}
              style={{ "--d": `${(i % 4) * 0.05}s` } as CSS}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[0.25rem] border border-brass/35 text-brass">
                <FeatureGlyph name={f.icon} className="h-5 w-5" />
              </span>
              <h3 className="mt-6 font-serif text-[1.375rem] font-semibold leading-tight text-pine sm:text-[1.5rem]">{f.title}</h3>
              <p className="mt-3 max-w-[38rem] text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">{f.text}</p>
              {f.icon === "motion" ? <MotionStrip real={demo.real} camera={demo.camera} /> : null}
              {f.icon === "formats" ? <FormatFrames /> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function UseCases({ t, lang }: { t: SiteDict["useCases"]; lang: string }) {
  const [open, close] = lang === "en" ? ["“", "”"] : ["«", "»"];
  return (
    <section id="for" className="on-dark relative isolate overflow-hidden bg-night py-20 text-cream md:py-28">
      <div aria-hidden className="hatch-dark pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,#000,transparent_75%)]" />
      <div className="shell">
        <SectionHead index={4} kicker={t.kicker} title={t.title} tone="dark" />
        <div className="mt-12 grid gap-px border border-gold/15 bg-gold/15 md:grid-cols-2 lg:mt-16">
          {t.items.map((u, i) => (
            <article key={u.title} className="reveal flex flex-col bg-night p-6 sm:p-9" style={{ "--d": `${(i % 2) * 0.08}s` } as CSS}>
              <span className="font-serif text-[1.25rem] leading-none text-gold/75">{ROMAN[i]}</span>
              <h3 className="mt-6 font-serif text-[1.625rem] font-semibold leading-tight text-cream sm:text-[1.875rem]">{u.title}</h3>
              <p className="mt-3 text-pretty text-[0.9375rem] leading-relaxed text-cream-soft">{u.text}</p>
              <div className="mt-auto pt-8">
                <div className="border-l border-gold/40 pl-4">
                  <div className="eyebrow text-[0.625rem] text-cream-mute">{t.exampleLabel}</div>
                  <p className="mt-1.5 font-serif text-[1.1875rem] italic leading-snug text-gold">
                    {open}
                    {u.example}
                    {close}
                  </p>
                </div>
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
    <section id="faq" className="py-20 md:py-28">
      <div className="shell grid gap-10 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <div className="reveal lg:sticky lg:top-28">
            <p className="eyebrow flex items-center gap-3 text-brass">
              <span className="tabular-nums">06</span>
              <span className="h-px w-8 bg-current opacity-40" aria-hidden />
              <span>{t.kicker}</span>
            </p>
            <h2 className="display mt-5 text-pine [font-size:clamp(2rem,1.2rem+2.7vw,3.25rem)]">{t.title}</h2>
            <p className="mt-6 max-w-sm text-pretty text-[0.9375rem] leading-relaxed text-ink-soft">
              {t.more}{" "}
              <a href={`mailto:${email}`} className="link-line font-semibold text-pine">
                {email}
              </a>
            </p>
          </div>
        </div>
        <div className="reveal border-t border-pine/15 lg:col-span-8">
          {t.items.map((item, i) => (
            <details key={item.q} className="group border-b border-pine/15">
              <summary className="flex cursor-pointer list-none items-start gap-3 py-5 sm:gap-5 sm:py-6">
                <span className="mt-1.5 w-7 shrink-0 font-mono text-[0.75rem] tabular-nums text-brass">{pad2(i + 1)}</span>
                <span className="min-w-0 flex-1 font-serif text-[1.25rem] font-semibold leading-snug text-pine sm:text-[1.375rem]">{item.q}</span>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-pine/20 text-pine transition duration-300 group-open:rotate-45 group-open:border-pine group-open:bg-pine group-open:text-parchment">
                  <PlusIcon className="h-4 w-4" />
                </span>
              </summary>
              <p className="pb-6 pl-10 pr-2 text-pretty text-[0.9375rem] leading-relaxed text-ink-soft sm:pl-12 sm:pr-14">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta({ t }: { t: SiteDict["final"] }) {
  return (
    <section className="on-dark relative isolate overflow-hidden bg-night text-cream">
      <div aria-hidden className="hatch-dark pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_75%_at_50%_100%,#000,transparent)]" />
      <div className="shell flex flex-col items-center py-20 text-center md:py-28">
        <Emblem className="reveal h-auto w-40 sm:w-52" sizes="(min-width: 640px) 208px, 160px" />
        <h2 className="reveal display mt-8 max-w-3xl text-cream [font-size:clamp(2.125rem,1.3rem+3vw,3.875rem)]">{t.title}</h2>
        <p className="reveal mt-5 max-w-xl text-pretty text-[1.0625rem] leading-relaxed text-cream-soft">{t.sub}</p>
        <a href="#access" className="reveal btn btn-gold mt-9 min-h-[3.25rem] px-7 text-base">
          {t.cta}
          <ArrowIcon className="arrow h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
