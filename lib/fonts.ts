import { EB_Garamond, Inter } from "next/font/google";

/**
 * Шрифты сайта — свои, не как у продукта (там Montserrat):
 *   EB Garamond — заголовки, в духе гравюры логотипа;
 *   Inter — основной текст.
 *
 * Почему не Cormorant: у него «л» и «д» с острым верхом (как Λ и Δ) даже в
 * русском режиме — русскому и казахскому читателю это бросается в глаза.
 * У EB Garamond привычная кириллица и все казахские буквы (ә ғ қ ң ө ұ ү һ і).
 *
 * subsets управляет только предзагрузкой: начертания из блока cyrillic-ext
 * всё равно попадают в CSS и грузятся, когда встречаются на странице.
 * Заголовочный шрифт не предзагружается: на английской странице кириллица не
 * нужна, и наоборот. Пока он грузится, браузер рисует подогнанный по метрикам
 * Times — строки не прыгают.
 */
const serif = EB_Garamond({
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
  variable: "--font-garamond",
  display: "swap",
  preload: false,
});

const sans = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });

export const fontClasses = `${serif.variable} ${sans.variable}`;
