/**
 * Заявки в файле — только для разработки и проверок на своей машине.
 *
 * Поведение повторяет Supabase-хранилище: дедупликация по почте, повтор не
 * затирает прежние ответы пустыми, новые сверху. Запись последовательная и
 * атомарная (временный файл + переименование), чтобы проверка с параллельными
 * запросами не ломала JSON.
 */
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Lead, NewLead } from "./schema.ts";
import type { LeadMeta, LeadPatch, LeadStore, SaveResult } from "./store.ts";

type Event = { kind: string; key_hash: string; created_at: string };

export class FileLeadStore implements LeadStore {
  readonly kind = "file" as const;
  private readonly dir: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.dir = dir;
  }

  private async read<T>(name: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await fs.readFile(path.join(this.dir, name), "utf8")) as T;
    } catch {
      return fallback;
    }
  }

  private async write(name: string, value: unknown): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const target = path.join(this.dir, name);
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(value, null, 2), "utf8");
    await fs.rename(temp, target);
  }

  /** Все изменения — строго по одному. */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  saveLead(input: NewLead, meta: LeadMeta, now: Date = new Date()): Promise<SaveResult> {
    return this.serial(async () => {
      const leads = await this.read<Lead[]>("leads.json", []);
      const stamp = now.toISOString();
      const existing = leads.find((l) => l.email === input.email);
      if (existing) {
        for (const [k, v] of Object.entries({ ...input, ...meta })) {
          if (v !== null) (existing as Record<string, unknown>)[k] = v;
        }
        existing.last_submitted_at = stamp;
        existing.updated_at = stamp;
        existing.submit_count += 1;
        await this.write("leads.json", leads);
        return { lead: existing, created: false };
      }
      const lead: Lead = {
        ...input,
        ...meta,
        id: randomUUID(),
        created_at: stamp,
        updated_at: stamp,
        last_submitted_at: stamp,
        submit_count: 1,
        status: "new",
        admin_note: null,
      };
      leads.unshift(lead);
      await this.write("leads.json", leads);
      return { lead, created: true };
    });
  }

  async listLeads(limit = 5000): Promise<Lead[]> {
    const leads = await this.read<Lead[]>("leads.json", []);
    return [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  }

  updateLead(id: string, patch: LeadPatch): Promise<Lead | null> {
    return this.serial(async () => {
      const leads = await this.read<Lead[]>("leads.json", []);
      const lead = leads.find((l) => l.id === id);
      if (!lead) return null;
      Object.assign(lead, patch, { updated_at: new Date().toISOString() });
      await this.write("leads.json", leads);
      return lead;
    });
  }

  deleteLead(id: string): Promise<boolean> {
    return this.serial(async () => {
      const leads = await this.read<Lead[]>("leads.json", []);
      const kept = leads.filter((l) => l.id !== id);
      if (kept.length === leads.length) return false;
      await this.write("leads.json", kept);
      return true;
    });
  }

  async countEvents(kind: string, key: string, since: Date): Promise<number> {
    const events = await this.read<Event[]>("events.json", []);
    const from = since.toISOString();
    return events.filter((e) => e.kind === kind && e.key_hash === key && e.created_at >= from).length;
  }

  addEvent(kind: string, key: string, now: Date = new Date()): Promise<void> {
    return this.serial(async () => {
      const events = await this.read<Event[]>("events.json", []);
      const cutoff = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
      const kept = events.filter((e) => e.created_at >= cutoff);
      kept.push({ kind, key_hash: key, created_at: now.toISOString() });
      await this.write("events.json", kept);
    });
  }
}
