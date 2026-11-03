"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { leadsCsv } from "../../lib/csv.ts";
import { STATUS_LABEL, USE_CASE_LABEL, VOLUME_LABEL } from "../../lib/leads/labels.ts";
import { STATUSES, USE_CASES, type Lead, type Status } from "../../lib/leads/schema.ts";
import { CloseIcon } from "../site/Icons.tsx";
import { LogoMark } from "../site/Logo.tsx";
import { DailyChart, leadsWord, type Day } from "./DailyChart.tsx";

type Period = "all" | "30" | "7" | "today";
const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "Всё время" },
  { value: "30", label: "30 дней" },
  { value: "7", label: "7 дней" },
  { value: "today", label: "Сегодня" },
];

const dayKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" });
const dayShort = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const dayLong = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "short" });
const stamp = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function startOfDay(offsetDays: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d;
}

function inPeriod(lead: Lead, period: Period): boolean {
  if (period === "all") return true;
  const from = period === "today" ? startOfDay(0) : startOfDay(Number(period) - 1);
  return new Date(lead.created_at) >= from;
}

function contactLinks(contact: string | null): { label: string; href: string }[] {
  if (!contact) return [];
  const value = contact.trim();
  const handle = value.match(/^@?([A-Za-z0-9_]{4,32})$/);
  const tg = value.match(/t\.me\/([A-Za-z0-9_]{4,32})/);
  const digits = value.replace(/[^\d+]/g, "");
  const links: { label: string; href: string }[] = [];
  if (tg || (handle && value.startsWith("@"))) links.push({ label: "Telegram", href: `https://t.me/${(tg ?? handle)![1]}` });
  if (/^\+?\d{10,15}$/.test(digits)) {
    links.push({ label: "Позвонить", href: `tel:${digits}` });
    links.push({ label: "WhatsApp", href: `https://wa.me/${digits.replace(/^\+/, "")}` });
  }
  return links;
}

function sourceOf(lead: Lead): string {
  if (lead.utm_source) return [lead.utm_source, lead.utm_medium].filter(Boolean).join(" / ");
  if (lead.referrer) {
    try {
      return new URL(lead.referrer).host.replace(/^www\./, "");
    } catch {
      return lead.referrer;
    }
  }
  return "напрямую";
}

