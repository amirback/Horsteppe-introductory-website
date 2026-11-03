/**
 * Логика API — отдельно от маршрутов Next.js, чтобы её можно было проверить
 * тестом без сервера. Маршрут только подставляет хранилище и окружение.
 */
import {
  SESSION_COOKIE, SESSION_TTL_MS, adminPassword, passwordMatches, sheetsKey, sheetsKeyMatches, signSession,
  verifySession,
} from "./admin/session.ts";
import { leadsCsv } from "./csv.ts";
import { parseLead, parseLeadPatch } from "./leads/schema.ts";
import type { Lead } from "./leads/schema.ts";
import { UUID, storeConfig, type LeadStore } from "./leads/store.ts";
import { clientIp, geo, sameOrigin } from "./request.ts";
import { ipKey, sha256 } from "./security.ts";

type Env = Record<string, string | undefined>;
type Deps = {
  store: LeadStore | null;
  env?: Env;
  now?: Date;
  /** Работа после ответа (уведомление). В маршруте это next/server after(). */
  defer?: (task: () => Promise<unknown>) => void;
  notify?: (lead: Lead, created: boolean) => Promise<unknown>;
};

const HOUR = 60 * 60 * 1000;
export const LIMITS = {
  leadPerIp: { count: 5, windowMs: HOUR },
  leadGlobal: { count: 300, windowMs: HOUR },
  adminFail: { count: 8, windowMs: 15 * 60 * 1000 },
} as const;
const MAX_BODY = 16 * 1024;

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...NO_STORE, ...headers },
  });
}

