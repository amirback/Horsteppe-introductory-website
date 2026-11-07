/**
 * Что и как бот пишет в Telegram. Только чистые функции — проверяются тестом.
 *
 * Разметка — HTML Telegram (<b>, <i>). Всё, что пришло из формы, экранируется:
 * иначе имя вида «<b>» сломало бы сообщение, и Telegram его бы не принял.
 * Время — по Алматы: команда работает по казахстанским часам.
 */
import { contactLinks } from "../leads/contact.ts";
import { LANG_LABEL, STATUS_LABEL, USE_CASE_LABEL, VOLUME_LABEL, leadSource } from "../leads/labels.ts";
import type { Lead, Status } from "../leads/schema.ts";

export type InlineButton = { text: string; callback_data?: string; url?: string };
export type InlineKeyboard = { inline_keyboard: InlineButton[][] };
export type Reply = { text: string; reply_markup?: InlineKeyboard };

export const TZ = "Asia/Almaty";
const stamp = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dayShort = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "short" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Данные кнопки в Telegram — не длиннее 64 байт, поэтому статусы одной буквой.
export const STATUS_CODE: Record<Status, string> = { new: "n", contacted: "c", invited: "i", active: "a", declined: "d" };
export const CODE_STATUS: Record<string, Status> = { n: "new", c: "contacted", i: "invited", a: "active", d: "declined" };
const STATUS_ICON: Record<Status, string> = { new: "🆕", contacted: "📞", invited: "✉️", active: "⭐", declined: "✖️" };

/** Кнопки внизу чата — понятнее, чем команды со слешем. */
export const MENU = { new: "🆕 Новые", all: "📋 Все заявки", stats: "📊 Статистика", help: "❓ Помощь" } as const;
export const MENU_KEYBOARD = {
  keyboard: [[{ text: MENU.new }, { text: MENU.all }], [{ text: MENU.stats }, { text: MENU.help }]],
  resize_keyboard: true,
  is_persistent: true,
  input_field_placeholder: "Имя, почта или компания — найду заявку",
};

export type CardKind = "new" | "repeat" | "view";

export function leadKeyboard(lead: Lead, site?: string): InlineKeyboard {
  const rows: InlineButton[][] = [];
  // В кнопках Telegram допустимы только ссылки https — звонок (tel:) туда не положить.
  const links = contactLinks(lead.contact).filter((l) => l.href.startsWith("https://"));
  if (links.length) rows.push(links.map((l) => ({ text: l.label, url: l.href })));
  const button = (s: Status): InlineButton => ({
    text: `${s === lead.status ? "✓ " : ""}${STATUS_LABEL[s]}`,
    callback_data: `s:${STATUS_CODE[s]}:${lead.id}`,
  });
  rows.push((["new", "contacted", "invited"] as Status[]).map(button), (["active", "declined"] as Status[]).map(button));
  if (site?.startsWith("https://")) rows.push([{ text: "Открыть админку", url: `${site}/admin` }]);
  return { inline_keyboard: rows };
}

/** Карточка заявки: новая (уведомление), повторная или открытая из списка. */
export function leadCard(lead: Lead, kind: CardKind, site?: string): Reply {
  const head =
    kind === "new" ? "🆕 <b>Новая заявка на ранний доступ</b>"
      : kind === "repeat" ? `🔁 <b>Повторная заявка</b> · ${lead.submit_count}-й раз`
        : "📄 <b>Заявка</b>";
  const lines = [head, "", `👤 <b>${esc(lead.name)}</b>`, `✉️ ${esc(lead.email)}`];
  if (lead.contact) lines.push(`📱 ${esc(lead.contact)}`);
  if (lead.company) lines.push(`🏢 ${esc(lead.company)}`);
  const task = [lead.use_case && USE_CASE_LABEL[lead.use_case], lead.volume && VOLUME_LABEL[lead.volume]].filter(Boolean).join(" · ");
  if (task) lines.push(`🎬 ${esc(task)}`);
  if (lead.message) lines.push("", `💬 <i>${esc(clip(lead.message, 700))}</i>`);
  if (lead.admin_note) lines.push("", `📝 ${esc(clip(lead.admin_note, 500))}`);
  const where = [LANG_LABEL[lead.lang] ?? lead.lang.toUpperCase(), lead.country, lead.city].filter(Boolean).join(" · ");
  lines.push("", `🌍 ${esc(where)} · откуда: ${esc(leadSource(lead))}`, `🕒 ${stamp.format(new Date(lead.created_at))}`);
  return { text: lines.join("\n"), reply_markup: leadKeyboard(lead, site) };
}

export const PAGE = 8;
export type ListFilter = "new" | "all";

function listBody(title: string, pool: Lead[], start: number): string[] {
  const lines = [`${title} · ${pool.length}`, ""];
  pool.slice(start, start + PAGE).forEach((lead, i) => {
    const extra = [lead.company, lead.use_case && USE_CASE_LABEL[lead.use_case]].filter(Boolean).join(" · ");
    lines.push(`${start + i + 1}. <b>${esc(lead.name)}</b>${extra ? ` — ${esc(extra)}` : ""}`);
    lines.push(`      ${STATUS_ICON[lead.status]} ${STATUS_LABEL[lead.status]} · ${dayShort.format(new Date(lead.created_at))}`);
  });
  lines.push("", "Нажмите на имя — откроется заявка с кнопками.");
  return lines;
}

