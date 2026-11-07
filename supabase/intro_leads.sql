-- Horsteppe — ознакомительный сайт: заявки на ранний доступ.
-- Вставить целиком в Supabase → SQL Editor → Run. Повторный запуск безопасен.
--
-- Таблицы закрыты для браузера дважды: включён RLS без единого правила и
-- отозваны права у публичных ролей. Читать и писать их может только сервер
-- сайта со служебным ключом. Данные продукта (projects, shots, …) не
-- затрагиваются.

-- ============================================================
-- 1. Заявки
-- ============================================================

create table if not exists public.intro_leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  last_submitted_at timestamptz not null default now(),
  submit_count      int  not null default 1 check (submit_count >= 1),

  name         text not null check (char_length(name) between 1 and 100),
  -- Почта хранится в нижнем регистре: по ней склеиваются повторные заявки.
  email        text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  contact      text check (contact is null or char_length(contact) <= 100),
  company      text check (company is null or char_length(company) <= 120),
  use_case     text check (use_case is null or use_case in
                 ('product_ads', 'social', 'animate_photo', 'agency', 'explainers', 'other')),
  volume       text check (volume is null or volume in ('1-5', '6-20', '21-50', '50+')),
  message      text check (message is null or char_length(message) <= 1500),
  lang         text not null default 'en' check (lang in ('en', 'ru', 'kk')),

  -- Откуда человек: страна и город по IP (сам адрес не храним), метки рекламы.
  country      text check (country is null or char_length(country) = 2),
  city         text check (city is null or char_length(city) <= 80),
  utm_source   text check (utm_source is null or char_length(utm_source) <= 100),
  utm_medium   text check (utm_medium is null or char_length(utm_medium) <= 100),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 100),
  referrer     text check (referrer is null or char_length(referrer) <= 300),
  landing_path text check (landing_path is null or char_length(landing_path) <= 200),

  -- Работа с заявкой в админке.
  status       text not null default 'new' check (status in ('new', 'contacted', 'invited', 'active', 'declined')),
  admin_note   text check (admin_note is null or char_length(admin_note) <= 2000),

  constraint intro_leads_email_key unique (email)
);

create index if not exists intro_leads_created_idx on public.intro_leads (created_at desc);
create index if not exists intro_leads_status_idx on public.intro_leads (status, created_at desc);

create or replace function public.intro_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists intro_leads_touch_updated_at on public.intro_leads;
create trigger intro_leads_touch_updated_at
  before update on public.intro_leads
  for each row execute function public.intro_touch_updated_at();

-- ============================================================
-- 2. Отметки для лимита частоты (форма и вход в админку)
-- ============================================================
-- Хранится только необратимый отпечаток IP с секретной солью и время.
-- Сайт сам подчищает отметки старше двух суток.

create table if not exists public.intro_rate_events (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('lead', 'lead_all', 'admin_fail')),
  key_hash   text not null check (char_length(key_hash) <= 64),
  created_at timestamptz not null default now()
);

create index if not exists intro_rate_events_lookup_idx
  on public.intro_rate_events (kind, key_hash, created_at desc);

-- ============================================================
-- 3. Telegram-бот: чаты, куда приходят заявки
-- ============================================================
-- Чат попадает сюда, только когда человек открыл ссылку подключения из
-- админки (она подписана и живёт 30 минут). Хранится номер чата и подпись.

create table if not exists public.intro_telegram_chats (
  chat_id   bigint primary key,
  title     text check (title is null or char_length(title) <= 200),
  linked_at timestamptz not null default now()
);

-- ============================================================
-- 4. Доступ: только сервер сайта
-- ============================================================

alter table public.intro_leads enable row level security;
alter table public.intro_rate_events enable row level security;
alter table public.intro_telegram_chats enable row level security;

revoke all on public.intro_leads from anon, authenticated;
revoke all on public.intro_rate_events from anon, authenticated;
revoke all on public.intro_telegram_chats from anon, authenticated;

comment on table public.intro_leads is
  'Заявки на ранний доступ с ознакомительного сайта Horsteppe. Пишет и читает только сервер сайта.';
comment on table public.intro_rate_events is
  'Отметки лимита частоты: отпечаток IP с солью, без самого адреса. Живут двое суток.';
comment on table public.intro_telegram_chats is
  'Чаты Telegram, подключённые к заявкам из админки сайта. Пишет и читает только сервер сайта.';
