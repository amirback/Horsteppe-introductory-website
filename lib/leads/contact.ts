/**
 * Куда написать человеку по полю «Телефон или Telegram». Общее для админки
 * и бота: «@ник» или ссылка t.me — Telegram; номер из 10–15 цифр — звонок и WhatsApp.
 */
export type ContactLink = { label: string; href: string };

export function contactLinks(contact: string | null): ContactLink[] {
  if (!contact) return [];
  const value = contact.trim();
  const handle = value.match(/^@?([A-Za-z0-9_]{4,32})$/);
  const tg = value.match(/t\.me\/([A-Za-z0-9_]{4,32})/);
  const digits = value.replace(/[^\d+]/g, "");
  const links: ContactLink[] = [];
  if (tg || (handle && value.startsWith("@"))) links.push({ label: "Telegram", href: `https://t.me/${(tg ?? handle)![1]}` });
  if (/^\+?\d{10,15}$/.test(digits)) {
    links.push({ label: "Позвонить", href: `tel:${digits}` });
    links.push({ label: "WhatsApp", href: `https://wa.me/${digits.replace(/^\+/, "")}` });
  }
  return links;
}
