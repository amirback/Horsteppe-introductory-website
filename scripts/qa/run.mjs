/**
 * Полная проверка сайта и админки на настоящей production-сборке.
 *
 * Поднимает `next start` с файловым хранилищем во временной папке (без
 * Supabase, без Telegram — ничего внешнего), затем Chrome без окна проходит
 * сайт как человек: три языка × телефон и ноутбук, затем три языка × 16
 * размеров экрана (вёрстка, цели для пальца), меню телефона, форма заявки,
 * вход в админку, статус, заметка, Google-ссылка, выход. Скриншоты — в qa-output/.
 *
 * Запуск: npm run build && npm run qa
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
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

// ----------------------------------------------------- поддельный Telegram ---
// Сайт ходит в него вместо api.telegram.org (TELEGRAM_API_BASE работает только вне Vercel).
const TG_PORT = Number(process.env.QA_TG_PORT || 3472);
const TG_TOKEN = "123456789:QA-test-token-not-a-real-bot-000";
const tgCalls = [];
let tgWebhook = { url: "", secret: "" };
const tg = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const method = req.url.split("/").pop();
    let params = {};
    try {
      params = JSON.parse(raw || "{}");
    } catch {
      // пусто
    }
    tgCalls.push({ method, params });
    if (method === "setWebhook") tgWebhook = { url: params.url, secret: params.secret_token };
    const result =
      method === "getMe" ? { id: 1, is_bot: true, first_name: "Horsteppe Заявки", username: "horsteppe_qa_bot" }
        : method === "getWebhookInfo" ? { url: tgWebhook.url, pending_update_count: 0 }
          : method === "sendMessage" ? { message_id: tgCalls.length, chat: { id: params.chat_id } }
            : true;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, result }));
  });
});
await new Promise((resolve) => tg.listen(TG_PORT, "127.0.0.1", resolve));

// ---------------------------------------------------------------- сервер ---
const env = { ...process.env, NODE_ENV: "production", LEADS_FILE_STORE: "1", LEADS_FILE_DIR: DATA, ADMIN_PASSWORD: PASSWORD, PORT: String(PORT) };
for (const key of ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "VERCEL"]) delete env[key];
Object.assign(env, { TELEGRAM_BOT_TOKEN: TG_TOKEN, TELEGRAM_API_BASE: `http://127.0.0.1:${TG_PORT}` });
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

  // ---------------------------------------------- все размеры экранов ---
  // Телефоны (узкие и широкие, вертикально и горизонтально), планшеты, ноутбуки, большие мониторы.
  const MATRIX = [
    ["320x568", 320, 568, true], ["360x800", 360, 800, true], ["375x667", 375, 667, true],
    ["390x844", 390, 844, true], ["414x896", 414, 896, true], ["430x932", 430, 932, true],
    ["568x320", 568, 320, true], ["844x390", 844, 390, true], ["932x430", 932, 430, true],
    ["768x1024", 768, 1024, true], ["820x1180", 820, 1180, true], ["1024x768", 1024, 768, true],
    ["1280x800", 1280, 800, false], ["1440x900", 1440, 900, false], ["1920x1080", 1920, 1080, false],
    ["2560x1440", 2560, 1440, false],
  ];
  // Что считается поломкой вёрстки на любом экране.
  const LAYOUT = `(() => {
    const vw = window.innerWidth;
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"], .sr-only'); };
    const blocks = [...document.querySelectorAll('h1, h2, h3, p, li, dt, dd, label, summary, button, a.btn, th, td')]
      .filter((el) => visible(el) && getComputedStyle(el).display !== 'inline' && getComputedStyle(el).overflowX === 'visible');
    const spill = blocks.filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => el.tagName + ': ' + el.textContent.trim().slice(0, 40));
    const clipped = [...document.querySelectorAll('.truncate')].filter((e) => visible(e) && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim());
    // Цели для пальца: не меньше 24×24 (WCAG 2.5.8). Исключения стандарта: ссылка внутри строки
    // текста и галочка внутри подписи — нажимается вся подпись целиком.
    const targets = [...document.querySelectorAll('a, button, summary, select, input:not([type=hidden]), textarea')]
      .filter((el) => visible(el) && el.tabIndex !== -1 && getComputedStyle(el).display !== 'inline'
        && !(el.type === 'checkbox' && el.closest('label')));
    const small = targets.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; })
      .map((el) => (el.getAttribute('aria-label') || el.textContent.trim() || el.name || el.tagName).slice(0, 30) + ' ' + Math.round(el.getBoundingClientRect().width) + '×' + Math.round(el.getBoundingClientRect().height));
    return { overflow: document.documentElement.scrollWidth - vw, spill, clipped, small, broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length };
  })()`;
  for (const [name, width, height, touch] of MATRIX) {
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: touch });
    for (const lang of ["ru", "kk", "en"]) {
      await go(page, `${BASE}/${lang}`, 300);
      await evaluate(page, "document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-visible'))");
      await evaluate(page, "document.fonts.ready.then(() => true)");
      const r = await evaluate(page, LAYOUT);
      const problems = [
        r.overflow > 0 ? `горизонтальная прокрутка ${r.overflow}px` : "",
        r.spill.length ? `текст вылезает: ${r.spill.slice(0, 3).join(" | ")}` : "",
        r.clipped.length ? `обрезано: ${r.clipped.slice(0, 3).join(", ")}` : "",
        r.broken ? `битых картинок ${r.broken}` : "",
        touch && r.small.length ? `мелкие цели: ${r.small.slice(0, 4).join(", ")}` : "",
      ].filter(Boolean);
      check(problems.length === 0, `${name} /${lang}: вёрстка цела`, problems.join("; "));
      if (lang === "ru" && ["320x568", "844x390", "768x1024", "1024x768", "2560x1440"].includes(name)) {
        await screenshot(page, path.join(SHOTS, `matrix-${name}-ru.png`));
      }
    }
  }

  // Казахские буквы рисует шрифт заголовков, а не запасной системный.
  await page.send("Emulation.setDeviceMetricsOverride", viewports.laptop);
  await go(page, `${BASE}/kk`, 600);
  const kkGlyphs = await evaluate(page, `(async () => {
    const family = getComputedStyle(document.querySelector('h1')).fontFamily;
    const sample = 'әғқңөұүһі ӘҒҚҢӨҰҮҺІ';
    await document.fonts.load('600 40px ' + family, sample);
    const ctx = document.createElement('canvas').getContext('2d');
    const width = (font) => { ctx.font = font; return ctx.measureText(sample).width; };
    // Если букв в шрифте нет, ширина совпадёт с запасным моноширинным.
    return { family: family.split(',')[0], own: width('600 40px ' + family.split(',')[0] + ', monospace'), mono: width('600 40px monospace') };
  })()`);
  check(Math.abs(kkGlyphs.own - kkGlyphs.mono) > 5, "казахские буквы — в шрифте заголовков", `${kkGlyphs.family}: ${Math.round(kkGlyphs.own)} против ${Math.round(kkGlyphs.mono)}`);

  // Мобильное меню
  await page.send("Emulation.setDeviceMetricsOverride", viewports.phone);
  await go(page, `${BASE}/ru`);
  await evaluate(page, `document.querySelector('button[aria-controls="mobile-menu"]').click()`);
  const menuOpen = await waitFor(page, `!!document.getElementById('mobile-menu')`);
  check(menuOpen, "телефон: меню открывается");
  await sleep(300);
  await screenshot(page, path.join(SHOTS, "phone-ru-menu.png"));
  await evaluate(page, `document.querySelector('#mobile-menu a[href="#faq"]').click()`);
  check(await waitFor(page, `!document.getElementById('mobile-menu')`), "телефон: меню закрывается после выбора пункта");

  // Горизонтальный телефон: экран низкий, меню должно прокручиваться до кнопки заявки.
  await page.send("Emulation.setDeviceMetricsOverride", { width: 844, height: 390, deviceScaleFactor: 1, mobile: true });
  await go(page, `${BASE}/kk`);
  await evaluate(page, `document.querySelector('button[aria-controls="mobile-menu"]').click()`);
  await waitFor(page, `!!document.getElementById('mobile-menu')`);
  const landscapeMenu = await evaluate(page, `(() => {
    const menu = document.getElementById('mobile-menu');
    const cta = menu.querySelector('.btn-gold');
    menu.scrollTop = menu.scrollHeight;
    const r = cta.getBoundingClientRect();
    return { scrollable: menu.scrollHeight > menu.clientHeight, ctaVisible: r.bottom <= window.innerHeight + 1 && r.top >= 0 };
  })()`);
  check(landscapeMenu.ctaVisible, "горизонтальный телефон: меню прокручивается до кнопки заявки", JSON.stringify(landscapeMenu));
  const headerDark = await evaluate(page, "getComputedStyle(document.querySelector('header')).backgroundColor");
  check(headerDark === "rgb(18, 29, 19)", "открытое меню: шапка сразу тёмная, надписи читаются", headerDark);
  await screenshot(page, path.join(SHOTS, "landscape-kk-menu.png"));
  await evaluate(page, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  check(await waitFor(page, `!document.getElementById('mobile-menu')`), "меню закрывается клавишей Esc");

  // Растянули окно до ноутбука при открытом меню — оно закрывается само.
  await page.send("Emulation.setDeviceMetricsOverride", viewports.phone);
  await go(page, `${BASE}/ru`);
  await evaluate(page, `document.querySelector('button[aria-controls="mobile-menu"]').click()`);
  await waitFor(page, `!!document.getElementById('mobile-menu')`);
  await page.send("Emulation.setDeviceMetricsOverride", viewports.laptop);
  check(await waitFor(page, `!document.getElementById('mobile-menu') && document.body.style.overflow === ''`), "меню закрывается, когда окно стало широким");
  await page.send("Emulation.setDeviceMetricsOverride", viewports.phone);

  // Внутренние страницы на самом узком экране.
  await page.send("Emulation.setDeviceMetricsOverride", { width: 320, height: 568, deviceScaleFactor: 1, mobile: true });
  for (const p of ["/kk/privacy", "/ru/privacy", "/kk/no-such-page"]) {
    await go(page, `${BASE}${p}`, 300);
    await evaluate(page, "document.fonts.ready.then(() => true)");
    const r = await evaluate(page, LAYOUT);
    const problems = [r.overflow > 0 ? `прокрутка ${r.overflow}px` : "", r.spill.length ? r.spill.slice(0, 2).join(" | ") : "", r.small.length ? r.small.slice(0, 3).join(", ") : ""].filter(Boolean);
    check(problems.length === 0, `320px ${p}: вёрстка цела`, problems.join("; "));
  }
  await page.send("Emulation.setDeviceMetricsOverride", viewports.phone);

  // Переключатель языка
  await go(page, `${BASE}/ru`);
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

  // -------------------------------------------- Telegram: подключение ---
  const readLeads = () => JSON.parse(fs.readFileSync(path.join(DATA, "leads.json"), "utf8"));
  const sentTo = (chat) => tgCalls.filter((c) => c.method === "sendMessage" && Number(c.params.chat_id) === chat);
  const waitTg = async (ok, ms = 6000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      try {
        if (ok()) return true;
      } catch {
        // ещё не готово
      }
      await sleep(100);
    }
    return false;
  };
  const owner = { id: 777, type: "private", first_name: "Амирхан" };
  const say = (text, chat = owner, extra = {}) => ({
    update_id: Date.now(),
    message: { message_id: 1, chat, from: { id: chat.id, first_name: chat.first_name }, text, ...extra },
  });
  const hook = (update, secret = tgWebhook.secret) =>
    fetch(`${BASE}/api/telegram/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
      body: JSON.stringify(update),
    });

  const tgLogin = await fetch(`${BASE}/api/admin/login`, {
    method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ password: PASSWORD }),
  });
  const adminCookie = (tgLogin.headers.get("set-cookie") || "").split(";")[0];
  const linkRes = await fetch(`${BASE}/api/admin/telegram`, {
    method: "POST", headers: { cookie: adminCookie, origin: BASE, "content-type": "application/json" }, body: JSON.stringify({ action: "link" }),
  });
  const linkBody = await linkRes.json().catch(() => ({}));
  check(linkRes.ok && /^https:\/\/t\.me\/horsteppe_qa_bot\?start=L/.test(linkBody.link ?? ""), "Telegram: «Подключить» выдаёт ссылку на бота", linkBody.link ?? JSON.stringify(linkBody));
  check(tgWebhook.url.endsWith("/api/telegram/webhook") && tgWebhook.secret.length >= 32, "Telegram: адрес для сообщений настроен, с секретом");
  check((await hook(say("/all"), "wrong-secret")).status === 401, "Telegram: подделка от чужого — 401");
  if (linkBody.link) await hook(say(`/start ${new URL(linkBody.link).searchParams.get("start")}`));
  check(await waitTg(() => sentTo(777).some((c) => String(c.params.text).includes("Готово"))), "Telegram: Start по ссылке подключает чат");
  check(
    await waitTg(() => JSON.parse(fs.readFileSync(path.join(DATA, "telegram-chats.json"), "utf8")).some((c) => c.chat_id === 777)),
    "Telegram: чат записан в хранилище",
  );

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

  // ------------------------------------------- Telegram: работа с заявкой ---
  const isCard = (c) => String(c.params.text).includes("Новая заявка на ранний доступ") && String(c.params.text).includes("Айгерим Тестова");
  check(await waitTg(() => sentTo(777).some(isCard)), "Telegram: о новой заявке пришло сообщение с именем");
  const card = sentTo(777).find(isCard);
  const invite = card?.params.reply_markup?.inline_keyboard.flat().find((b) => b.text === "Пригласили");
  check(!!invite, "Telegram: под заявкой кнопки статуса");
  if (invite) {
    await hook({ update_id: 2, callback_query: { id: "qa-cb", data: invite.callback_data, message: { message_id: 9, chat: owner } } });
    check(await waitTg(() => readLeads()[0].status === "invited"), "Telegram: кнопка «Пригласили» меняет статус заявки");
  }
  await hook(say("📋 Все заявки"));
  check(
    await waitTg(() => sentTo(777).some((c) => String(c.params.text).includes("Все заявки") && String(c.params.text).includes("Айгерим"))),
    "Telegram: «Все заявки» показывает список",
  );
  await hook(say("Позвонить завтра в 11", owner, { reply_to_message: { text: card?.params.text, reply_markup: card?.params.reply_markup } }));
  check(await waitTg(() => (readLeads()[0].admin_note ?? "").includes("Позвонить завтра в 11")), "Telegram: ответ на заявку сохраняется заметкой");
  const stranger = { id: 999, type: "private", first_name: "Чужой" };
  await hook(say("📋 Все заявки", stranger));
  check(
    (await waitTg(() => sentTo(999).length > 0)) && sentTo(999).every((c) => !String(c.params.text).includes("Айгерим")),
    "Telegram: чужому человеку бот заявки не показывает",
  );
  const forClient = String(sentTo(999)[0]?.params.text ?? "");
  check(forClient.includes("/ru#access") && forClient.includes("@horsteppe"), "Telegram: клиенту — ссылка на заказ видео и контакт @horsteppe", forClient.slice(0, 80));
  check(
    tgCalls.some((c) => c.method === "setMyDescription") && tgCalls.some((c) => c.method === "setMyCommands" && c.params.scope?.chat_id === 777),
    "Telegram: описание бота для клиентов и рабочее меню только в чате команды",
  );

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

  await evaluate(page, `[...document.querySelectorAll('header button')].find(b => b.textContent === 'Telegram').click()`);
  const tgDialog = `document.querySelector('[role=dialog][aria-label=Telegram]')?.textContent ?? ''`;
  check(
    await waitFor(page, `(${tgDialog}).includes('@horsteppe_qa_bot') && (${tgDialog}).includes('Амирхан')`),
    "админка: окно Telegram показывает бота и подключённый чат",
  );
  await sleep(300);
  await screenshot(page, path.join(SHOTS, "laptop-admin-telegram.png"));
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
  tg.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} проверок пройдено. Скриншоты: ${path.relative(ROOT, SHOTS)}/`);
if (failed.length) {
  if (/error/i.test(serverLog)) console.log("\nЛог сервера:\n" + serverLog.split("\n").filter((l) => /error/i.test(l)).slice(0, 10).join("\n"));
  process.exit(1);
}
