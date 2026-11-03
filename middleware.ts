import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/admin/session.ts";
import { isLang, pickLocale } from "./lib/i18n.ts";

const LANG_COOKIE = "hs_lang";

/**
 * Три задачи по порядку:
 *   1. /admin — без действующей сессии только страница входа;
 *   2. /en|/ru|/kk/… — пропускаем, запоминаем язык, подсказываем его странице 404;
 *   3. всё остальное — редирект на язык по cookie или по браузеру.
 * API и файлы middleware не трогает (см. matcher).
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const signedIn = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    const loginPage = pathname === "/admin/login";
    if (!signedIn && !loginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    if (signedIn && loginPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const first = pathname.split("/")[1];
  if (isLang(first)) {
    const forwarded = new Headers(request.headers);
    forwarded.set("x-hs-lang", first);
    const response = NextResponse.next({ request: { headers: forwarded } });
    if (request.cookies.get(LANG_COOKIE)?.value !== first) {
      response.cookies.set(LANG_COOKIE, first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }
    return response;
  }

  const saved = request.cookies.get(LANG_COOKIE)?.value;
  const lang = isLang(saved) ? saved : pickLocale(request.headers.get("accept-language"));
  const url = request.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.redirect(url);
}

export const config = {
  // Мимо API, внутренностей Next и любых файлов с расширением (картинки, robots.txt, sitemap.xml).
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
