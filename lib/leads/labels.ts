/** Подписи для админки, CSV и уведомлений. Админка — по-русски. */
import type { Status, UseCase, Volume } from "./schema.ts";

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
