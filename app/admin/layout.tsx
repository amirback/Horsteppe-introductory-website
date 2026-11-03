import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontClasses } from "../../lib/fonts.ts";

export const metadata: Metadata = {
  title: { default: "Заявки · Horsteppe", template: "%s · Horsteppe" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = { themeColor: "#f5f1e6", colorScheme: "light", viewportFit: "cover" };

/** Админка — отдельный корневой макет: свой язык, закрыта от поиска. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={fontClasses}>
      <body className="min-h-screen bg-parchment text-ink antialiased">{children}</body>
    </html>
  );
}
