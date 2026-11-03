/**
 * Вход в админку по паролю.
 *
 * Пароль — переменная окружения ADMIN_PASSWORD. Сессия — cookie вида
 * `<срок>.<подпись>`, подписанная ключом, выведенным из пароля (и необязательного
 * ADMIN_SESSION_SECRET). Смена пароля разом выключает все сессии и меняет
 * секретную ссылку для Google Таблицы: одно действие, и доступ отозван у всех.
 */
import { hmac, safeEqual } from "../security.ts";

export const SESSION_COOKIE = "hs_admin";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;

type Env = Record<string, string | undefined>;

export function adminPassword(env: Env = process.env): string | null {
  const value = env.ADMIN_PASSWORD?.trim() ?? "";
  return value.length >= MIN_PASSWORD_LENGTH ? value : null;
}

function secretOf(password: string, env: Env): string {
  return `horsteppe-admin|${env.ADMIN_SESSION_SECRET ?? ""}|${password}`;
}

export async function passwordMatches(given: unknown, env: Env = process.env): Promise<boolean> {
  const expected = adminPassword(env);
  if (!expected || typeof given !== "string" || given.length > 512) return false;
  // Сравниваются подписи равной длины, а не сами строки: длина пароля не утекает.
  const [a, b] = await Promise.all([hmac("pw-compare", given), hmac("pw-compare", expected)]);
  return safeEqual(a, b);
}

export async function signSession(env: Env = process.env, now: number = Date.now()): Promise<string | null> {
  const password = adminPassword(env);
  if (!password) return null;
  const expires = now + SESSION_TTL_MS;
  return `${expires}.${await hmac(secretOf(password, env), `session:${expires}`)}`;
}

export async function verifySession(
  token: string | undefined | null,
  env: Env = process.env,
  now: number = Date.now(),
): Promise<boolean> {
  const password = adminPassword(env);
  if (!password || !token) return false;
  const [rawExpires, signature] = token.split(".");
  const expires = Number(rawExpires);
  if (!signature || !Number.isFinite(expires) || expires <= now || expires - now > SESSION_TTL_MS + 60_000) return false;
  return safeEqual(signature, await hmac(secretOf(password, env), `session:${expires}`));
}

/** Ключ ссылки для Google Таблицы. Меняется вместе с паролем. */
export async function sheetsKey(env: Env = process.env): Promise<string | null> {
  const password = adminPassword(env);
  if (!password) return null;
  return (await hmac(secretOf(password, env), "sheets-export-v1")).slice(0, 40);
}

export async function sheetsKeyMatches(given: string | null, env: Env = process.env): Promise<boolean> {
  const expected = await sheetsKey(env);
  return !!expected && !!given && safeEqual(given, expected);
}
