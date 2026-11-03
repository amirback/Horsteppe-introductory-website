/**
 * Заявка на ранний доступ: что принимаем от браузера и в каком виде храним.
 *
 * Всё, что приходит из формы, — данные от незнакомца: длина, формат и набор
 * значений проверяются здесь, до записи. Списки совпадают с проверками
 * таблицы intro_leads (supabase/intro_leads.sql); расхождение ловит тест.
 */
import { LOCALES, isLang, type Lang } from "../i18n.ts";

export const USE_CASES = ["product_ads", "social", "animate_photo", "agency", "explainers", "other"] as const;
export const VOLUMES = ["1-5", "6-20", "21-50", "50+"] as const;
export const STATUSES = ["new", "contacted", "invited", "active", "declined"] as const;

export type UseCase = (typeof USE_CASES)[number];
export type Volume = (typeof VOLUMES)[number];
export type Status = (typeof STATUSES)[number];

export const LIMITS = {
  name: 100,
  email: 254,
  contact: 100,
  company: 120,
  message: 1500,
  utm: 100,
  referrer: 300,
  landingPath: 200,
  note: 2000,
} as const;

/** Быстрее этого человек форму не заполнит: имя, почта и галочка согласия. */
export const MIN_FILL_MS = 1500;

export type NewLead = {
  name: string;
  email: string;
  contact: string | null;
  company: string | null;
  use_case: UseCase | null;
  volume: Volume | null;
  message: string | null;
  lang: Lang;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_path: string | null;
};

export type Lead = NewLead & {
  id: string;
  created_at: string;
  updated_at: string;
  last_submitted_at: string;
  submit_count: number;
  country: string | null;
  city: string | null;
  status: Status;
  admin_note: string | null;
};

export type ParseResult =
  | { ok: true; lead: NewLead }
  | { ok: false; bot: true }
  | { ok: false; bot: false; field: string };

// Управляющие символы (кроме перевода строки и табуляции в сообщении) в
// имени и почте не нужны никому, кроме того, кто хочет сломать таблицу.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

function text(value: unknown, max: number, { multiline = false } = {}): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  let cleaned = value.replace(CONTROL, "");
  cleaned = multiline ? cleaned.replace(/\r\n?/g, "\n").trim() : cleaned.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? undefined : cleaned;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/**
 * Разобрать заявку. `now` передаётся явно, чтобы проверка времени заполнения
 * была проверяемой.
 *
 * Бот узнаётся по заполненной ловушке или по нечеловеческой скорости. Ему
 * отвечают так же, как человеку, — но заявку не сохраняют.
 */
export function parseLead(raw: unknown, now: number = Date.now()): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, bot: false, field: "form" };
  const body = raw as Record<string, unknown>;

  if (typeof body.website === "string" && body.website.trim() !== "") return { ok: false, bot: true };
  const started = Number(body.started_at);
  if (Number.isFinite(started) && started > 0 && now - started < MIN_FILL_MS) return { ok: false, bot: true };

  const name = text(body.name, LIMITS.name);
  if (!name) return { ok: false, bot: false, field: "name" };

  const email = text(body.email, LIMITS.email);
  if (!email || !EMAIL.test(email)) return { ok: false, bot: false, field: "email" };

  if (body.consent !== true) return { ok: false, bot: false, field: "consent" };

  const contact = text(body.contact, LIMITS.contact);
  if (contact === undefined) return { ok: false, bot: false, field: "contact" };
  const company = text(body.company, LIMITS.company);
  if (company === undefined) return { ok: false, bot: false, field: "company" };
  const message = text(body.message, LIMITS.message, { multiline: true });
  if (message === undefined) return { ok: false, bot: false, field: "message" };
  const useCase = oneOf(body.use_case, USE_CASES);
  if (useCase === undefined) return { ok: false, bot: false, field: "use_case" };
  const volume = oneOf(body.volume, VOLUMES);
  if (volume === undefined) return { ok: false, bot: false, field: "volume" };

  // Метки источника — не повод отказать человеку: слишком длинную просто не храним.
  const soft = (value: unknown, max: number) => text(value, max) ?? null;

  return {
    ok: true,
    lead: {
      name,
      email: email.toLowerCase(),
      contact,
      company,
      use_case: useCase,
      volume,
      message,
      lang: isLang(body.lang) ? body.lang : LOCALES[0],
      utm_source: soft(body.utm_source, LIMITS.utm),
      utm_medium: soft(body.utm_medium, LIMITS.utm),
      utm_campaign: soft(body.utm_campaign, LIMITS.utm),
      referrer: soft(body.referrer, LIMITS.referrer),
      landing_path: soft(body.landing_path, LIMITS.landingPath),
    },
  };
}

/** Правка заявки из админки: только статус и заметка. */
export function parseLeadPatch(raw: unknown): { status?: Status; admin_note?: string | null } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  const patch: { status?: Status; admin_note?: string | null } = {};
  if ("status" in body) {
    if (!STATUSES.includes(body.status as Status)) return null;
    patch.status = body.status as Status;
  }
  if ("admin_note" in body) {
    const note = text(body.admin_note, LIMITS.note, { multiline: true });
    if (note === undefined) return null;
    patch.admin_note = note;
  }
  return Object.keys(patch).length ? patch : null;
}
