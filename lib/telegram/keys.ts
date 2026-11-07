/**
 * Два секрета бота.
 *
 * 1. Секрет вебхука: Telegram присылает его в заголовке каждого обновления,
 *    сайт сверяет. Без него любой мог бы слать сайту поддельные «сообщения от
 *    Telegram». Выводится из токена — меняется только вместе с ботом, так что
 *    смена пароля админки бота не ломает.
 *
 * 2. Код подключения чата: ссылка https://t.me/<бот>?start=<код> из админки.
 *    Подписан ключом из пароля админки и токена и живёт 30 минут: без входа в
 *    админку чужой человек свой чат к заявкам не подключит.
 */
import { adminSigningSecret } from "../admin/session.ts";
import { hmac, safeEqual } from "../security.ts";

type Env = Record<string, string | undefined>;

export const LINK_TTL_MS = 30 * 60 * 1000;

export async function webhookSecret(token: string): Promise<string> {
  return hmac(`horsteppe-tg-webhook|${token}`, "webhook-v1");
}

async function linkSignature(token: string, secret: string, expires: number): Promise<string> {
  return (await hmac(`horsteppe-tg-link|${secret}|${token}`, `link:${expires}`)).slice(0, 32);
}

/** Код для ссылки подключения. Только буквы, цифры и «_» — так требует Telegram (до 64 символов). */
export async function makeLinkCode(token: string, env: Env = process.env, now: number = Date.now()): Promise<string | null> {
  const secret = adminSigningSecret(env);
  if (!secret) return null;
  const expires = Math.floor((now + LINK_TTL_MS) / 1000);
  return `L${expires.toString(36)}_${await linkSignature(token, secret, expires)}`;
}

export async function checkLinkCode(code: string, token: string, env: Env = process.env, now: number = Date.now()): Promise<boolean> {
  const match = /^L([0-9a-z]{1,10})_([0-9a-f]{32})$/.exec(code);
  const secret = adminSigningSecret(env);
  if (!match || !secret) return false;
  const expires = parseInt(match[1], 36);
  if (!Number.isFinite(expires) || expires * 1000 < now || expires * 1000 - now > LINK_TTL_MS + 60_000) return false;
  return safeEqual(match[2], await linkSignature(token, secret, expires));
}
