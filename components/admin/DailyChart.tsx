"use client";

import { useState } from "react";

export type Day = { key: string; label: string; long: string; count: number };

/** 1 заявка, 2 заявки, 5 заявок. */
export function leadsWord(n: number): string {
  const tail = n % 100;
  const last = n % 10;
  if (tail >= 11 && tail <= 14) return "заявок";
  if (last === 1) return "заявка";
  if (last >= 2 && last <= 4) return "заявки";
  return "заявок";
}

/** Верх шкалы — круглое число: 1, 2, 5, 10, 20, 50… */
function niceMax(max: number): number {
  if (max <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 5, 10]) if (step * power >= max) return step * power;
  return 10 * power;
}

/**
 * Заявки по дням — один ряд, поэтому без легенды: заголовок говорит, что
 * нарисовано. Цвет столбца — sage бренда, проверен скриптом палитры на фоне
 * карточки (#fbfaf1): светлота, насыщенность и контраст 3:1 проходят.
 *
 * Столбец не шире 16 px и растёт от общей базы, скругление — только сверху.
 * Значение — в подсказке при наведении и при фокусе (стрелки ← →), а все
 * значения целиком — в таблице под графиком.
 */
export function DailyChart({ days, title }: { days: Day[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...days.map((d) => d.count)));
  const ticks = max <= 2 ? [0, max] : [0, max / 2, max];
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const current = active === null ? null : days[active];

  function onKeyDown(event: React.KeyboardEvent) {
    const last = days.length - 1;
    const at = active ?? last;
    const next =
      event.key === "ArrowLeft" ? Math.max(0, at - 1)
        : event.key === "ArrowRight" ? Math.min(last, at + 1)
          : event.key === "Home" ? 0
            : event.key === "End" ? last
              : null;
    if (event.key === "Escape") setActive(null);
    if (next !== null) {
      event.preventDefault();
      setActive(next);
    }
  }

  return (
    <figure className="rounded-[22px] border border-ink/10 bg-card p-5 sm:p-6">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold text-ink">{title}</span>
        <span className="text-[13px] text-ink-mute">
          {total} {leadsWord(total)}
        </span>
      </figcaption>

      <div className="relative mt-5 h-44 pl-8">
        {ticks.map((tick) => (
          <div
            key={tick}
            className="pointer-events-none absolute left-8 right-0 border-t border-ink/8"
            style={{ bottom: `${(tick / max) * 100}%` }}
            aria-hidden
          >
            <span className="absolute -left-8 -top-2 w-6 text-right text-[11px] tabular-nums text-ink-mute">{tick}</span>
          </div>
        ))}

        <div
          role="group"
          tabIndex={0}
          aria-label={`${title}. Стрелки влево и вправо — по дням.`}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
          className="relative flex h-full items-end gap-[2px] rounded-md outline-offset-4"
        >
          {days.map((day, i) => (
            <div
              key={day.key}
              className="flex h-full min-w-0 flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setActive(i)}
            >
              {day.count > 0 ? (
                <div
                  className="w-full max-w-4 rounded-t-[4px] transition-[background-color] duration-150"
                  style={{
                    height: `${(day.count / max) * 100}%`,
                    backgroundColor: active === i ? "#86a45a" : "#6d8c3e",
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>

        {current ? (
          <div
            className="pointer-events-none absolute -top-3 z-10 -translate-x-1/2 rounded-xl border border-ink/10 bg-white px-3 py-2 shadow-[0_10px_24px_-12px_rgba(22,52,26,0.35)]"
            style={{ left: `calc(2rem + (100% - 2rem) * ${(active! + 0.5) / days.length})` }}
            role="status"
          >
            <div className="text-[15px] font-semibold tabular-nums text-ink">
              {current.count} {leadsWord(current.count)}
            </div>
            <div className="text-[12px] text-ink-mute">{current.long}</div>
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex justify-between pl-8 text-[11.5px] text-ink-mute" aria-hidden>
        <span>{days[0]?.label}</span>
        <span>{days[Math.floor(days.length / 2)]?.label}</span>
        <span>{days[days.length - 1]?.label}</span>
      </div>

      <details className="mt-4 text-[13px]">
        <summary className="cursor-pointer text-ink-mute hover:text-ink">Таблица по дням</summary>
        <table className="mt-3 w-full text-left">
          <thead>
            <tr className="text-ink-mute">
              <th className="py-1 font-medium">День</th>
              <th className="py-1 text-right font-medium">Заявок</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((day) => (
              <tr key={day.key} className="border-t border-ink/8">
                <td className="py-1.5 text-ink-soft">{day.long}</td>
                <td className="py-1.5 text-right tabular-nums text-ink">{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
