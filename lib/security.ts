/**
 * Подписи, хеши и сравнения — на Web Crypto, чтобы один и тот же код работал
 * и в middleware (Edge), и в API (Node).
 */

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export async function sha256(value: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/** Сравнение без утечки по времени: длина и содержимое не выдают совпавший префикс. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Ключ частоты для IP. Сам адрес не хранится нигде: только хеш с солью, и
 * только на двое суток.
 */
export async function ipKey(ip: string, salt: string): Promise<string> {
  return (await sha256(`horsteppe-rate|${salt}|${ip}`)).slice(0, 32);
}
