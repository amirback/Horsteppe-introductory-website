/**
 * Полная проверка сайта и админки на настоящей production-сборке.
 *
 * Поднимает `next start` с файловым хранилищем во временной папке (без
 * Supabase, без Telegram — ничего внешнего), затем Chrome без окна проходит
 * сайт как человек: три языка × телефон и ноутбук, форма заявки, вход в
 * админку, статус, заметка, Google-ссылка, выход. Скриншоты — в qa-output/.
 *
 * Запуск: npm run build && npm run qa
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { evaluate, go, launch, openPage, screenshot, sleep, waitFor } from "./cdp.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const OUT = path.join(ROOT, "qa-output");
const DATA = path.join(OUT, "data");
const SHOTS = path.join(OUT, "screens");
const PORT = Number(process.env.QA_PORT || 3471);
const BASE = `http://localhost:${PORT}`;
const PASSWORD = "qa-admin-password-2026";

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(ok, label, extra = "") {
  results.push({ ok: !!ok, label });
  console.log(`${ok ? "✓" : "✗"} ${label}${extra ? `  — ${extra}` : ""}`);
}

// ---------------------------------------------------------------- сервер ---
const env = { ...process.env, NODE_ENV: "production", LEADS_FILE_STORE: "1", LEADS_FILE_DIR: DATA, ADMIN_PASSWORD: PASSWORD, PORT: String(PORT) };
for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "TELEGRAM_BOT_TOKEN", "VERCEL"]) delete env[key];
const server = spawn(path.join(ROOT, "node_modules/.bin/next"), ["start", "-p", String(PORT)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

let chrome;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${BASE}/en`, { redirect: "manual" })).status) break;
    } catch {
      await sleep(250);
    }
  }

  // ------------------------------------------------------------ HTTP ----
  const raw = (p, init) => fetch(`${BASE}${p}`, { redirect: "manual", ...init });
  for (const [accept, lang] of [["kk-KZ,kk;q=0.9", "kk"], ["ru-KZ,ru;q=0.9", "ru"], ["de-DE", "en"]]) {
    const r = await raw("/", { headers: { "accept-language": accept } });
    check(r.status === 307 && r.headers.get("location")?.endsWith(`/${lang}`), `«/» с ${accept} ведёт на /${lang}`, `${r.status} ${r.headers.get("location")}`);
  }
  const keepsQuery = await raw("/?utm_source=ig", { headers: { "accept-language": "ru" } });
  check(keepsQuery.headers.get("location")?.endsWith("/ru?utm_source=ig"), "редирект не теряет utm-метки", keepsQuery.headers.get("location"));
  for (const p of ["/en", "/ru", "/kk", "/en/privacy", "/ru/privacy", "/kk/privacy"]) {
    const r = await raw(p);
    check(r.status === 200, `${p} отвечает 200`, String(r.status));
  }
  const missing = await raw("/ru/no-such-page");
  check(missing.status === 404, "несуществующая страница — 404", String(missing.status));
  const home = await raw("/ru");
  const html = await home.text();
  for (const [header, value] of [["x-frame-options", "DENY"], ["x-content-type-options", "nosniff"], ["referrer-policy", "strict-origin-when-cross-origin"]]) {
    check(home.headers.get(header) === value, `заголовок ${header}`, home.headers.get(header) ?? "нет");
  }
  check(!home.headers.get("x-powered-by"), "X-Powered-By не выдаёт стек");
  check(html.includes('<html lang="ru"'), "у /ru язык документа ru");
  check(html.includes('hrefLang="kk"') || html.includes('hreflang="kk"'), "hreflang на казахскую версию");
  // Хост канонического адреса берётся при сборке (на Vercel — адрес проекта), здесь проверяем путь.
  check(/rel="canonical" href="https?:\/\/[^"]+\/ru"/.test(html), "канонический адрес ведёт на /ru");
  check(/<h1[^>]*>Опишите ролик/.test(html), "заголовок первого экрана отрисован сервером");
  const robots = await (await raw("/robots.txt")).text();
  check(robots.includes("Disallow: /admin") && robots.includes("sitemap.xml"), "robots.txt закрывает админку и знает карту сайта");
  const sitemap = await (await raw("/sitemap.xml")).text();
  check((sitemap.match(/<loc>/g) || []).length === 6, "в карте сайта 6 адресов", String((sitemap.match(/<loc>/g) || []).length));
  const adminRedirect = await raw("/admin");
  check(adminRedirect.status === 307 && adminRedirect.headers.get("location")?.endsWith("/admin/login"), "админка без входа уводит на /admin/login");
  const apiNoAuth = await raw("/api/admin/leads");
  check(apiNoAuth.status === 401, "API заявок без входа — 401", String(apiNoAuth.status));
  const adminLogin = await raw("/admin/login");
  check(adminLogin.headers.get("x-robots-tag")?.includes("noindex"), "админка помечена noindex");

  // --------------------------------------------------------- Chrome ----
  chrome = await launch();
  const page = await openPage();
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error" && !/favicon/.test(m.params.entry.url ?? "")) errors.push(`${m.params.entry.text} ${m.params.entry.url ?? ""}`);
  });
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("Log.enable");

  const viewports = { phone: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, laptop: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false } };

  for (const [device, vp] of Object.entries(viewports)) {
    await page.send("Emulation.setDeviceMetricsOverride", vp);
    for (const lang of ["en", "ru", "kk"]) {
      errors.length = 0;
      await go(page, `${BASE}/${lang}`, 900);
      const info = await evaluate(page, `({
        lang: document.documentElement.lang,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        h1: document.querySelector('h1')?.textContent ?? '',
        sections: ['features','how','for','access','faq'].filter(id => document.getElementById(id)).length,
        brokenImages: [...document.images].filter(i => i.complete && i.naturalWidth === 0).length,
        clipped: [...document.querySelectorAll('#main .truncate')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent),
      })`);
      check(info.clipped.length === 0, `${device} /${lang}: ни одна надпись не обрезана`, info.clipped.join(", "));
      check(info.lang === lang, `${device} /${lang}: язык документа`, info.lang);
      check(info.overflow <= 0, `${device} /${lang}: нет горизонтальной прокрутки`, `${info.overflow}px`);
      check(info.sections === 5, `${device} /${lang}: все разделы на месте`, String(info.sections));
      check(info.brokenImages === 0, `${device} /${lang}: нет битых картинок`);
      // Пройти страницу целиком: блоки проявляются при прокрутке.
      const height = await evaluate(page, "document.documentElement.scrollHeight");
      for (let y = 0; y < height; y += vp.height * 0.8) {
        await evaluate(page, `window.scrollTo(0, ${y})`);
        await sleep(120);
      }
      await sleep(900);
      const hidden = await evaluate(page, `[...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity !== '1').length`);
      check(hidden === 0, `${device} /${lang}: после прокрутки видно всё`, `${hidden} скрытых`);
      check(errors.length === 0, `${device} /${lang}: 0 ошибок в консоли`, errors.slice(0, 2).join(" | "));
      if (lang === "ru" || device === "laptop") {
        for (const id of ["top", "features", "for", "access", "faq"]) {
          await evaluate(page, id === "top" ? "window.scrollTo(0,0)" : `document.getElementById('${id}').scrollIntoView()`);
          await sleep(500);
          await screenshot(page, path.join(SHOTS, `${device}-${lang}-${id}.png`));
        }
      }
    }
  }

  // Мобильное меню
  await page.send("Emulation.setDeviceMetricsOverride", viewports.phone);
  await go(page, `${BASE}/ru`);
  await evaluate(page, `document.querySelector('button[aria-controls="mobile-menu"]').click()`);
  const menuOpen = await waitFor(page, `!!document.getElementById('mobile-menu')`);
  check(menuOpen, "телефон: меню открывается");
  await screenshot(page, path.join(SHOTS, "phone-ru-menu.png"));
  await evaluate(page, `document.querySelector('#mobile-menu a[href="#faq"]').click()`);
  check(await waitFor(page, `!document.getElementById('mobile-menu')`), "телефон: меню закрывается после выбора пункта");

  // Переключатель языка
  await evaluate(page, "window.scrollTo(0, document.body.scrollHeight)");
  await evaluate(page, `[...document.querySelectorAll('footer a')].find(a => a.textContent === 'KK').click()`);
  check(await waitFor(page, `location.pathname === '/kk' && document.documentElement.lang === 'kk'`), "переключатель языка ведёт на /kk");

  // Без JavaScript и с «уменьшить движение»
  await page.send("Emulation.setDeviceMetricsOverride", viewports.laptop);
  await page.send("Emulation.setScriptExecutionDisabled", { value: true });
  await go(page, `${BASE}/ru`);
  const noJs = await evaluate(page, `({ h1: !!document.querySelector('h1'), hidden: [...document.querySelectorAll('.reveal')].filter(e => getComputedStyle(e).opacity !== '1').length })`);
  check(noJs.h1 && noJs.hidden === 0, "без JavaScript всё содержимое видно", `${noJs.hidden} скрытых`);
  await page.send("Emulation.setScriptExecutionDisabled", { value: false });
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await go(page, `${BASE}/ru`);
  const calm = await evaluate(page, `getComputedStyle(document.querySelector('.demo-done')).opacity`);
  check(calm === "1", "«уменьшить движение»: показ работы застыл в готовом виде", calm);
  await page.send("Emulation.setEmulatedMedia", { features: [] });

  // ----------------------------------------------------------- форма ---
  await page.send("Emulation.setDeviceMetricsOverride", viewports.laptop);
  await go(page, `${BASE}/ru?utm_source=qa&utm_medium=test`);
  await evaluate(page, `document.getElementById('access').scrollIntoView()`);
  await sleep(400);
  await evaluate(page, `document.querySelector('#access form button[type=submit]').click()`);
  check(await waitFor(page, `document.querySelector('#access [role=alert]')?.textContent.includes('Укажите имя')`), "пустая форма: ошибка про имя, без запроса на сервер");
  await sleep(1700);
  await evaluate(page, `(() => {
    const f = document.querySelector('#access form');
    const set = (name, value) => { const el = f.elements[name]; el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
    set('name', 'Айгерим Тестова'); set('email', 'qa.lead@example.kz'); set('contact', '@aigerim_qa');
    set('company', 'Steppe Coffee'); set('use_case', 'product_ads'); set('volume', '6-20'); set('message', 'Реклама кофе для Reels');
    f.elements.consent.click();
    f.querySelector('button[type=submit]').click();
  })()`);
  const sent = await waitFor(page, `document.querySelector('#access [role=status]')?.textContent.includes('Заявка принята')`);
  check(sent, "форма: заявка отправлена, человек видит подтверждение");
  await screenshot(page, path.join(SHOTS, "laptop-ru-form-done.png"));
  const stored = JSON.parse(fs.readFileSync(path.join(DATA, "leads.json"), "utf8"));
  check(stored.length === 1 && stored[0].email === "qa.lead@example.kz", "форма: заявка записана в хранилище");
  check(stored[0].utm_source === "qa" && stored[0].lang === "ru" && stored[0].use_case === "product_ads", "форма: метки источника, язык и задача сохранены");

  // --------------------------------------------------------- админка ---
  await go(page, `${BASE}/admin`);
  check(await waitFor(page, `location.pathname === '/admin/login'`), "админка: без входа — страница входа");
  const setPassword = (value) => `(() => { const el = document.querySelector('input[name=password]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`;
  await evaluate(page, setPassword("wrong-password"));
  await evaluate(page, `document.querySelector('form button[type=submit]').click()`);
  check(await waitFor(page, `document.querySelector('[role=alert]')?.textContent.includes('Неверный пароль')`), "админка: неверный пароль отклонён");
  await evaluate(page, setPassword(PASSWORD));
  await evaluate(page, `document.querySelector('form button[type=submit]').click()`);
  check(await waitFor(page, `location.pathname === '/admin' && document.body.textContent.includes('Айгерим Тестова')`, 10000), "админка: вход и заявка в списке");
  await sleep(600);
  await screenshot(page, path.join(SHOTS, "laptop-admin.png"));

  await evaluate(page, `(() => { const s = document.querySelector('select[aria-label^="Статус заявки"]'); s.value = 'contacted'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(page, `document.body.textContent.includes('Сохранено')`);
  await sleep(300);
  check(JSON.parse(fs.readFileSync(path.join(DATA, "leads.json"), "utf8"))[0].status === "contacted", "админка: смена статуса сохранена");

  await evaluate(page, `[...document.querySelectorAll('table button')].find(b => b.textContent.includes('Айгерим')).click()`);
  check(await waitFor(page, `document.querySelector('[role=dialog]')?.textContent.includes('qa.lead@example.kz')`), "админка: карточка заявки открывается");
  check(await evaluate(page, `!![...document.querySelectorAll('[role=dialog] a')].find(a => a.href.startsWith('https://t.me/aigerim_qa'))`), "админка: ссылка на Telegram из контакта");
  await evaluate(page, `(() => { const t = document.querySelector('[role=dialog] textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(t, 'Созвон в пятницу'); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(page, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent === 'Сохранить заметку').click()`);
  await sleep(700);
  check(JSON.parse(fs.readFileSync(path.join(DATA, "leads.json"), "utf8"))[0].admin_note === "Созвон в пятницу", "админка: заметка сохранена");
  await screenshot(page, path.join(SHOTS, "laptop-admin-lead.png"));
  await evaluate(page, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

  await evaluate(page, `[...document.querySelectorAll('header button')].find(b => b.textContent === 'Google Таблица').click()`);
  const formula = (await waitFor(page, `!!document.querySelector('[role=dialog] .font-mono')`))
    ? await evaluate(page, `document.querySelector('[role=dialog] .font-mono').textContent`)
    : "";
  const sheetsUrl = String(formula).match(/IMPORTDATA\("([^"]+)"\)/)?.[1];
  check(!!sheetsUrl, "админка: формула для Google Таблицы", String(formula).slice(0, 60));
  if (sheetsUrl) {
    const csv = await (await fetch(sheetsUrl)).text();
    check(csv.startsWith("Дата заявки") && csv.includes("qa.lead@example.kz"), "Google Таблица получает CSV по ссылке без входа");
  }
  await screenshot(page, path.join(SHOTS, "laptop-admin-sheets.png"));
  await evaluate(page, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);

  await page.send("Emulation.setDeviceMetricsOverride", viewports.phone);
  await go(page, `${BASE}/admin`, 1200);
  check((await evaluate(page, "document.documentElement.scrollWidth - window.innerWidth")) <= 0, "админка на телефоне без горизонтальной прокрутки");
  await screenshot(page, path.join(SHOTS, "phone-admin.png"));
  await evaluate(page, `[...document.querySelectorAll('header button')].find(b => b.textContent === 'Выйти').click()`);
  check(await waitFor(page, `location.pathname === '/admin/login'`), "админка: выход возвращает на страницу входа");
  const after = await fetch(`${BASE}/api/admin/leads`);
  check(after.status === 401, "после выхода API снова закрыт");

  page.close();
} catch (error) {
  check(false, `стенд упал: ${error.message}`);
} finally {
  chrome?.proc.kill();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} проверок пройдено. Скриншоты: ${path.relative(ROOT, SHOTS)}/`);
if (failed.length) {
  if (/error/i.test(serverLog)) console.log("\nЛог сервера:\n" + serverLog.split("\n").filter((l) => /error/i.test(l)).slice(0, 10).join("\n"));
  process.exit(1);
}
