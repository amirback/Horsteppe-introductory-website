// Мини-стенд на Chrome DevTools Protocol: без puppeteer, только встроенный WebSocket.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CDP_PORT || 9344);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "hs-qa-chrome-"));
  const proc = spawn(
    CHROME,
    [
      "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
      "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "--lang=ru-RU",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 80; i++) {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return { proc, profile };
    } catch {
      await sleep(250);
    }
  }
  throw new Error("Chrome не запустился");
}

export async function openPage() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const l of listeners) l(msg);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { send, on: (fn) => listeners.push(fn), close: () => ws.close() };
}

export async function evaluate(page, expression) {
  const r = await page.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ""}`);
  return r.result.value;
}

/** Перейти и дождаться полной загрузки страницы. */
export async function go(page, url, settleMs = 600) {
  await page.send("Page.navigate", { url });
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    try {
      if ((await evaluate(page, "document.readyState")) === "complete") break;
    } catch {
      // страница ещё меняется
    }
  }
  await sleep(settleMs);
}

export async function waitFor(page, expression, timeoutMs = 8000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if (await evaluate(page, expression)) return true;
    } catch {
      // ещё не готово
    }
    await sleep(150);
  }
  return false;
}

export async function screenshot(page, file) {
  const { data } = await page.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(file, Buffer.from(data, "base64"));
}