async function readJson(request: Request): Promise<unknown | undefined> {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return undefined;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return undefined;
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Соль для хеша IP: секретная, иначе хеш адреса IPv4 перебирается за минуты. */
async function rateSalt(env: Env): Promise<string> {
  return sha256(`salt|${storeConfig(env)?.key ?? ""}|${env.ADMIN_PASSWORD ?? ""}|${env.RATE_LIMIT_SALT ?? "local"}`);
}

async function overLimit(store: LeadStore, kind: string, key: string, rule: { count: number; windowMs: number }, now: Date) {
  return (await store.countEvents(kind, key, new Date(now.getTime() - rule.windowMs))) >= rule.count;
}

// ------------------------------------------------------------- заявка ----

export async function handleLead(request: Request, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? new Date();
  const store = deps.store;
  // Без хранилища заявку некуда положить. Притворяться успехом нельзя —
  // человек ушёл бы ждать ответа, которого не будет.
  if (!store) return json({ error: "unavailable" }, 503);

  const body = await readJson(request);
  if (body === undefined) return json({ error: "invalid", field: "form" }, 400);

  const parsed = parseLead(body, now.getTime());
  // Боту отвечаем как человеку — так он не учится обходить ловушку.
  if (!parsed.ok && parsed.bot) return json({ ok: true });
  if (!parsed.ok) return json({ error: "invalid", field: parsed.field }, 400);

  try {
    const key = await ipKey(clientIp(request.headers), await rateSalt(env));
    if (
      (await overLimit(store, "lead", key, LIMITS.leadPerIp, now)) ||
      (await overLimit(store, "lead_all", "all", LIMITS.leadGlobal, now))
    ) {
      return json({ error: "rate_limited" }, 429);
    }
    await store.addEvent("lead", key, now);
    await store.addEvent("lead_all", "all", now);

    const { lead, created } = await store.saveLead(parsed.lead, geo(request.headers), now);
    if (deps.notify) {
      const notify = deps.notify;
      const task = () => notify(lead, created).catch(() => undefined);
      if (deps.defer) deps.defer(task);
      else await task();
    }
    return json({ ok: true });
  } catch (error) {
    console.error("lead: store failed —", (error as Error).message);
    return json({ error: "unavailable" }, 503);
  }
}

// ------------------------------------------------------------- админка ----

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function isAdmin(request: Request, env: Env = process.env, now: number = Date.now()): Promise<boolean> {
  return verifySession(readCookie(request, SESSION_COOKIE), env, now);
}

function secureCookie(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.replace(":", "");
  return proto === "https";
}

function sessionCookie(value: string, maxAgeSec: number, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSec}`,
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export async function handleLogin(request: Request, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? new Date();
  if (!adminPassword(env)) return json({ error: "admin_not_configured" }, 503);
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);

  const body = (await readJson(request)) as { password?: unknown } | undefined;
  const key = await ipKey(clientIp(request.headers), await rateSalt(env));
  const store = deps.store;
  try {
    if (store && (await overLimit(store, "admin_fail", key, LIMITS.adminFail, now))) {
      return json({ error: "too_many_attempts" }, 429);
    }
  } catch (error) {
    console.error("login: rate check failed —", (error as Error).message);
  }

  if (!(await passwordMatches(body?.password, env))) {
    try {
      await store?.addEvent("admin_fail", key, now);
    } catch {
      // запись неудачи вторична
    }
    return json({ error: "wrong_password" }, 401);
  }

  const token = await signSession(env, now.getTime());
  return json({ ok: true }, 200, {
    "Set-Cookie": sessionCookie(token!, Math.floor(SESSION_TTL_MS / 1000), secureCookie(request)),
  });
}

export function handleLogout(request: Request): Response {
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0, secureCookie(request)) });
}

export async function handleList(request: Request, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!(await isAdmin(request, env, (deps.now ?? new Date()).getTime()))) return json({ error: "unauthorized" }, 401);
  if (!deps.store) return json({ error: "store_unavailable" }, 503);
  try {
    const leads = await deps.store.listLeads();
    const origin = new URL(request.url).origin;
    const key = await sheetsKey(env);
    return json({
      leads,
      storage: deps.store.kind,
      sheetsUrl: key ? `${origin}/api/admin/export?key=${key}` : null,
    });
  } catch (error) {
    console.error("admin list failed —", (error as Error).message);
    return json({ error: "store_unavailable" }, 503);
  }
}

export async function handleUpdate(request: Request, id: string, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!(await isAdmin(request, env, (deps.now ?? new Date()).getTime()))) return json({ error: "unauthorized" }, 401);
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (!UUID.test(id)) return json({ error: "not_found" }, 404);
  if (!deps.store) return json({ error: "store_unavailable" }, 503);
  const patch = parseLeadPatch(await readJson(request));
  if (!patch) return json({ error: "invalid" }, 400);
  try {
    const lead = await deps.store.updateLead(id, patch);
    return lead ? json({ lead }) : json({ error: "not_found" }, 404);
  } catch (error) {
    console.error("admin update failed —", (error as Error).message);
    return json({ error: "store_unavailable" }, 503);
  }
}

export async function handleDelete(request: Request, id: string, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!(await isAdmin(request, env, (deps.now ?? new Date()).getTime()))) return json({ error: "unauthorized" }, 401);
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (!UUID.test(id)) return json({ error: "not_found" }, 404);
  if (!deps.store) return json({ error: "store_unavailable" }, 503);
  try {
    return (await deps.store.deleteLead(id)) ? json({ ok: true }) : json({ error: "not_found" }, 404);
  } catch (error) {
    console.error("admin delete failed —", (error as Error).message);
    return json({ error: "store_unavailable" }, 503);
  }
}

/**
 * CSV для скачивания и для Google Таблиц. Доступ — по сессии или по
 * секретному ключу в ссылке: Google забирает данные своим сервером, без cookie.
 */
export async function handleExport(request: Request, deps: Deps): Promise<Response> {
  const env = deps.env ?? process.env;
  const url = new URL(request.url);
  const byKey = await sheetsKeyMatches(url.searchParams.get("key"), env);
  if (!byKey && !(await isAdmin(request, env, (deps.now ?? new Date()).getTime()))) {
    return new Response("unauthorized", { status: 401, headers: NO_STORE });
  }
  if (!deps.store) return new Response("store unavailable", { status: 503, headers: NO_STORE });
  try {
    const leads = await deps.store.listLeads();
    // Excel без метки BOM путает кириллицу; Google Таблице метка не нужна.
    const csv = leadsCsv(leads, { bom: !byKey && url.searchParams.get("bom") !== "0" });
    const day = (deps.now ?? new Date()).toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `${byKey ? "inline" : "attachment"}; filename="horsteppe-leads-${day}.csv"`,
        ...NO_STORE,
      },
    });
  } catch (error) {
    console.error("admin export failed —", (error as Error).message);
    return new Response("store unavailable", { status: 503, headers: NO_STORE });
  }
}
