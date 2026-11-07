/**
 * Минимальный клиент Telegram Bot API — без библиотек, на fetch.
 *
 * Токен бота — секрет. По устройству Bot API он входит в адрес запроса, поэтому
 * адрес нигде не печатается: ошибка сообщает только описание от Telegram.
 * Каждый вызов ограничен по времени — зависший Telegram не держит сайт.
 */
type Env = Record<string, string | undefined>;

export type TgResult<T> = { ok: true; result: T } | { ok: false; description: string; code?: number };

export type TelegramApi = {
  call<T = unknown>(method: string, params?: Record<string, unknown>): Promise<TgResult<T>>;
};

/** Токен из @BotFather (вид «123456789:AA…»). Опечатку или лишний текст не считаем токеном. */
export function botToken(env: Env = process.env): string | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  return /^\d{3,}:[A-Za-z0-9_-]{20,}$/.test(token) ? token : null;
}

/**
 * Адрес Bot API. Подменить его можно только вне Vercel — для проверок на своём
 * компьютере с поддельным Telegram. На проде токен уходит только в api.telegram.org.
 */
export function apiBase(env: Env = process.env): string {
  const custom = env.TELEGRAM_API_BASE?.trim();
  if (custom && !env.VERCEL) return custom.replace(/\/+$/, "");
  return "https://api.telegram.org";
}

/** Сайт в режиме проверки с поддельным Telegram: тогда допустим и адрес без https. */
export function isTestApi(env: Env = process.env): boolean {
  return apiBase(env) !== "https://api.telegram.org";
}

export function telegramApi(
  token: string,
  options: { env?: Env; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): TelegramApi {
  const base = apiBase(options.env ?? process.env);
  const doFetch = options.fetchImpl ?? fetch;
  return {
    async call<T>(method: string, params: Record<string, unknown> = {}): Promise<TgResult<T>> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 5000);
      try {
        const response = await doFetch(`${base}/bot${token}/${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as
          | { ok?: boolean; result?: unknown; description?: string; error_code?: number }
          | null;
        if (body?.ok) return { ok: true, result: body.result as T };
        return { ok: false, description: body?.description ?? `HTTP ${response.status}`, code: body?.error_code ?? response.status };
      } catch (error) {
        return { ok: false, description: (error as Error).name === "AbortError" ? "timeout" : "network error" };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
