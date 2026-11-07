/**
 * Таблицы нет в базе — значит, основатель ещё не выполнил свежий SQL из
 * supabase/intro_leads.sql. Это отдельная ошибка: её показывают человеку
 * с подсказкой, что сделать, а не как «что-то сломалось».
 */
export class MissingTableError extends Error {
  readonly table: string;

  constructor(table: string) {
    super(`table ${table} is missing — run supabase/intro_leads.sql`);
    this.table = table;
  }
}

/** Коды «таблицы нет»: PostgREST (схема без таблицы) и сам Postgres. */
export function isMissingTable(code: string | undefined): boolean {
  return code === "PGRST205" || code === "42P01";
}
