"use client";

import { useState } from "react";
import { Emblem } from "../site/Brand.tsx";

const ERRORS: Record<string, string> = {
  wrong_password: "Неверный пароль.",
  too_many_attempts: "Слишком много неудачных попыток. Подождите 15 минут.",
  admin_not_configured: "На сервере не задан пароль администратора — переменная ADMIN_PASSWORD (не короче 8 символов).",
  forbidden: "Вход возможен только с этого сайта.",
  network: "Нет связи с сервером. Проверьте интернет.",
  unknown: "Не удалось войти. Попробуйте ещё раз.",
};

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.assign("/admin");
        return;
      }
      const body: { error?: string } = await res.json().catch(() => ({}));
      setError(ERRORS[body.error ?? "unknown"] ?? ERRORS.unknown);
    } catch {
      setError(ERRORS.network);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-[100svh] items-center justify-center px-5 py-10">
      <div aria-hidden className="hatch pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(60%_60%_at_50%_40%,#000,transparent)]" />
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-[0.5rem] border border-ink/15 bg-vellum p-7 shadow-[0_30px_60px_-40px_rgba(28,43,27,0.5)] sm:p-8">
        <Emblem className="h-auto w-20" sizes="80px" priority />
        <h1 className="mt-6 font-serif text-[2rem] font-semibold leading-tight text-pine">Заявки Horsteppe</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">Вход для администратора.</p>

        <label className="mt-7 block">
          <span className="text-[0.875rem] font-semibold text-pine">Пароль</span>
          <div className="relative mt-1.5">
            <input
              type={show ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field pr-24 text-base"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[0.1875rem] px-3 py-1.5 text-[0.8125rem] font-semibold text-ink-mute hover:text-ink"
              aria-pressed={show}
            >
              {show ? "Скрыть" : "Показать"}
            </button>
          </div>
        </label>

        {error ? (
          <p role="alert" className="mt-4 rounded-[0.25rem] border border-ember/40 bg-ember/[0.07] px-4 py-3 text-[0.875rem] text-ember">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !password}
          className="btn btn-primary mt-6 w-full"
        >
          {busy ? "Проверяем…" : "Войти"}
        </button>
      </form>
    </main>
  );
}
