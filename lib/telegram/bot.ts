/**
 * Бот заявок Horsteppe: что делать с каждым обновлением от Telegram.
 *
 * Доступ — только у чатов, подключённых по ссылке из админки (или указанного
 * в TELEGRAM_CHAT_ID). Клиенту, нашедшему бота, — ссылка, где заказать видео,
 * и контакт команды (public.ts); ни одной заявки он не видит. Кнопки и
 * команды проверяют доступ каждый раз.
 */
import { json, readJson } from "../api.ts";
import { MissingTableError } from "../leads/errors.ts";
import { STATUS_LABEL } from "../leads/labels.ts";
import { LIMITS, type Lead } from "../leads/schema.ts";
import { UUID, type LeadStore, type TelegramChat } from "../leads/store.ts";
import { safeEqual } from "../security.ts";
import { siteUrl } from "../site.ts";
import { botToken, telegramApi, type TelegramApi } from "./api.ts";
import {
  CODE_STATUS, HELP, LINK_EXPIRED, MENU, MENU_KEYBOARD, NO_TABLE, TZ, WELCOME,
  esc, findLeads, leadCard, leadKeyboard, leadList, searchReply, statsText, type ListFilter, type Reply,
} from "./format.ts";
import { checkLinkCode, webhookSecret } from "./keys.ts";
import { applyTeamCommands, clearTeamCommands, publicLang, publicReply } from "./public.ts";

type Env = Record<string, string | undefined>;

// Только те поля объектов Telegram, которыми бот пользуется.
type TgChat = { id: number; type: string; title?: string; username?: string; first_name?: string; last_name?: string };
type TgUser = { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string; language_code?: string };
type TgReplied = { text?: string; reply_markup?: { inline_keyboard?: { callback_data?: string }[][] } };
type TgMessage = { message_id: number; chat: TgChat; from?: TgUser; text?: string; reply_to_message?: TgReplied };
type TgCallback = { id: string; from?: TgUser; data?: string; message?: { message_id: number; chat: TgChat } };
export type TgUpdate = { update_id?: number; message?: TgMessage; callback_query?: TgCallback };

export type BotDeps = { store: LeadStore | null; api: TelegramApi; token: string; env?: Env; now?: Date; site?: string };

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

function personName(user?: TgUser): string {
  return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || (user?.username ? `@${user.username}` : "");
}

function chatTitle(chat: TgChat, from?: TgUser): string {
  if (chat.type === "private") return (personName(from) || `чат ${chat.id}`).slice(0, 200);
  return (chat.title ? `группа «${chat.title}»` : `группа ${chat.id}`).slice(0, 200);
}

/** Чат допущен: подключён из админки или указан в TELEGRAM_CHAT_ID. */
async function isAllowed(chatId: number, deps: BotDeps): Promise<boolean> {
  const fixed = (deps.env ?? process.env).TELEGRAM_CHAT_ID?.trim();
  if (fixed && fixed === String(chatId)) return true;
  if (!deps.store) return false;
  try {
    return (await deps.store.listChats()).some((c) => Number(c.chat_id) === chatId);
  } catch {
    return false;
  }
}

function send(deps: BotDeps, chatId: number, reply: Reply | string, extra: Record<string, unknown> = {}) {
  const { text, reply_markup } = typeof reply === "string" ? { text: reply, reply_markup: undefined } : reply;
  return deps.api.call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(reply_markup ? { reply_markup } : {}),
    ...extra,
  });
}

