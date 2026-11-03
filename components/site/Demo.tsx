import type { SiteDict } from "../../lib/content/types.ts";
import { CheckIcon } from "./Icons.tsx";

/**
 * Как Horsteppe собирает ролик — на одном экране и без видео-файла.
 * Анимация на CSS: работает без скриптов, а при «уменьшить движение»
 * застывает в законченном состоянии.
 *
 * Таймлайн повторяет настоящую логику продукта: кадры по 2–5 секунд,
 * настоящее AI-видео — у ключевых кадров, остальное двигает камера.
 */
const SHOTS = [
  { w: 13, real: true },
  { w: 9, real: false },
  { w: 11, real: false },
  { w: 15, real: true },
  { w: 10, real: false },
  { w: 12, real: true },
  { w: 9, real: false },
  { w: 21, real: true },
];

export function Demo({ t }: { t: SiteDict["demo"] }) {
  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-forest p-5 text-cream shadow-[0_40px_80px_-40px_rgba(14,42,16,0.55)] sm:p-6"
      role="img"
      aria-label={`${t.label}: ${t.prompt}. ${t.steps.join(" → ")}. ${t.done}: ${t.file}`}
    >
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-lime/15 blur-3xl" aria-hidden />

      <div className="flex items-center gap-1.5" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-cream/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-cream/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-cream/20" />
      </div>

      <div className="mt-5" aria-hidden>
        <div className="kicker text-[10.5px] text-cream/50">{t.label}</div>
        <p className="caret mt-2 text-[15px] leading-relaxed text-cream/90 sm:text-[16px]">{t.prompt}</p>
      </div>

      <ol className="mt-5 grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-hidden>
        {t.steps.map((step, i) => (
          <li
            key={step}
            className="demo-step flex items-center justify-between gap-1.5 rounded-xl border px-2.5 py-2 text-[12px] font-medium"
            style={{ "--d": `${0.35 + i * 0.55}s` } as React.CSSProperties}
          >
            <span className="truncate">{step}</span>
            <span className="demo-check text-lime" style={{ "--d": `${0.35 + i * 0.55}s` } as React.CSSProperties}>
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6" aria-hidden>
        <div className="flex items-center justify-between text-[11.5px] text-cream/55">
          <span className="kicker text-[10.5px]">{t.timeline}</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-lime" /> {t.real}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-cream/30" /> {t.camera}
            </span>
          </span>
        </div>
        <div className="mt-2.5 flex h-11 gap-1">
          {SHOTS.map((shot, i) => (
            <span
              key={i}
              className={`demo-shot h-full rounded-md ${shot.real ? "demo-real" : "bg-cream/20"}`}
              style={{ flexGrow: shot.w, "--d": `${i * 0.12}s` } as React.CSSProperties}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-cream/35">
          <span>0:00</span>
          <span>0:15</span>
          <span>0:30</span>
        </div>
      </div>

      <div className="demo-done mt-5 flex items-center justify-between rounded-2xl bg-cream px-4 py-3 text-forest" aria-hidden>
        <span className="flex items-center gap-2 text-[14px] font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-lime">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          {t.done}
        </span>
        <span className="font-mono text-[12px] text-forest/70">{t.file}</span>
      </div>
    </div>
  );
}
