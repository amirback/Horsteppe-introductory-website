/** Подписи для админки, CSV и уведомлений. Админка — по-русски. */
import type { Lead, Status, UseCase, Volume } from "./schema.ts";

export const STATUS_LABEL: Record<Status, string> = {
  new: "Новая",
  contacted: "Связались",
  invited: "Пригласили",
  active: "Клиент",
  declined: "Отказ",
};

export const USE_CASE_LABEL: Record<UseCase, string> = {
  product_ads: "Реклама товара",
  social: "Ролики для соцсетей",
  animate_photo: "Оживить фото",
  agency: "Агентство, ролики клиентам",
  explainers: "Объясняющие ролики",
  other: "Другое",
};

export const VOLUME_LABEL: Record<Volume, string> = {
  "1-5": "1–5 в месяц",
  "6-20": "6–20 в месяц",
  "21-50": "21–50 в месяц",
  "50+": "Больше 50 в месяц",
};

export const LANG_LABEL: Record<string, string> = { en: "EN", ru: "RU", kk: "KK" };

/** Откуда пришёл человек: метка рекламы, иначе сайт-источник, иначе «напрямую». */
export function leadSource(lead: Pick<Lead, "utm_source" | "utm_medium" | "referrer">): string {
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
