"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "../site/Icons.tsx";

type Chat = { chat_id: number; title: string | null; linked_at: string };
type Status =
  | { configured: false; tokenInvalid: boolean }
  | { configured: true; ok: false; error: string }
  | {
      configured: true;
      ok: true;
      bot: { username: string; name: string };
      webhook: { connected: boolean; lastError: string | null };
      chats: Chat[];
      tableMissing: boolean;
      envChat: boolean;
      storeReady: boolean;
    };
type Link = { link: string; groupLink: string; expiresInMin: number };

const linkedDay = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });

/**
 * Telegram-бот заявок в админке: как создать бота, подключить свой чат одной
 * ссылкой, проверить связь и отключить лишние чаты. Токен бота сюда не
 * приходит никогда — только его имя.
 */
export function TelegramDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const chatsBefore = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/telegram", { cache: "no-store" });
      if (res.status === 401) return window.location.assign("/admin/login");
      if (!res.ok) throw new Error(String(res.status));
      setStatus(await res.json());
      setError(null);
    } catch {
      setError("Не удалось узнать состояние бота. Проверьте интернет и откройте окно ещё раз.");
    }
  }, []);

  useEffect(() => {
    load();
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [load, onClose]);

  // Пока ссылка открыта, раз в 3 секунды смотрим, не подключился ли чат, — до 3 минут.
  useEffect(() => {
    if (!link) return;
    let rounds = 0;
    const timer = setInterval(() => {
      rounds += 1;
      if (rounds > 60) clearInterval(timer);
      else load();
    }, 3000);
    return () => clearInterval(timer);
  }, [link, load]);

  const chats = status && status.configured && status.ok ? status.chats : [];
  useEffect(() => {
    if (!link) return;
    if (chatsBefore.current === null) chatsBefore.current = chats.length;
    else if (chats.length > chatsBefore.current) {
      setLink(null);
      setNote(`Подключено: ${chats[chats.length - 1]?.title ?? "новый чат"}. Новые заявки будут приходить туда.`);
      chatsBefore.current = null;
    }
  }, [chats, link]);

  async function act(action: "link" | "test" | "unlink", extra: Record<string, unknown> = {}) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/admin/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.status === 401) return window.location.assign("/admin/login");
      const body = await res.json().catch(() => ({}));
      if (action === "link") {
        if (!res.ok) {
          setNote(
            body.error === "need_https"
              ? "Подключать бота нужно на опубликованном сайте (адрес с https), а не на своём компьютере."
              : `Telegram не принял настройку: ${body.detail ?? body.error ?? res.status}.`,
          );
          return;
        }
        chatsBefore.current = null;
        setLink(body);
      } else if (action === "test") {
        setNote(
          res.ok
            ? `Проверка отправлена: доставлено в ${body.delivered} из ${body.total}.`
            : body.error === "no_chats"
              ? "Пока некуда отправлять — сначала подключите чат."
              : "Не получилось отправить проверку.",
        );
      } else {
        setNote(res.ok ? "Чат отключён." : "Не получилось отключить чат.");
        await load();
      }
    } catch {
      setNote("Нет связи с сервером.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:px-4">
      <button className="absolute inset-0 bg-night/40 backdrop-blur-[2px]" aria-label="Закрыть" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Telegram"
        className="relative max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-t-[0.5rem] border border-ink/12 bg-parchment p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[0.5rem] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-[1.75rem] font-semibold leading-tight text-pine">Telegram-бот заявок</h2>
          <button ref={closeRef} onClick={onClose} className="rounded-[0.25rem] p-1.5 text-ink-mute hover:text-ink" aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
          Бот пишет о каждой новой заявке, показывает все заявки и статистику, а под каждой заявкой — кнопки статуса.
        </p>

        {error ? <p role="alert" className="mt-5 rounded-[0.25rem] border border-ember/40 bg-ember/[0.07] px-4 py-3 text-[0.9375rem] text-ember">{error}</p> : null}
        {!status && !error ? <div className="mt-5 h-24 animate-pulse rounded-[0.375rem] bg-ink/5" /> : null}

        {status && !status.configured ? (
          <div className="mt-5">
            {status.tokenInvalid ? (
              <p role="alert" className="mb-4 rounded-[0.25rem] border border-ember/40 bg-ember/[0.07] px-4 py-3 text-[0.9375rem] text-ember">
                В TELEGRAM_BOT_TOKEN записано что-то не то. Токен выглядит так: 123456789:AAH… — скопируйте его из @BotFather целиком.
              </p>
            ) : null}
            <div className="text-[0.875rem] font-semibold text-pine">Бот ещё не создан. Это 3 минуты:</div>
            <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[0.9375rem] leading-relaxed text-ink-soft">
              <li>
                В Telegram откройте{" "}
                <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="font-semibold text-pine underline underline-offset-4">
                  @BotFather
                </a>{" "}
                и отправьте <b>/newbot</b>. Придумайте название (например, «Horsteppe Заявки») и адрес, который кончается на <b>bot</b>.
              </li>
              <li>BotFather пришлёт токен — длинную строку вида 123456789:AAH… Скопируйте её.</li>
              <li>
                Vercel → проект <b>introductory</b> → Settings → Environment Variables → добавьте <b>TELEGRAM_BOT_TOKEN</b> со значением
                токена → Save. Затем Deployments → «…» у последнего → <b>Redeploy</b>.
              </li>
              <li>Через минуту откройте это окно снова и нажмите «Подключить Telegram».</li>
            </ol>
          </div>
        ) : null}

        {status && status.configured && !status.ok ? (
          <p role="alert" className="mt-5 rounded-[0.25rem] border border-ember/40 bg-ember/[0.07] px-4 py-3 text-[0.9375rem] leading-relaxed text-ember">
            Telegram не принял токен ({status.error}). Скопируйте его заново из @BotFather в TELEGRAM_BOT_TOKEN в Vercel и сделайте Redeploy.
          </p>
        ) : null}

        {status && status.configured && status.ok ? (
          <div className="mt-5">
            <p className="text-[0.9375rem] text-ink-soft">
              Бот:{" "}
              <a href={`https://t.me/${status.bot.username}`} target="_blank" rel="noreferrer" className="font-semibold text-pine underline underline-offset-4">
                @{status.bot.username}
              </a>
            </p>

            {status.tableMissing ? (
              <p role="alert" className="mt-4 rounded-[0.25rem] border border-ember/40 bg-ember/[0.07] px-4 py-3 text-[0.9375rem] leading-relaxed text-ember">
                В базе нет таблицы для чатов бота. Supabase → SQL Editor → вставьте весь файл supabase/intro_leads.sql → Run. Повторный
                запуск безопасен.
              </p>
            ) : null}

            <div className="mt-5 text-[0.875rem] font-semibold text-pine">Куда приходят заявки</div>
            <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
              {status.chats.map((chat) => (
                <li key={chat.chat_id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] text-ink">{chat.title ?? `Чат ${chat.chat_id}`}</span>
                    <span className="block text-[0.75rem] text-ink-mute">подключён {linkedDay.format(new Date(chat.linked_at))}</span>
                  </span>
                  <button
                    onClick={() => act("unlink", { chat_id: chat.chat_id })}
                    disabled={busy}
                    className="shrink-0 rounded-[0.25rem] px-2 py-1.5 text-[0.8125rem] font-semibold text-ember hover:underline disabled:opacity-40"
                  >
                    Отключить
                  </button>
                </li>
              ))}
              {status.envChat ? (
                <li className="py-2.5 text-[0.9375rem] text-ink">
                  Чат из настроек Vercel <span className="text-ink-mute">(TELEGRAM_CHAT_ID)</span>
                </li>
              ) : null}
              {!status.chats.length && !status.envChat ? (
                <li className="py-2.5 text-[0.9375rem] text-ink-mute">Пока ни одного чата.</li>
              ) : null}
            </ul>

            {!status.webhook.connected && (status.chats.length > 0 || status.envChat) ? (
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-ember">
                Бот сейчас не слышит сайт: кнопки и команды в Telegram не работают. Нажмите кнопку подключения ниже — это починит.
              </p>
            ) : null}
            {status.webhook.lastError ? (
              <p className="mt-2 text-[0.75rem] leading-relaxed text-ink-mute">Последняя ошибка Telegram: {status.webhook.lastError}</p>
            ) : null}

            {link ? (
              <div className="mt-5 rounded-[0.375rem] border border-leaf/30 bg-sand/40 p-4">
                <a href={link.link} target="_blank" rel="noreferrer" className="btn btn-primary w-full">
                  Открыть бота в Telegram
                </a>
                <p className="mt-3 text-[0.875rem] leading-relaxed text-ink-soft">
                  В Telegram нажмите <b>«Start»</b> (или «Запустить») — и всё. Ссылка действует {link.expiresInMin} минут; это окно само
                  покажет, когда чат подключится.
                </p>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-ink-mute">
                  Нужно в общую группу команды?{" "}
                  <a href={link.groupLink} target="_blank" rel="noreferrer" className="font-semibold text-pine underline underline-offset-4">
                    Добавить бота в группу
                  </a>
                  . Подключить другого человека — откройте ссылку на его телефоне.
                </p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => act("link")} disabled={busy || status.tableMissing || !status.storeReady} className="btn btn-primary min-h-11 flex-1 disabled:opacity-40">
                {status.chats.length ? "Подключить ещё чат" : "Подключить Telegram"}
              </button>
              <button
                onClick={() => act("test")}
                disabled={busy || (!status.chats.length && !status.envChat)}
                className="btn btn-line min-h-11 flex-1 disabled:opacity-40"
              >
                Отправить проверку
              </button>
            </div>
          </div>
        ) : null}

        {note ? (
          <p role="status" className="mt-4 text-[0.9375rem] leading-relaxed text-pine">
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
