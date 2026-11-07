/**
 * Бот глазами клиента — человека, который нашёл его сам.
 *
 * Заявок клиент не видит никогда. Вместо отказа бот вежливо отвечает, где
 * заказать видео (заявка на ранний доступ на сайте), и даёт Telegram команды
 * для вопросов и связи с основателями. Язык — из настроек Telegram человека.
 *
 * Здесь же профиль бота: описание до кнопки «Запустить», короткое описание и
 * меню команд. Клиенту в меню — только «/start»; рабочие команды видны лишь
 * в чатах команды (меню на уровне чата).
 */
import { CONTACT_TELEGRAM } from "../site.ts";
import type { TelegramApi } from "./api.ts";
import { esc, type Reply } from "./format.ts";

export type PublicLang = "ru" | "kk" | "en";
const LANGS: PublicLang[] = ["ru", "kk", "en"];

/** Казахский — по-казахски; русский и соседние языки СНГ — по-русски; остальные — по-английски. */
export function publicLang(code?: string): PublicLang {
  const base = (code ?? "").toLowerCase().split("-")[0];
  if (base === "kk") return "kk";
  if (!base || ["ru", "uk", "be", "uz", "ky", "tg", "az", "hy", "ka", "tk"].includes(base)) return "ru";
  return "en";
}

const TEXT: Record<PublicLang, { hello: string; order: string; talk: string; orderButton: string; talkButton: string }> = {
  ru: {
    hello: "Здравствуйте! Это <b>Horsteppe</b> — AI-режиссёр и монтажёр видео: готовые ролики для рекламы и соцсетей из описания или фото товара.",
    order: "🎬 Видео можно заказать здесь — оставьте заявку на ранний доступ:",
    talk: "💬 Подробности, вопросы и связь с основателями — пишите нам в Telegram:",
    orderButton: "🎬 Заказать видео",
    talkButton: "💬 Написать команде",
  },
  kk: {
    hello: "Сәлеметсіз бе! Бұл — <b>Horsteppe</b>, бейнеге арналған AI-режиссёр және монтажшы: сипаттамадан немесе тауар фотосынан жарнама мен әлеуметтік желілерге дайын роликтер.",
    order: "🎬 Бейнеге осы жерден тапсырыс беруге болады — ерте қолжетімділікке өтінім қалдырыңыз:",
    talk: "💬 Толығырақ ақпарат, сұрақтар және негізін қалаушылармен байланыс — бізге Telegram-да жазыңыз:",
    orderButton: "🎬 Бейнеге тапсырыс беру",
    talkButton: "💬 Командаға жазу",
  },
  en: {
    hello: "Hello! This is <b>Horsteppe</b> — an AI video director and editor: finished videos for ads and social media from a brief or a product photo.",
    order: "🎬 You can order a video here — request early access:",
    talk: "💬 For details, questions or to talk to the founders, message us on Telegram:",
    orderButton: "🎬 Order a video",
    talkButton: "💬 Message the team",
  },
};

export function publicReply(lang: PublicLang, site: string): Reply {
  const t = TEXT[lang];
  const order = `${site}/${lang}#access`;
  const talk = `https://t.me/${CONTACT_TELEGRAM}`;
  const rows = [[{ text: t.talkButton, url: talk }]];
  // В кнопках Telegram — только https; адрес сайта на своём компьютере остаётся текстом.
  if (order.startsWith("https://")) rows.unshift([{ text: t.orderButton, url: order }]);
  return {
    text: [t.hello, "", t.order, esc(order), "", t.talk, `@${CONTACT_TELEGRAM}`].join("\n"),
    reply_markup: { inline_keyboard: rows },
  };
}

const DESCRIPTION: Record<PublicLang, string> = {
  ru: "Horsteppe — AI-режиссёр и монтажёр видео. Готовые ролики для рекламы и соцсетей из описания или фото товара.\n\nНажмите «Запустить» — пришлю ссылку, где заказать видео, и контакт команды.",
  kk: "Horsteppe — бейнеге арналған AI-режиссёр және монтажшы. Сипаттамадан немесе тауар фотосынан жарнама мен әлеуметтік желілерге дайын роликтер.\n\n«Бастау» түймесін басыңыз — бейнеге тапсырыс беретін сілтемені және команданың байланысын жіберемін.",
  en: "Horsteppe is an AI video director and editor: finished videos for ads and social media from a brief or a product photo.\n\nPress Start and I'll send you where to order a video and how to reach the team.",
};

const SHORT_DESCRIPTION: Record<PublicLang, string> = {
  ru: "AI-режиссёр и монтажёр видео. Заказать ролик и связаться с командой Horsteppe.",
  kk: "Бейнеге арналған AI-режиссёр және монтажшы. Роликке тапсырыс беру және командамен байланыс.",
  en: "AI video director and editor. Order a video and contact the Horsteppe team.",
};

const PUBLIC_COMMANDS: Record<PublicLang, string> = {
  ru: "Заказать видео и связаться с командой",
  kk: "Бейнеге тапсырыс беру және командамен байланысу",
  en: "Order a video and contact the team",
};

/** Рабочие команды — только в чатах команды. */
export const TEAM_COMMANDS = [
  { command: "new", description: "Новые заявки — ждут ответа" },
  { command: "all", description: "Все заявки" },
  { command: "stats", description: "Статистика" },
  { command: "find", description: "Найти заявку по имени, почте или компании" },
  { command: "help", description: "Что умеет бот" },
  { command: "stop", description: "Не присылать заявки в этот чат" },
];

/** Профиль бота для всех: русский — по умолчанию, казахский и английский — для своих языков. */
export async function applyPublicProfile(api: TelegramApi): Promise<void> {
  await Promise.all(
    LANGS.flatMap((lang) => {
      const scope = lang === "ru" ? {} : { language_code: lang };
      return [
        api.call("setMyDescription", { description: DESCRIPTION[lang], ...scope }),
        api.call("setMyShortDescription", { short_description: SHORT_DESCRIPTION[lang], ...scope }),
        api.call("setMyCommands", { commands: [{ command: "start", description: PUBLIC_COMMANDS[lang] }], ...scope }),
      ];
    }),
  );
}

export function applyTeamCommands(api: TelegramApi, chatId: number) {
  return api.call("setMyCommands", { commands: TEAM_COMMANDS, scope: { type: "chat", chat_id: chatId } });
}

export function clearTeamCommands(api: TelegramApi, chatId: number) {
  return api.call("deleteMyCommands", { scope: { type: "chat", chat_id: chatId } });
}