export function Dashboard() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sheetsUrl, setSheetsUrl] = useState<string | null>(null);
  const [storage, setStorage] = useState<"supabase" | "file" | null>(null);
  const [period, setPeriod] = useState<Period>("30");
  const [status, setStatus] = useState<Status | "all">("all");
  const [useCase, setUseCase] = useState<string>("all");
  const [lang, setLang] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetsOpen, setSheetsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/leads", { cache: "no-store" });
      if (res.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          body.error === "store_unavailable"
            ? "База заявок не подключена. В Vercel нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY, а в Supabase — таблицы из supabase/intro_leads.sql."
            : "Не удалось загрузить заявки.",
        );
        return;
      }
      setLeads(body.leads);
      setSheetsUrl(body.sheetsUrl);
      setStorage(body.storage);
      setError(null);
    } catch {
      setError("Нет связи с сервером.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Новые заявки подтягиваются сами, пока вкладка открыта.
    const timer = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads ?? []).filter(
      (l) =>
        inPeriod(l, period) &&
        (status === "all" || l.status === status) &&
        (useCase === "all" || l.use_case === useCase) &&
        (lang === "all" || l.lang === lang) &&
        (!q ||
          [l.name, l.email, l.company, l.contact, l.message, l.admin_note]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))),
    );
  }, [leads, period, status, useCase, lang, query]);

  const stats = useMemo(
    () => ({
      total: filtered.length,
      fresh: filtered.filter((l) => l.status === "new").length,
      working: filtered.filter((l) => l.status === "contacted" || l.status === "invited").length,
      clients: filtered.filter((l) => l.status === "active").length,
    }),
    [filtered],
  );

  // График — дни выбранного периода; «всё время» показывает последние 30 дней.
  const days = useMemo<Day[]>(() => {
    const span = period === "7" ? 7 : 30;
    const counts = new Map<string, number>();
    for (const l of filtered) {
      const key = dayKey.format(new Date(l.created_at));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from({ length: span }, (_, i) => {
      const date = startOfDay(span - 1 - i);
      const key = dayKey.format(date);
      return { key, label: dayShort.format(date), long: dayLong.format(date), count: counts.get(key) ?? 0 };
    });
  }, [filtered, period]);

  const patch = useCallback(async (id: string, change: Partial<Pick<Lead, "status" | "admin_note">>) => {
    const before = leads;
    setLeads((list) => list?.map((l) => (l.id === id ? { ...l, ...change } : l)) ?? null);
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      if (res.status === 401) return window.location.assign("/admin/login");
      if (!res.ok) throw new Error(String(res.status));
      const body: { lead: Lead } = await res.json();
      setLeads((list) => list?.map((l) => (l.id === id ? body.lead : l)) ?? null);
      setToast("Сохранено");
    } catch {
      setLeads(before);
      setToast("Не сохранилось — попробуйте ещё раз");
    }
  }, [leads]);

  const remove = useCallback(async (lead: Lead) => {
    if (!window.confirm(`Удалить заявку ${lead.name} (${lead.email}) навсегда? Это нельзя отменить.`)) return;
    const res = await fetch(`/api/admin/leads/${lead.id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setLeads((list) => list?.filter((l) => l.id !== lead.id) ?? null);
      setOpenId(null);
      setToast("Заявка удалена");
    } else {
      setToast("Не удалось удалить");
    }
  }, []);

  function downloadCsv() {
    const blob = new Blob([leadsCsv(filtered, { bom: true })], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `horsteppe-leads-${dayKey.format(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    window.location.assign("/admin/login");
  }

  const opened = leads?.find((l) => l.id === openId) ?? null;
  const select = "rounded-xl border border-ink/15 bg-white/80 px-3 py-2.5 text-[14px] text-ink outline-none focus:border-ink";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink/8 bg-paper/90 backdrop-blur-xl">
        <div className="container-x flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="font-display text-[17px] font-bold tracking-[-0.01em]">Заявки</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadCsv} disabled={!filtered.length} className="hidden rounded-full border border-ink/15 px-4 py-2 text-[13.5px] font-semibold text-ink hover:border-ink/40 disabled:opacity-40 sm:inline-flex">
              Скачать CSV
            </button>
            <button onClick={() => setSheetsOpen(true)} disabled={!sheetsUrl} className="hidden rounded-full border border-ink/15 px-4 py-2 text-[13.5px] font-semibold text-ink hover:border-ink/40 disabled:opacity-40 sm:inline-flex">
              Google Таблица
            </button>
            <button onClick={logout} className="rounded-full px-3 py-2 text-[13.5px] font-semibold text-ink-mute hover:text-ink">
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="container-x py-8 md:py-10">
        {storage === "file" ? (
          <p className="mb-6 rounded-xl border border-olive/40 bg-pale/50 px-4 py-3 text-[14px] text-ink-soft">
            Локальное хранилище для разработки: заявки лежат в файле на этом компьютере, не в Supabase.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mb-6 rounded-xl border border-ember/40 bg-ember/8 px-4 py-3 text-[14.5px] text-ember">
            {error}
          </p>
        ) : null}

        {/* Фильтры — одним рядом над всем, что они определяют. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <div className="col-span-2 flex rounded-xl border border-ink/15 bg-white/70 p-1 sm:col-span-1" role="group" aria-label="Период">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                aria-pressed={period === p.value}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[13.5px] font-semibold transition sm:flex-none ${
                  period === p.value ? "bg-ink text-cream" : "text-ink-soft hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select aria-label="Статус" value={status} onChange={(e) => setStatus(e.target.value as Status | "all")} className={select}>
            <option value="all">Все статусы</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select aria-label="Задача" value={useCase} onChange={(e) => setUseCase(e.target.value)} className={`${select} col-span-2 sm:col-span-1`}>
            <option value="all">Все задачи</option>
            {USE_CASES.map((u) => (
              <option key={u} value={u}>
                {USE_CASE_LABEL[u]}
              </option>
            ))}
          </select>
          <select aria-label="Язык" value={lang} onChange={(e) => setLang(e.target.value)} className={select}>
            <option value="all">Все языки</option>
            <option value="ru">Русский</option>
            <option value="kk">Қазақша</option>
            <option value="en">English</option>
          </select>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: имя, почта, компания…"
            aria-label="Поиск"
            className={`${select} col-span-2 min-w-0 sm:max-w-xs sm:flex-1`}
          />
        </div>

        <div className={`transition-opacity ${loading && leads ? "opacity-60" : ""}`}>
          <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Заявок", value: stats.total },
              { label: "Новые, ждут ответа", value: stats.fresh },
              { label: "В работе", value: stats.working },
              { label: "Стали клиентами", value: stats.clients },
            ].map((tile) => (
              <div key={tile.label} className="rounded-[20px] border border-ink/10 bg-card px-5 py-4">
                <dt className="text-[13px] text-ink-mute">{tile.label}</dt>
                <dd className="mt-1 font-sans text-[30px] font-semibold tracking-[-0.02em] text-ink">{tile.value}</dd>
              </div>
            ))}
          </dl>

          {period !== "today" && leads ? (
            <div className="mt-4">
              <DailyChart days={days} title={period === "7" ? "Заявки по дням, 7 дней" : "Заявки по дням, 30 дней"} />
            </div>
          ) : null}

          <section className="mt-6" aria-label="Заявки">
            {leads === null && !error ? (
              <div className="h-40 animate-pulse rounded-[20px] bg-ink/5" />
            ) : filtered.length === 0 ? (
              <p className="rounded-[20px] border border-ink/10 bg-card px-6 py-12 text-center text-[15px] text-ink-mute">
                {leads?.length ? "По этим фильтрам заявок нет." : "Заявок пока нет. Они появятся здесь сразу после отправки формы на сайте."}
              </p>
            ) : (
              <>
                {/* Телефон: карточки. Ноутбук: таблица. */}
                <ul className="grid gap-3 md:hidden">
                  {filtered.map((l) => (
                    <li key={l.id}>
                      <button onClick={() => setOpenId(l.id)} className="w-full rounded-[18px] border border-ink/10 bg-card p-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-semibold text-ink">{l.name}</div>
                            <div className="truncate text-[13px] text-ink-mute">{l.company ?? l.email}</div>
                          </div>
                          <StatusBadge status={l.status} />
                        </div>
                        <div className="mt-2 text-[12.5px] text-ink-mute">
                          {stamp.format(new Date(l.created_at))} · {l.use_case ? USE_CASE_LABEL[l.use_case] : "задача не указана"}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="hidden overflow-x-auto rounded-[20px] border border-ink/10 bg-card md:block">
                  <table className="w-full text-left text-[14px]">
                    <thead className="border-b border-ink/10 text-[12.5px] text-ink-mute">
                      <tr>
                        <th className="px-4 py-3 font-medium">Когда</th>
                        <th className="px-4 py-3 font-medium">Кто</th>
                        <th className="px-4 py-3 font-medium">Связь</th>
                        <th className="px-4 py-3 font-medium">Задача</th>
                        <th className="px-4 py-3 font-medium">Откуда</th>
                        <th className="px-4 py-3 font-medium">Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((l) => (
                        <tr key={l.id} className="border-t border-ink/8 align-top hover:bg-paper/70">
                          <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-soft">{stamp.format(new Date(l.created_at))}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => setOpenId(l.id)} className="text-left font-semibold text-ink underline-offset-4 hover:underline">
                              {l.name}
                            </button>
                            {l.company ? <div className="text-[13px] text-ink-mute">{l.company}</div> : null}
                            {l.submit_count > 1 ? <div className="text-[12px] text-sage">повторная · {l.submit_count}×</div> : null}
                          </td>
                          <td className="px-4 py-3">
                            <a href={`mailto:${l.email}`} className="text-ink hover:underline">
                              {l.email}
                            </a>
                            {l.contact ? <div className="text-[13px] text-ink-mute">{l.contact}</div> : null}
                          </td>
                          <td className="px-4 py-3 text-ink-soft">
                            {l.use_case ? USE_CASE_LABEL[l.use_case] : "—"}
                            {l.volume ? <div className="text-[13px] text-ink-mute">{VOLUME_LABEL[l.volume]}</div> : null}
                          </td>
                          <td className="px-4 py-3 text-ink-soft">
                            {sourceOf(l)}
                            <div className="text-[13px] text-ink-mute">
                              {[l.lang.toUpperCase(), l.country, l.city].filter(Boolean).join(" · ")}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              aria-label={`Статус заявки ${l.name}`}
                              value={l.status}
                              onChange={(e) => patch(l.id, { status: e.target.value as Status })}
                              className="rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-[13.5px] text-ink outline-none focus:border-ink"
                            >
                              {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[12.5px] text-ink-mute">
                  Показано {filtered.length} {leadsWord(filtered.length)}
                  {leads && filtered.length !== leads.length ? ` из ${leads.length}` : ""}.
                </p>
              </>
            )}
          </section>

          <div className="mt-6 flex gap-2 sm:hidden">
            <button onClick={downloadCsv} disabled={!filtered.length} className="flex-1 rounded-full border border-ink/15 px-4 py-3 text-[14px] font-semibold disabled:opacity-40">
              Скачать CSV
            </button>
            <button onClick={() => setSheetsOpen(true)} disabled={!sheetsUrl} className="flex-1 rounded-full border border-ink/15 px-4 py-3 text-[14px] font-semibold disabled:opacity-40">
              Google Таблица
            </button>
          </div>
        </div>
      </main>

      {opened ? <LeadPanel lead={opened} onClose={() => setOpenId(null)} onPatch={patch} onDelete={remove} /> : null}
      {sheetsOpen && sheetsUrl ? <SheetsDialog url={sheetsUrl} onClose={() => setSheetsOpen(false)} /> : null}
      {toast ? (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-2.5 text-[14px] text-cream shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/** Статус — словом. Цветом выделена только «Новая»: это то, что ждёт ответа. */
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/12 bg-white/70 px-2.5 py-1 text-[12px] font-semibold text-ink-soft">
      {status === "new" ? <span className="h-1.5 w-1.5 rounded-full bg-sage" aria-hidden /> : null}
      {STATUS_LABEL[status]}
    </span>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-t border-ink/8 py-2.5 text-[14px]">
      <dt className="text-ink-mute">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function LeadPanel({ lead, onClose, onPatch, onDelete }: {
  lead: Lead;
  onClose: () => void;
  onPatch: (id: string, change: Partial<Pick<Lead, "status" | "admin_note">>) => void;
  onDelete: (lead: Lead) => void;
}) {
  const [note, setNote] = useState(lead.admin_note ?? "");
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(onClose);
  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => setNote(lead.admin_note ?? ""), [lead.id, lead.admin_note]);
  const links = contactLinks(lead.contact);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button className="absolute inset-0 bg-forest/30 backdrop-blur-[2px]" aria-label="Закрыть" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={`Заявка: ${lead.name}`} className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-paper shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-ink/10 px-6 py-5">
          <div className="min-w-0">
            <h2 className="font-display truncate text-[22px] font-bold tracking-[-0.01em] text-ink">{lead.name}</h2>
            <p className="text-[13px] text-ink-mute">{stamp.format(new Date(lead.created_at))}</p>
          </div>
          <button ref={closeRef} onClick={onClose} className="rounded-full p-2 text-ink-mute hover:text-ink" aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <a href={`mailto:${lead.email}`} className="rounded-full bg-ink px-4 py-2 text-[13.5px] font-semibold text-cream hover:bg-moss">
              Написать письмо
            </a>
            {links.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="rounded-full border border-ink/15 px-4 py-2 text-[13.5px] font-semibold text-ink hover:border-ink/40">
                {link.label}
              </a>
            ))}
          </div>

          <label className="mt-6 block">
            <span className="text-[13px] font-semibold text-ink">Статус</span>
            <select
              value={lead.status}
              onChange={(e) => onPatch(lead.id, { status: e.target.value as Status })}
              className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white/80 px-3 py-2.5 text-[14.5px] text-ink outline-none focus:border-ink"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <dl className="mt-6">
            <Row label="Email">{lead.email}</Row>
            <Row label="Связь">{lead.contact ?? "—"}</Row>
            <Row label="Компания">{lead.company ?? "—"}</Row>
            <Row label="Задача">{lead.use_case ? USE_CASE_LABEL[lead.use_case] : "—"}</Row>
            <Row label="Объём">{lead.volume ? VOLUME_LABEL[lead.volume] : "—"}</Row>
            <Row label="Язык сайта">{lead.lang.toUpperCase()}</Row>
            <Row label="Откуда">{[lead.country, lead.city].filter(Boolean).join(", ") || "—"}</Row>
            <Row label="Источник">{sourceOf(lead)}</Row>
            {lead.utm_campaign ? <Row label="Кампания">{lead.utm_campaign}</Row> : null}
            <Row label="Заявок">
              {lead.submit_count}
              {lead.submit_count > 1 ? ` · последняя ${stamp.format(new Date(lead.last_submitted_at))}` : ""}
            </Row>
          </dl>

          {lead.message ? (
            <div className="mt-6">
              <div className="text-[13px] font-semibold text-ink">Сообщение</div>
              <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-ink/10 bg-card px-4 py-3 text-[14.5px] leading-relaxed text-ink-soft">{lead.message}</p>
            </div>
          ) : null}

          <label className="mt-6 block">
            <span className="text-[13px] font-semibold text-ink">Заметка команды</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Созвонились, ждём фото товара…"
              className="mt-1.5 w-full resize-y rounded-xl border border-ink/15 bg-white/80 px-4 py-3 text-[14.5px] text-ink outline-none focus:border-ink"
            />
          </label>
          <button
            onClick={() => onPatch(lead.id, { admin_note: note.trim() || null })}
            disabled={(note.trim() || null) === (lead.admin_note ?? null)}
            className="mt-2 rounded-full bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-moss disabled:opacity-40"
          >
            Сохранить заметку
          </button>
        </div>

        <div className="border-t border-ink/10 px-6 py-4">
          <button onClick={() => onDelete(lead)} className="text-[13.5px] font-semibold text-ember hover:underline">
            Удалить заявку по просьбе человека
          </button>
        </div>
      </aside>
    </div>
  );
}

function SheetsDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const formula = `=IMPORTDATA("${url}")`;
  const [copied, setCopied] = useState(false);
  useEscape(onClose);

  async function copy() {
    try {
      await navigator.clipboard.writeText(formula);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <button className="absolute inset-0 bg-forest/30 backdrop-blur-[2px]" aria-label="Закрыть" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Google Таблица" className="relative w-full max-w-lg rounded-[24px] bg-paper p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-[21px] font-bold tracking-[-0.01em] text-ink">Заявки в Google Таблице</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-mute hover:text-ink" aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-[14.5px] leading-relaxed text-ink-soft">
          <li>Создайте новую таблицу на sheets.google.com.</li>
          <li>Вставьте формулу ниже в ячейку A1 и нажмите Enter.</li>
          <li>Таблица заполнится сама и будет обновляться примерно раз в час.</li>
        </ol>
        <div className="mt-4 break-all rounded-xl border border-ink/12 bg-card px-4 py-3 font-mono text-[12.5px] text-ink">{formula}</div>
        <button onClick={copy} className="mt-3 rounded-full bg-ink px-5 py-2.5 text-[14px] font-semibold text-cream hover:bg-moss">
          {copied ? "Скопировано" : "Скопировать формулу"}
        </button>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-mute">
          Ссылка работает как пароль: кто её знает, видит все заявки. Не публикуйте её. Чтобы отозвать доступ, смените
          ADMIN_PASSWORD в Vercel — ссылка поменяется вместе с паролем.
        </p>
      </div>
    </div>
  );
}
