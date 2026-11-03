/**
 * Заявки в Supabase: таблицы intro_leads и intro_rate_events.
 *
 * Ключ — служебный, только на сервере. Клиент supabase-js выбран намеренно:
 * заголовки ключа он ставит ровно так же, как во всём остальном продукте
 * (apikey и Bearer для запросов к таблицам, с любым видом ключа — старым JWT
 * service_role или новым sb_secret_…). Ошибиться здесь вручную легко, а
 * заметно это станет только на проде.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Lead, NewLead } from "./schema.ts";
import type { LeadMeta, LeadPatch, LeadStore, SaveResult } from "./store.ts";

const LEADS = "intro_leads";
const EVENTS = "intro_rate_events";
export const LEAD_COLUMNS =
  "id,created_at,updated_at,last_submitted_at,submit_count,name,email,contact,company,use_case,volume," +
  "message,lang,country,city,utm_source,utm_medium,utm_campaign,referrer,landing_path,status,admin_note";

/** Отдельный класс, чтобы не тянуть store.ts по кругу ради одной ошибки. */
class SupabaseStoreError extends Error {}

function fail(what: string, error: { message?: string; code?: string } | null): never {
  throw new SupabaseStoreError(`${what}: ${error?.code ?? ""} ${error?.message ?? "unknown error"}`.trim());
}

export class SupabaseLeadStore implements LeadStore {
  readonly kind = "supabase" as const;
  private readonly db: SupabaseClient;

  constructor(url: string, key: string, fetchImpl?: typeof fetch) {
    this.db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
    });
  }

  async saveLead(input: NewLead, meta: LeadMeta, now: Date = new Date(), retry = true): Promise<SaveResult> {
    const stamp = now.toISOString();
    const found = await this.db.from(LEADS).select("id,submit_count").eq("email", input.email).maybeSingle();
    if (found.error) fail("lookup", found.error);

    if (found.data) {
      // Повторная заявка того же человека: прежние ответы не затираем пустыми.
      const fresh = Object.fromEntries(Object.entries({ ...input, ...meta }).filter(([, v]) => v !== null));
      const { data, error } = await this.db
        .from(LEADS)
        .update({ ...fresh, last_submitted_at: stamp, submit_count: Number(found.data.submit_count || 1) + 1 })
        .eq("id", found.data.id)
        .select(LEAD_COLUMNS)
        .single();
      if (error) fail("update", error);
      return { lead: data as unknown as Lead, created: false };
    }

    const { data, error } = await this.db
      .from(LEADS)
      .insert({ ...input, ...meta, last_submitted_at: stamp })
      .select(LEAD_COLUMNS)
      .single();
    if (error) {
      // Та же почта в ту же секунду — второй запрос просто становится повтором.
      if (error.code === "23505" && retry) return this.saveLead(input, meta, now, false);
      fail("insert", error);
    }
    return { lead: data as unknown as Lead, created: true };
  }

  async listLeads(limit = 5000): Promise<Lead[]> {
    const { data, error } = await this.db
      .from(LEADS)
      .select(LEAD_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("list", error);
    return (data ?? []) as unknown as Lead[];
  }

  async updateLead(id: string, patch: LeadPatch): Promise<Lead | null> {
    const { data, error } = await this.db.from(LEADS).update(patch).eq("id", id).select(LEAD_COLUMNS).maybeSingle();
    if (error) fail("patch", error);
    return (data as unknown as Lead) ?? null;
  }

  async deleteLead(id: string): Promise<boolean> {
    const { data, error } = await this.db.from(LEADS).delete().eq("id", id).select("id");
    if (error) fail("delete", error);
    return (data ?? []).length > 0;
  }

  async countEvents(kind: string, key: string, since: Date): Promise<number> {
    const { count, error } = await this.db
      .from(EVENTS)
      .select("id", { count: "exact", head: true })
      .eq("kind", kind)
      .eq("key_hash", key)
      .gte("created_at", since.toISOString());
    if (error) fail("count", error);
    return count ?? 0;
  }

  async addEvent(kind: string, key: string, now: Date = new Date()): Promise<void> {
    const { error } = await this.db.from(EVENTS).insert({ kind, key_hash: key, created_at: now.toISOString() });
    if (error) fail("event", error);
    // Старые отметки не нужны никому: изредка подчищаем то, что старше двух суток.
    if (Math.random() < 0.05) {
      const cutoff = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
      await this.db.from(EVENTS).delete().lt("created_at", cutoff);
    }
  }
}