function nameButtons(pool: Lead[], start: number): InlineButton[][] {
  return pool.slice(start, start + PAGE).map((lead, i) => [{ text: `${start + i + 1}. ${clip(lead.name, 40)}`, callback_data: `v:${lead.id}` }]);
}

/** Список по страницам: новые (ждут ответа) или все. */
export function leadList(leads: Lead[], filter: ListFilter, offset = 0): Reply {
  const pool = filter === "new" ? leads.filter((l) => l.status === "new") : leads;
  const title = filter === "new" ? "🆕 <b>Новые заявки — ждут ответа</b>" : "📋 <b>Все заявки</b>";
  if (!pool.length) return { text: `${title}\n\n${filter === "new" ? "Новых нет — на все ответили 👌" : "Заявок пока нет."}` };
  const lastPage = Math.floor((pool.length - 1) / PAGE) * PAGE;
  const start = Math.min(Math.max(0, Math.floor(offset / PAGE) * PAGE), lastPage);
  const rows = nameButtons(pool, start);
  const nav: InlineButton[] = [];
  if (start > 0) nav.push({ text: "◂ Назад", callback_data: `p:${filter}:${start - PAGE}` });
  if (start + PAGE < pool.length) nav.push({ text: "Дальше ▸", callback_data: `p:${filter}:${start + PAGE}` });
  if (nav.length) rows.push(nav);
  return { text: listBody(title, pool, start).join("\n"), reply_markup: { inline_keyboard: rows } };
}

/** Поиск по имени, почте, компании, контакту, сообщению и заметке. */
export function findLeads(leads: Lead[], query: string): Lead[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return leads.filter((l) =>
    [l.name, l.email, l.company, l.contact, l.message, l.admin_note].some((v) => !!v && v.toLowerCase().includes(q)),
  );
}

export function searchReply(found: Lead[], query: string): Reply {
  if (!found.length) {
    return { text: `🔎 По запросу «${esc(clip(query, 60))}» ничего не нашёл.\n\nПопробуйте часть имени, почты или название компании.` };
  }
  const title = `🔎 <b>Нашлось по «${esc(clip(query, 60))}»</b>`;
  return { text: listBody(title, found, 0).join("\n"), reply_markup: { inline_keyboard: nameButtons(found, 0) } };
}

export function statsText(leads: Lead[], now: Date): string {
  const count = (s: Status) => leads.filter((l) => l.status === s).length;
  const today = dayKey.format(now);
  const since = (days: number) => leads.filter((l) => now.getTime() - new Date(l.created_at).getTime() <= days * 86_400_000).length;
  const sources = new Map<string, number>();
  for (const lead of leads) sources.set(leadSource(lead), (sources.get(leadSource(lead)) ?? 0) + 1);
  const top = [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, n]) => `${esc(s)} ${n}`).join(" · ");
  const langs = ["ru", "kk", "en"].map((lang) => `${LANG_LABEL[lang]} ${leads.filter((l) => l.lang === lang).length}`).join(" · ");
  return [
    "📊 <b>Заявки на ранний доступ</b>",
    "",
    `Всего: <b>${leads.length}</b>`,
    `🆕 Новые, ждут ответа: ${count("new")}`,
    `📞 Связались: ${count("contacted")}`,
    `✉️ Пригласили: ${count("invited")}`,
    `⭐ Стали клиентами: ${count("active")}`,
    `✖️ Отказ: ${count("declined")}`,
    "",
    `Сегодня: ${leads.filter((l) => dayKey.format(new Date(l.created_at)) === today).length} · за 7 дней: ${since(7)} · за 30 дней: ${since(30)}`,
    "",
    `Язык сайта: ${langs}`,
    leads.length ? `Откуда чаще всего: ${top}` : "",
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n").trim();
}

export const HELP = [
  "<b>Бот заявок Horsteppe</b>",
  "",
  "Каждая новая заявка с сайта приходит сюда сразу.",
  "",
  `${MENU.new} — кто ждёт ответа`,
  `${MENU.all} — весь список`,
  `${MENU.stats} — сколько заявок и откуда`,
  "",
  "Под каждой заявкой — кнопки статуса: «Связались», «Пригласили», «Клиент», «Отказ».",
  "Ответьте на заявку текстом — сохраню как заметку, её видно и в админке.",
  "Напишите имя, почту или компанию — найду заявку.",
  "",
  "/stop — больше не присылать заявки в этот чат.",
].join("\n");

export const WELCOME = `✅ <b>Готово! Этот чат подключён к заявкам Horsteppe.</b>\n\n${HELP.split("\n").slice(2).join("\n")}`;
export const LINK_EXPIRED =
  "Ссылка для подключения устарела или неверна. Откройте админку сайта → «Telegram» → «Подключить» и нажмите новую ссылку.";
export const NO_TABLE =
  "Не получилось сохранить чат: в базе ещё нет таблицы для бота. Выполните SQL из инструкции (supabase/intro_leads.sql) и нажмите ссылку ещё раз.";