export async function handleUpdate(update: TgUpdate, deps: BotDeps): Promise<void> {
  if (update.callback_query) return onButton(update.callback_query, deps);
  const message = update.message;
  if (!message?.chat || typeof message.text !== "string" || message.from?.is_bot) return;
  const chatId = message.chat.id;
  const text = message.text.trim();
  const [first = "", ...rest] = text.split(/\s+/);
  const command = first.startsWith("/") ? first.slice(1).split("@")[0].toLowerCase() : null;
  const arg = rest.join(" ").trim();

  if (command === "start" && arg) return linkChat(message, arg, deps);

  if (!(await isAllowed(chatId, deps))) {
    // Клиент нашёл бота сам: где заказать видео и как связаться — с карточкой сайта.
    // В чужих группах молчим: бот не отвечает на команды там, куда его не подключали.
    if (message.chat.type === "private") {
      const reply = publicReply(publicLang(message.from?.language_code), deps.site ?? siteUrl());
      await send(deps, chatId, reply, { disable_web_page_preview: false });
    }
    return;
  }

  if (command === "start" || command === "help" || text === MENU.help) {
    await send(deps, chatId, HELP, { reply_markup: MENU_KEYBOARD });
    return;
  }
  if (command === "stop") return stopChat(chatId, deps);

  const store = deps.store;
  if (!store) {
    await send(deps, chatId, "База заявок сейчас недоступна. Попробуйте чуть позже.");
    return;
  }
  if (command === "new" || text === MENU.new) {
    await send(deps, chatId, leadList(await store.listLeads(), "new"));
    return;
  }
  if (command === "all" || command === "leads" || text === MENU.all) {
    await send(deps, chatId, leadList(await store.listLeads(), "all"));
    return;
  }
  if (command === "stats" || text === MENU.stats) {
    await send(deps, chatId, statsText(await store.listLeads(), deps.now ?? new Date()));
    return;
  }
  if (!command && message.reply_to_message) return saveNote(message, store, deps);
  if (command === "find") {
    if (arg) return search(chatId, arg, store, deps);
    await send(deps, chatId, "Напишите после /find имя, почту или компанию. Или просто отправьте их без команды.");
    return;
  }
  if (command) {
    await send(deps, chatId, `Такой команды нет.\n\n${HELP}`, { reply_markup: MENU_KEYBOARD });
    return;
  }
  return search(chatId, text, store, deps);
}

/** /start <код> из ссылки админки: чат становится получателем заявок. */
async function linkChat(message: TgMessage, code: string, deps: BotDeps): Promise<void> {
  const chatId = message.chat.id;
  const now = (deps.now ?? new Date()).getTime();
  if (!(await checkLinkCode(code, deps.token, deps.env ?? process.env, now))) {
    await send(deps, chatId, LINK_EXPIRED);
    return;
  }
  if (!deps.store) {
    await send(deps, chatId, "База заявок сейчас недоступна — подключить чат не получилось. Попробуйте позже.");
    return;
  }
  const title = chatTitle(message.chat, message.from);
  let before: TelegramChat[];
  try {
    before = await deps.store.listChats();
    await deps.store.addChat({ chat_id: chatId, title });
  } catch (error) {
    await send(deps, chatId, error instanceof MissingTableError ? NO_TABLE : "Не получилось сохранить чат. Попробуйте ещё раз через минуту.");
    return;
  }
  await send(deps, chatId, WELCOME, { reply_markup: MENU_KEYBOARD });
  // Рабочие команды в меню «/» — только в этом чате; клиенты видят лишь /start.
  await applyTeamCommands(deps.api, chatId);
  // Остальным подключённым — кто присоединился: новый получатель заявок не появится незаметно.
  const others = before.filter((c) => Number(c.chat_id) !== chatId);
  await Promise.all(others.map((c) => send(deps, Number(c.chat_id), `🔗 К заявкам подключён ещё один чат: <b>${esc(title)}</b>.`)));
}

async function stopChat(chatId: number, deps: BotDeps): Promise<void> {
  let removed = false;
  try {
    removed = !!deps.store && (await deps.store.removeChat(chatId));
  } catch {
    // ниже скажем, что делать
  }
  const fixed = (deps.env ?? process.env).TELEGRAM_CHAT_ID?.trim() === String(chatId);
  if (removed && !fixed) await clearTeamCommands(deps.api, chatId);
  const text = fixed
    ? "Этот чат указан в настройках сайта (переменная TELEGRAM_CHAT_ID в Vercel) — отключить его можно только там."
    : removed
      ? "Готово: заявки сюда больше не придут. Подключить снова можно по ссылке из админки."
      : "Этот чат и так не получает заявки.";
  await send(deps, chatId, text, fixed ? {} : { reply_markup: { remove_keyboard: true } });
}

async function search(chatId: number, query: string, store: LeadStore, deps: BotDeps): Promise<void> {
  const found = findLeads(await store.listLeads(), query);
  // Нашлась одна — сразу вся заявка с кнопками, без лишнего нажатия.
  await send(deps, chatId, found.length === 1 ? leadCard(found[0], "view", deps.site) : searchReply(found, query));
}

/** Заявка, на карточку которой ответили: по кнопкам статуса, иначе по почте в тексте. */
async function repliedLead(replied: TgReplied, store: LeadStore): Promise<Lead | null> {
  for (const row of replied.reply_markup?.inline_keyboard ?? []) {
    for (const button of row) {
      const id = /^s:[a-z]:(.+)$/.exec(button.callback_data ?? "")?.[1];
      if (id && UUID.test(id)) {
        const lead = await store.getLead(id);
        if (lead) return lead;
      }
    }
  }
  const email = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/.exec(replied.text ?? "")?.[0]?.toLowerCase();
  return email ? ((await store.listLeads()).find((l) => l.email === email) ?? null) : null;
}

