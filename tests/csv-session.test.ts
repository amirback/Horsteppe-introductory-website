import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSION_TTL_MS, adminPassword, passwordMatches, sheetsKey, sheetsKeyMatches, signSession, verifySession,
} from "../lib/admin/session.ts";
import { csvCell, leadsCsv, toCsv } from "../lib/csv.ts";
import type { Lead } from "../lib/leads/schema.ts";
import { pickLocale } from "../lib/i18n.ts";

// --- CSV ----------------------------------------------------------------------

test("формула из заявки не выполнится в таблице", () => {
  assert.equal(csvCell('=HYPERLINK("http://evil","x")'), `"'=HYPERLINK(""http://evil"",""x"")"`);
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("-2+3"), "'-2+3");
  assert.equal(csvCell("+cmd|calc"), "'+cmd|calc");
  assert.equal(csvCell("\t=1"), "'\t=1");
});

test("телефон и обычный текст не портятся", () => {
  assert.equal(csvCell("+7 (777) 123-45-67"), "+7 (777) 123-45-67");
  assert.equal(csvCell("Steppe, Coffee"), '"Steppe, Coffee"');
  assert.equal(csvCell("две\nстроки"), '"две\nстроки"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(3), "3");
});

test("BOM — только по просьбе, строки через CRLF", () => {
  assert.equal(toCsv([["a", "b"]]), "a,b\r\n");
  assert.equal(toCsv([["a"]], { bom: true }), "﻿a\r\n");
});

test("выгрузка заявок: русские заголовки и подписи", () => {
  const lead = {
    id: "5f9c1a62-6d1b-4a8e-9f5e-0c1d2e3f4a5b", created_at: "2026-11-03T14:05:09.000Z",
    updated_at: "2026-11-03T14:05:09.000Z", last_submitted_at: "2026-11-04T09:00:00.000Z", submit_count: 2,
    name: "Ali", email: "ali@example.kz", contact: null, company: "=1+1", use_case: "product_ads", volume: "50+",
    message: null, lang: "ru", country: "KZ", city: "Almaty", utm_source: null, utm_medium: null,
    utm_campaign: null, referrer: null, landing_path: "/ru", status: "contacted", admin_note: null,
  } satisfies Lead;
  const [header, row] = leadsCsv([lead]).trim().split("\r\n");
  assert.ok(header.startsWith("Дата заявки,Имя,Email"));
  assert.ok(row.startsWith("2026-11-03 14:05,Ali,ali@example.kz,,'=1+1,Реклама товара,Больше 50 в месяц"));
  assert.ok(row.includes(",Связались,"), "статус по-русски");
  assert.ok(row.includes(",1,2026-11-04 09:00,"), "один повтор и время последней заявки");
});

// --- сессия админки ---------------------------------------------------------------

const env = { ADMIN_PASSWORD: "correct horse battery" };

test("короткий или пустой пароль — админка выключена", async () => {
  assert.equal(adminPassword({ ADMIN_PASSWORD: "1234567" }), null);
  assert.equal(adminPassword({}), null);
  assert.equal(await signSession({}), null);
  assert.equal(await passwordMatches("", {}), false);
});

test("пароль сверяется точно", async () => {
  assert.equal(await passwordMatches("correct horse battery", env), true);
  assert.equal(await passwordMatches("correct horse batter", env), false);
  assert.equal(await passwordMatches(undefined, env), false);
  assert.equal(await passwordMatches({ toString: () => "correct horse battery" }, env), false);
});

test("сессия живёт свой срок и не подделывается", async () => {
  const now = 1_800_000_000_000;
  const token = (await signSession(env, now))!;
  assert.equal(await verifySession(token, env, now + 1000), true);
  assert.equal(await verifySession(token, env, now + SESSION_TTL_MS + 1), false, "истекла");
  const [expires, signature] = token.split(".");
  assert.equal(await verifySession(`${Number(expires) + 9e9}.${signature}`, env, now), false, "продлить нельзя");
  assert.equal(await verifySession(`${expires}.${"0".repeat(signature.length)}`, env, now), false);
  assert.equal(await verifySession(token, { ADMIN_PASSWORD: "another password!" }, now), false, "смена пароля выключает сессии");
  assert.equal(await verifySession("garbage", env, now), false);
  assert.equal(await verifySession(null, env, now), false);
});

test("ключ для Google Таблицы меняется вместе с паролем", async () => {
  const key = (await sheetsKey(env))!;
  assert.equal(key.length, 40);
  assert.equal(await sheetsKeyMatches(key, env), true);
  assert.equal(await sheetsKeyMatches(key, { ADMIN_PASSWORD: "another password!" }), false);
  assert.equal(await sheetsKeyMatches(null, env), false);
});

// --- язык --------------------------------------------------------------------------

test("язык по браузеру", () => {
  assert.equal(pickLocale("ru-KZ,ru;q=0.9,en;q=0.8"), "ru");
  assert.equal(pickLocale("kk-KZ"), "kk");
  assert.equal(pickLocale("kz"), "kk");
  assert.equal(pickLocale("de-DE,de;q=0.9"), "en");
  assert.equal(pickLocale("en;q=0.5,kk;q=0.9"), "kk", "решает вес, а не порядок");
  assert.equal(pickLocale(null), "en");
});
