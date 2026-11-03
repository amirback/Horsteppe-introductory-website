/**
 * Выгрузка заявок в CSV — для Excel и Google Таблиц.
 *
 * Главная опасность здесь не в кавычках, а в формулах: заявку заполняет
 * незнакомец, и «=HYPERLINK(...)» в поле «Компания» превратился бы в работающую
 * формулу в таблице основателя. Значения, начинающиеся с = + - @ или
 * табуляции, получают апостроф — так их показывают как текст. Телефон
 * «+7 777 …» не трогаем: в нём только цифры и разделители, выполнить в нём
 * нечего, а апостроф испортил бы номер.
 */
import { LANG_LABEL, STATUS_LABEL, USE_CASE_LABEL, VOLUME_LABEL } from "./leads/labels.ts";
import type { Lead } from "./leads/schema.ts";

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?[\d\s().-]+$/;

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: unknown[][], { bom = false }: { bom?: boolean } = {}): string {
  return (bom ? "﻿" : "") + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

const HEADER = [
  "Дата заявки", "Имя", "Email", "Связь", "Компания", "Задача", "Объём", "Сообщение", "Язык",
  "Страна", "Город", "Статус", "Заметка", "Источник (utm_source)", "Канал (utm_medium)",
  "Кампания (utm_campaign)", "Откуда пришли", "Повторных заявок", "Последняя заявка", "ID",
];

/** Дата так, чтобы таблица узнала её без настроек: 2026-11-03 18:40 по UTC. */
function when(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace("T", " ") : "";
}

export function leadsCsv(leads: Lead[], options: { bom?: boolean } = {}): string {
  const rows: unknown[][] = [HEADER];
  for (const l of leads) {
    rows.push([
      when(l.created_at), l.name, l.email, l.contact, l.company,
      l.use_case ? USE_CASE_LABEL[l.use_case] : "", l.volume ? VOLUME_LABEL[l.volume] : "",
      l.message, LANG_LABEL[l.lang] ?? l.lang, l.country, l.city, STATUS_LABEL[l.status] ?? l.status,
      l.admin_note, l.utm_source, l.utm_medium, l.utm_campaign, l.referrer,
      Math.max(0, (l.submit_count || 1) - 1), when(l.last_submitted_at), l.id,
    ]);
  }
  return toCsv(rows, options);
}