/** Ответ текстом на карточку заявки — заметка команды (дописывается, а не затирает прежнюю). */
async function saveNote(message: TgMessage, store: LeadStore, deps: BotDeps): Promise<void> {
  const chatId = message.chat.id;
  const text = (message.text ?? "").replace(CONTROL, "").trim();
  const lead = await repliedLead(message.reply_to_message!, store);
  if (!lead) return search(chatId, text, store, deps);
  const day = new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "numeric", month: "short" }).format(deps.now ?? new Date());
  const author = personName(message.from);
  const entry = `${day}${author ? `, ${author}` : ""}: ${text}`;
  const combined = lead.admin_note ? `${lead.admin_note}\n${entry}` : entry;
  // Заметка ограничена по длине — при переполнении теряются самые старые строки.
  const note = combined.length > LIMITS.note ? combined.slice(combined.length - LIMITS.note) : combined;
  await store.updateLead(lead.id, { admin_note: note });
  await send(deps, chatId, `📝 Заметка сохранена: <b>${esc(lead.name)}</b>. Её видно и в админке.`);
}

async function onButton(cb: TgCallback, deps: BotDeps): Promise<void> {
  const answer = (text?: string) => deps.api.call("answerCallbackQuery", { callback_query_id: cb.id, ...(text ? { text } : {}) });
  const chat = cb.message?.chat;
  if (!chat || !cb.message || !(await isAllowed(chat.id, deps))) {
    await answer("Нет доступа");
    return;
  }
  const store = deps.store;
  if (!store) {
    await answer("База заявок недоступна");
    return;
  }
  const data = cb.data ?? "";

  const status = /^s:([a-z]):(.+)$/.exec(data);
  if (status) {
    const next = CODE_STATUS[status[1]];
    const lead = next && UUID.test(status[2]) ? await store.updateLead(status[2], { status: next }) : null;
    if (!lead) {
      await answer("Заявка не найдена — возможно, удалена");
      return;
    }
    await deps.api.call("editMessageReplyMarkup", {
      chat_id: chat.id,
      message_id: cb.message.message_id,
      reply_markup: leadKeyboard(lead, deps.site),
    });
    await answer(`Статус: ${STATUS_LABEL[lead.status]}`);
    return;
  }

  const view = /^v:(.+)$/.exec(data);
  if (view) {
    const lead = UUID.test(view[1]) ? await store.getLead(view[1]) : null;
    await answer(lead ? undefined : "Заявка не найдена — возможно, удалена");
    if (lead) await send(deps, chat.id, leadCard(lead, "view", deps.site));
    return;
  }

  const page = /^p:(new|all):(\d{1,5})$/.exec(data);
  if (page) {
    const list = leadList(await store.listLeads(), page[1] as ListFilter, Number(page[2]));
    await deps.api.call("editMessageText", {
      chat_id: chat.id,
      message_id: cb.message.message_id,
      text: list.text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(list.reply_markup ? { reply_markup: list.reply_markup } : {}),
    });
    await answer();
    return;
  }
  await answer();
}

/**
 * Вход вебхука. Проверяется секрет из заголовка — его знают только сайт и
 * Telegram. Ответ Telegram — сразу; работа идёт после ответа (defer), чтобы
 * медленная база не заставляла Telegram повторять то же обновление.
 */
export async function handleWebhook(
  request: Request,
  deps: {
    store: LeadStore | null;
    env?: Env;
    now?: Date;
    site?: string;
    fetchImpl?: typeof fetch;
    defer?: (task: () => Promise<unknown>) => void;
  },
): Promise<Response> {
  const env = deps.env ?? process.env;
  const token = botToken(env);
  if (!token) return json({ error: "bot_disabled" }, 404);
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(given, await webhookSecret(token))) return json({ error: "forbidden" }, 401);

  const update = await readJson(request, 64 * 1024);
  // Непонятное тело не обрабатываем, но отвечаем 200 — иначе Telegram будет слать его снова.
  if (!update || typeof update !== "object" || Array.isArray(update)) return json({ ok: true });

  const api = telegramApi(token, { env, fetchImpl: deps.fetchImpl });
  const task = () =>
    handleUpdate(update as TgUpdate, { store: deps.store, api, token, env, now: deps.now, site: deps.site }).catch((error) =>
      console.error("telegram update failed —", (error as Error).message),
    );
  if (deps.defer) deps.defer(task);
  else await task();
  return json({ ok: true });
}
