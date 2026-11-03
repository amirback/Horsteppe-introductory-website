import type { MetadataRoute } from "next";
import { LOCALES } from "../lib/i18n.ts";
import { siteUrl } from "../lib/site.ts";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  ];
  return pages.flatMap((page) =>
    LOCALES.map((lang) => ({
      url: `${base}/${lang}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${base}/${l}${page.path}`])) },
    })),
  );
}
