import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "../globals.css";

const montserrat = Montserrat({ subsets: ["latin", "cyrillic"], variable: "--font-montserrat", display: "swap" });
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Заявки · Horsteppe", template: "%s · Horsteppe" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#f7f6e9", colorScheme: "light" };

/** Админка — отдельный корневой макет: свой язык, закрыта от поиска. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${montserrat.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
