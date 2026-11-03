/**
 * Иконки, картинка для соцсетей и логотип для поисковиков — из двух исходников:
 *
 *   public/brand/artwork.jpg — логотип целиком, как его прислал основатель
 *                              (лошадь, дубовые листья, буквы HRS, степь);
 *   public/brand/emblem.png  — сам знак без фона (вырезан scripts/brand/cutout.py).
 *
 * Запуск: node scripts/brand/make-assets.mjs
 * sharp уже есть в node_modules (его ставит Next.js), отдельно ставить не нужно.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const EMBLEM = path.join(ROOT, "public/brand/emblem.png");
const ARTWORK = path.join(ROOT, "public/brand/artwork.jpg");
const NIGHT = "#121d13";
const GOLD = "#eee1aa";

const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);

/** Знак, вписанный в квадрат size×size с полями pad (доля стороны). */
async function emblemFit(size, pad) {
  const inner = Math.round(size * (1 - 2 * pad));
  return sharp(EMBLEM)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .toBuffer();
}

/** Плитка: знак на тёмно-хвойном фоне. radius — доля стороны (0 — квадрат для iOS). */
async function tile(size, { pad = 0.1, radius = 0.22 } = {}) {
  const r = Math.round(size * radius);
  const base = svg(size, size, `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${NIGHT}"/>`);
  return sharp(base)
    .composite([{ input: await emblemFit(size, pad), gravity: "center" }])
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
}

/** ICO с PNG внутри (так умеют все браузеры с 2010 года): 16 и 32 пикселя. */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

/**
 * Картинка для ссылок в мессенджерах и соцсетях, 1200×630. В середине — логотип
 * целиком; по бокам — тот же логотип, сильно размытый: степь продолжается до краёв
 * без резкой границы. Подпись не нужна — заголовок и описание ссылки показывает сам
 * мессенджер.
 */
async function ogImage() {
  const W = 1200;
  const H = 630;
  const backdrop = await sharp(ARTWORK)
    .resize(W, H, { fit: "cover", position: "centre" })
    .blur(38)
    .modulate({ brightness: 0.97 })
    .toBuffer();
  const artH = H;
  const art = await sharp(ARTWORK).resize({ height: artH, kernel: "lanczos3" }).toBuffer();
  const { width: artW } = await sharp(art).metadata();
  // Мягкий переход от логотипа к размытому фону: маска с растушёванными краями.
  const fade = Math.round(artW * 0.16);
  const mask = svg(
    artW,
    artH,
    `<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>` +
      `<stop offset="${fade / artW}" stop-color="#fff"/><stop offset="${1 - fade / artW}" stop-color="#fff"/>` +
      `<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
      `<rect width="${artW}" height="${artH}" fill="url(#g)"/>`,
  );
  const softArt = await sharp(art)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return sharp(backdrop)
    .composite([{ input: softArt, left: Math.round((W - artW) / 2), top: 0 }])
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
}

const out = (rel, data) => {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log(`${rel.padEnd(28)} ${(data.length / 1024).toFixed(1)} КБ`);
};

out("app/icon.png", await tile(192, { pad: 0.08, radius: 0.22 }));
out("app/apple-icon.png", await tile(180, { pad: 0.1, radius: 0 }));
out("app/favicon.ico", ico([
  { size: 16, data: await tile(16, { pad: 0.02, radius: 0.18 }) },
  { size: 32, data: await tile(32, { pad: 0.03, radius: 0.2 }) },
]));
out("public/og.png", await ogImage());
// Логотип для поисковиков (schema.org Organization): знак на прозрачном фоне, квадрат.
out(
  "public/logo.png",
  await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await emblemFit(512, 0.04), gravity: "center" }])
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer(),
);
// Знак на тёмной плитке 512×512 — готовая аватарка для Instagram, Telegram и т. п.
out("public/brand/tile-512.png", await tile(512, { pad: 0.08, radius: 0.22 }));
console.log(`цвет фона плиток ${NIGHT}, акцент ${GOLD}`);
