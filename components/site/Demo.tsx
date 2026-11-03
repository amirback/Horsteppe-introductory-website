import type { SiteDict } from "../../lib/content/types.ts";
import { Emblem } from "./Brand.tsx";
import { CheckIcon } from "./Icons.tsx";

type CSS = React.CSSProperties;

/**
 * Таймлайн повторяет настоящую логику продукта: кадры по 2–5 секунд,
 * настоящее AI-видео — у ключевых кадров, остальное двигает камера.
 */
export const SHOTS = [
  { w: 13, real: true },
  { w: 9, real: false },
  { w: 11, real: false },
  { w: 15, real: true },
  { w: 10, real: false },
  { w: 12, real: true },
  { w: 9, real: false },
  { w: 21, real: true },
];

/** Кадр рекламы из примера — стальная бутылка — нарисованный, а не сгенерированный. */
function BottleScene() {
  return (
    <svg viewBox="0 0 90 160" className="demo-push absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="hs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c402b" />
          <stop offset="0.7" stopColor="#152216" />
        </linearGradient>
        <radialGradient id="hs-glow" cx="0.5" cy="0.62" r="0.5">
          <stop offset="0" stopColor="#eee1aa" stopOpacity="0.32" />
          <stop offset="1" stopColor="#eee1aa" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hs-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6e6030" />
          <stop offset="0.28" stopColor="#ddd2af" />
          <stop offset="0.55" stopColor="#b4a670" />
          <stop offset="1" stopColor="#4d4422" />
        </linearGradient>
      </defs>
      <rect width="90" height="160" fill="url(#hs-sky)" />
      <rect width="90" height="160" fill="url(#hs-glow)" />
      <rect y="118" width="90" height="42" fill="#121d13" />
      <path d="M0 118H90" stroke="#eee1aa" strokeOpacity="0.18" strokeWidth="0.6" />
      <ellipse cx="45" cy="121" rx="17" ry="2.6" fill="#000" fillOpacity="0.45" />
      <rect x="37" y="28" width="16" height="11" rx="2.5" fill="#1c2b1b" stroke="#eee1aa" strokeOpacity="0.35" strokeWidth="0.6" />
      <rect x="38.5" y="38" width="13" height="9" rx="2" fill="url(#hs-steel)" />
      <rect x="32.5" y="45" width="25" height="76" rx="7.5" fill="url(#hs-steel)" />
      <rect x="32.5" y="76" width="25" height="15" fill="#1c2b1b" fillOpacity="0.88" />
      <path d="M38 83.5H52" stroke="#eee1aa" strokeOpacity="0.7" strokeWidth="0.7" />
      <rect x="36" y="50" width="2" height="66" rx="1" fill="#fff" fillOpacity="0.32" />
      {[
        [18, 40], [70, 30], [74, 64], [14, 82], [24, 22], [64, 96], [80, 48], [10, 58],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill="#f2ecd8" fillOpacity="0.55" />
      ))}
    </svg>
  );
}

/**
 * Как Horsteppe собирает ролик — на одном экране и без видео-файла.
 * Анимация на CSS: работает без скриптов, а при «уменьшить движение»
 * застывает в законченном состоянии.
 */
export function Demo({ t }: { t: SiteDict["demo"] }) {
  return (
    <div
      className="on-dark relative overflow-hidden rounded-[0.5rem] border border-gold/15 bg-night text-cream shadow-[0_50px_100px_-60px_rgba(18,29,19,0.9)]"
      role="img"
      aria-label={`${t.label}: ${t.prompt}. ${t.steps.join(" → ")}. ${t.done}: ${t.file}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gold/12 px-4 py-3 sm:px-5" aria-hidden>
        <span className="flex min-w-0 items-center gap-2">
          <Emblem className="h-5 w-auto" sizes="32px" />
          <span className="font-serif text-[1.0625rem] font-semibold leading-none">Horsteppe</span>
        </span>
        <span className="hidden whitespace-nowrap font-mono text-[0.6875rem] text-cream-mute sm:block">{t.file}</span>
      </div>

      <div className="grid gap-px bg-gold/12 sm:grid-cols-[1.05fr_0.95fr]" aria-hidden>
        <div className="bg-night p-5 sm:p-6">
          <div className="eyebrow text-[0.625rem] text-cream-mute">{t.label}</div>
          <p className="caret mt-2.5 font-serif text-[1.25rem] leading-snug text-cream sm:text-[1.375rem]">{t.prompt}</p>
          <ol className="mt-6 grid gap-1.5 min-[400px]:grid-cols-2 sm:grid-cols-1">
            {t.steps.map((step, i) => (
              <li
                key={step}
                className="demo-step flex min-w-0 items-center justify-between gap-2 rounded-[0.1875rem] border px-2.5 py-2 text-[0.8125rem] sm:px-3"
                style={{ "--d": `${0.35 + i * 0.55}s` } as CSS}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="hidden font-mono text-[0.6875rem] opacity-60 sm:inline">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">{step}</span>
                </span>
                <span className="demo-check shrink-0 text-gold" style={{ "--d": `${0.35 + i * 0.55}s` } as CSS}>
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-center bg-night p-5 sm:p-6">
          <div className="relative aspect-[9/16] w-[8.5rem] overflow-hidden rounded-[0.875rem] border border-gold/25 bg-pine sm:w-[10rem] xl:w-[11rem]">
            <BottleScene />
            <div className="demo-caption absolute inset-x-2 bottom-7 text-center text-[0.6875rem] font-semibold leading-tight text-cream [text-shadow:0_1px_6px_rgba(0,0,0,0.7)] sm:text-[0.75rem]">
              {t.caption}
            </div>
            <div className="absolute inset-x-3 bottom-3 h-0.5 overflow-hidden rounded-full bg-cream/20">
              <div className="demo-progress h-full w-full bg-gold" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gold/12 p-5 sm:p-6" aria-hidden>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[0.6875rem] text-cream-mute">
          <span className="eyebrow text-[0.625rem]">{t.timeline}</span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[1px] bg-gold" /> {t.real}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[1px] bg-cream/30" /> {t.camera}
            </span>
          </span>
        </div>
        <div className="mt-3 flex h-10 gap-1">
          {SHOTS.map((shot, i) => (
            <span
              key={i}
              className={`demo-shot h-full rounded-[0.125rem] ${shot.real ? "demo-real" : "bg-cream/20"}`}
              style={{ flexGrow: shot.w, "--d": `${i * 0.12}s` } as CSS}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[0.625rem] text-cream-mute">
          <span>0:00</span>
          <span>0:15</span>
          <span>0:30</span>
        </div>
        <div className="demo-done mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[0.25rem] bg-gold px-4 py-3 text-pine">
          <span className="flex items-center gap-2.5 text-[0.875rem] font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pine text-gold">
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
            {t.done}
          </span>
          <span className="whitespace-nowrap font-mono text-[0.75rem] text-pine/75">{t.file}</span>
        </div>
      </div>
    </div>
  );
}
