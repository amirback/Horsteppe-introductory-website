/**
 * Где живут заявки.
 *
 * На проде — таблица intro_leads в Supabase проекта Horsteppe. Локально без
 * ключей — файл в .data/ для разработки и проверок. На Vercel файловое
 * хранилище запрещено даже по ошибке в настройках: диск там временный, и
 * заявки пропадали бы молча. Без базы на проде хранилища нет вовсе — форма
 * честно скажет, что запись временно недоступна.
 */
import type { Lead, NewLead, Status } from "./schema.ts";
import { FileLeadStore } from "./file-store.ts";
import { SupabaseLeadStore } from "./supabase-store.ts";

export type LeadMeta = { country: string | null; city: string | null };
export type SaveResult = { lead: Lead; created: boolean };
export type LeadPatch = { status?: Status; admin_note?: string | null };
/** Чат Telegram, подключённый к заявкам из админки: туда бот шлёт новые заявки. */
export type TelegramChat = { chat_id: number; title: string | null; linked_at: string };

export interface LeadStore {
  readonly kind: "supabase" | "file";
  saveLead(input: NewLead, meta: LeadMeta, now?: Date): Promise<SaveResult>;
  listLeads(limit?: number): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | null>;
  updateLead(id: string, patch: LeadPatch): Promise<Lead | null>;
  deleteLead(id: string): Promise<boolean>;
  countEvents(kind: string, key: string, since: Date): Promise<number>;
  addEvent(kind: string, key: string, now?: Date): Promise<void>;
  /** Нет таблицы чатов — MissingTableError (свежий SQL ещё не выполнен). */
  listChats(): Promise<TelegramChat[]>;
  addChat(chat: { chat_id: number; title: string | null }): Promise<void>;
  removeChat(chatId: number): Promise<boolean>;
}

type Env = Record<string, string | undefined>;

export function storeConfig(env: Env = process.env): { url: string; key: string } | null {
  const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "").trim();
  return url && key ? { url, key } : null;
}

export function getStore(env: Env = process.env): LeadStore | null {
  const config = storeConfig(env);
  if (config) return new SupabaseLeadStore(config.url, config.key);
  if (env.VERCEL) return null;
  if (env.NODE_ENV !== "production" || env.LEADS_FILE_STORE === "1") {
    return new FileLeadStore(env.LEADS_FILE_DIR || ".data");
  }
  return null;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
