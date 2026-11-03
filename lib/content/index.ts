import type { Lang } from "../i18n.ts";
import { en } from "./en.ts";
import { kk } from "./kk.ts";
import { ru } from "./ru.ts";
import type { SiteDict } from "./types.ts";

const NBSP = " ";

/**
 * Типографика для всего словаря сразу, а не по месту.
 *
 * Тире не начинает строку: пробел перед ним неразрывный. В русском и
 * казахском однобуквенные предлоги и союзы («в», «к», «и», «с»…) не остаются
 * висеть в конце строки — они держатся за следующее слово.
 */
export function typo(text: string, lang: Lang): string {
  let out = text.replace(/ ([—–]) /g, `${NBSP}$1 `);
  if (lang !== "en") out = out.replace(/(?<=^|[\s(«" ])([вкосуияаВКОСУИЯА]) /g, `$1${NBSP}`);
  return out;
}

function typoDeep<T>(value: T, lang: Lang): T {
  if (typeof value === "string") return typo(value, lang) as T;
  if (Array.isArray(value)) return value.map((item) => typoDeep(item, lang)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, typoDeep(v, lang)])) as T;
  }
  return value;
}

export const content: Record<Lang, SiteDict> = {
  en: typoDeep(en, "en"),
  ru: typoDeep(ru, "ru"),
  kk: typoDeep(kk, "kk"),
};
export type { SiteDict };
