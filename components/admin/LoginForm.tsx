"use client";

import { useState } from "react";
import { LogoMark } from "../site/Logo.tsx";

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
    <main className="glow flex min-h-[100svh] items-center justify-center px-5">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-[28px] border border-ink/10 bg-card p-7 shadow-[0_30px_60px_-40px_rgba(22,52,26,0.5)] sm:p-8">
        <LogoMark className="h-10 w-10" />
        <h1 className="font-display mt-6 text-[26px] font-bold tracking-[-0.02em] text-ink">Заявки Horsteppe</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-ink-soft">Вход для администратора.</p>

        <label className="mt-7 block">
          <span className="text-[14px] font-semibold text-ink">Пароль</span>
          <div className="relative mt-1.5">
            <input
              type={show ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-white/80 px-4 py-3 pr-24 text-[15.5px] text-ink outline-none focus:border-ink focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink"
              aria-pressed={show}
            >
              {show ? "Скрыть" : "Показать"}
            </button>
          </div>
        </label>

        {error ? (
          <p role="alert" className="mt-4 rounded-xl border border-ember/40 bg-ember/8 px-4 py-3 text-[14px] text-ember">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-6 w-full rounded-full bg-ink px-6 py-3.5 text-[15.5px] font-semibold text-cream transition hover:bg-moss disabled:opacity-60"
        >
          {busy ? "Проверяем…" : "Войти"}
        </button>
      </form>
    </main>
  );
}
