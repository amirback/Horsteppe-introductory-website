"use client";

import { useEffect, useRef, useState } from "react";
import type { SiteDict } from "../../lib/content/types.ts";
import type { Lang } from "../../lib/i18n.ts";
import { USE_CASES, VOLUMES } from "../../lib/leads/schema.ts";
import { ArrowIcon, CheckIcon } from "./Icons.tsx";

type Form = SiteDict["access"]["form"];
type Field = "name" | "email" | "consent";
type Status = "idle" | "sending" | "done";

const UTM_KEY = "hs-utm";

/**
 * Откуда пришёл человек — первая метка рекламы за визит. Хранится в
 * sessionStorage, чтобы переход на страницу о данных и обратно её не терял.
 * Хранилище может быть недоступно (приватный режим) — тогда просто без меток.
 */
function firstTouch(): Record<string, string> {
  const fresh: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
      const value = params.get(key);
      if (value) fresh[key] = value.slice(0, 100);
    }
    if (document.referrer) {
      const ref = new URL(document.referrer);
      if (ref.host !== window.location.host) fresh.referrer = ref.href.slice(0, 300);
    }
    fresh.landing_path = window.location.pathname.slice(0, 200);
  } catch {
    // без меток
  }
  try {
    const saved = sessionStorage.getItem(UTM_KEY);
    if (saved) return { ...fresh, ...JSON.parse(saved) };
    sessionStorage.setItem(UTM_KEY, JSON.stringify(fresh));
  } catch {
    // без sessionStorage
  }
  return fresh;
}

export function LeadForm({ lang, t, privacyHref }: { lang: Lang; t: Form; privacyHref: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<Field | null>(null);
  const [sentTo, setSentTo] = useState("");
  const started = useRef(0);
  const source = useRef<Record<string, string>>({});
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    started.current = Date.now();
    source.current = firstTouch();
  }, []);

  useEffect(() => {
    if (status === "done") doneRef.current?.focus();
  }, [status]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    const data = new FormData(event.currentTarget);
    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      contact: String(data.get("contact") ?? "") || null,
      company: String(data.get("company") ?? "") || null,
      use_case: String(data.get("use_case") ?? "") || null,
      volume: String(data.get("volume") ?? "") || null,
      message: String(data.get("message") ?? "") || null,
      consent: data.get("consent") === "on",
      website: String(data.get("website") ?? ""),
      lang,
      started_at: started.current,
      ...source.current,
    };

    // Простые ошибки ловим сразу, не дожидаясь сервера.
    const local: Field | null = !payload.name.trim()
      ? "name"
      : !/^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/.test(payload.email.trim())
        ? "email"
        : !payload.consent
          ? "consent"
          : null;
    if (local) {
      setInvalid(local);
      setError(t.errors[local]);
      event.currentTarget.querySelector<HTMLElement>(`[name="${local}"]`)?.focus();
      return;
    }

    setStatus("sending");
    setError(null);
    setInvalid(null);
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: { ok?: boolean; error?: string; field?: string } = await response.json().catch(() => ({}));
      if (response.ok && body.ok) {
        setSentTo(payload.email.trim());
        setStatus("done");
        return;
      }
      setStatus("idle");
      if (body.error === "invalid" && (body.field === "name" || body.field === "email" || body.field === "consent")) {
        setInvalid(body.field);
        setError(t.errors[body.field]);
      } else if (body.error === "rate_limited") {
        setError(t.errors.rate_limited);
      } else if (body.error === "invalid") {
        setError(t.errors.invalid);
      } else {
        setError(t.errors.unavailable);
      }
    } catch {
      setStatus("idle");
      setError(t.errors.network);
    }
  }

  if (status === "done") {
    return (
      <div className="flex min-h-[420px] flex-col items-start justify-center" role="status">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest text-lime">
          <CheckIcon className="h-6 w-6" />
        </span>
        <h3 ref={doneRef} tabIndex={-1} className="font-display mt-6 text-[28px] font-bold tracking-[-0.02em] text-ink outline-none">
          {t.successTitle}
        </h3>
        <p className="mt-3 max-w-md text-[16px] leading-relaxed text-ink-soft">{t.successText.replace("{email}", sentTo)}</p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            started.current = Date.now();
          }}
          className="mt-8 text-[14.5px] font-semibold text-sage underline-offset-4 hover:underline"
        >
          {t.again}
        </button>
      </div>
    );
  }

  const input =
    "mt-1.5 w-full rounded-xl border bg-white/80 px-4 py-3 text-[15.5px] text-ink outline-none transition placeholder:text-ink-mute/60 focus:border-ink focus:bg-white";
  const ok = "border-ink/15";
  const bad = "border-ember";
  const label = "text-[14px] font-semibold text-ink";
  // Название поля слева, «необязательно» — справа в той же строке: так пометка не отрывается.
  const head = (text: string, isOptional = false) => (
    <span className="flex items-baseline justify-between gap-3">
      <span className={label}>{text}</span>
      {isOptional ? <span className="shrink-0 text-[12px] text-ink-mute">{t.optional}</span> : null}
    </span>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-busy={status === "sending"}>
      {/* Ловушка для ботов: человек её не видит и не заполняет. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          {head(t.name)}
          <input
            name="name" required maxLength={100} autoComplete="name"
            aria-invalid={invalid === "name" || undefined}
            className={`${input} ${invalid === "name" ? bad : ok}`}
          />
        </label>
        <label className="block">
          {head(t.email)}
          <input
            name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email"
            aria-invalid={invalid === "email" || undefined}
            className={`${input} ${invalid === "email" ? bad : ok}`}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          {head(t.contact, true)}
          <input name="contact" maxLength={100} autoComplete="tel" placeholder={t.contactHint} className={`${input} ${ok}`} />
        </label>
        <label className="block">
          {head(t.company, true)}
          <input name="company" maxLength={120} autoComplete="organization" className={`${input} ${ok}`} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          {head(t.useCase, true)}
          <select name="use_case" defaultValue="" className={`${input} ${ok}`}>
            <option value="">{t.choose}</option>
            {USE_CASES.map((value) => (
              <option key={value} value={value}>
                {t.useCaseOptions[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          {head(t.volume, true)}
          <select name="volume" defaultValue="" className={`${input} ${ok}`}>
            <option value="">{t.choose}</option>
            {VOLUMES.map((value) => (
              <option key={value} value={value}>
                {t.volumeOptions[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        {head(t.message, true)}
        <textarea name="message" rows={3} maxLength={1500} placeholder={t.messagePlaceholder} className={`${input} ${ok} resize-y`} />
      </label>

      <label className="flex items-start gap-3 text-[14px] leading-snug text-ink-soft">
        <input
          name="consent" type="checkbox"
          aria-invalid={invalid === "consent" || undefined}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ink)]"
        />
        <span>
          {t.consentBefore}{" "}
          <a href={privacyHref} className="font-semibold text-ink underline underline-offset-4 hover:text-sage">
            {t.consentLink}
          </a>
          {t.consentAfter}
        </span>
      </label>

      {error ? (
        <p role="alert" className="rounded-xl border border-ember/40 bg-ember/8 px-4 py-3 text-[14.5px] text-ember">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "sending"}
        className="group mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-[16px] font-semibold text-cream transition hover:bg-moss disabled:opacity-70"
      >
        {status === "sending" ? t.sending : t.submit}
        {status === "sending" ? null : <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
    </form>
  );
}
