/** Что можно честно узнать о посетителе из заголовков запроса. */

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Страна и город по IP — их кладёт Vercel. Сам адрес не храним: этого
 * хватает, чтобы понимать, откуда спрос, и не собирать лишнего.
 */
export function geo(headers: Headers): { country: string | null; city: string | null } {
  const country = headers.get("x-vercel-ip-country")?.trim().toUpperCase() || null;
  let city = headers.get("x-vercel-ip-city")?.trim() || null;
  if (city) {
    try {
      city = decodeURIComponent(city);
    } catch {
      // оставляем как пришло
    }
    city = city.slice(0, 80);
  }
  return { country: country && /^[A-Z]{2}$/.test(country) ? country : null, city };
}

/**
 * Запрос на изменение пришёл с нашего же сайта. Cookie сессии и так не
 * уходит с чужих сайтов (SameSite), это вторая линия защиты от CSRF.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}
