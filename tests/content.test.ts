import assert from "node:assert/strict";
import { test } from "node:test";
import { content } from "../lib/content/index.ts";
import { LOCALES } from "../lib/i18n.ts";

test("выделенная часть заголовка — кусок самого заголовка на каждом языке", () => {
  for (const lang of LOCALES) {
    const { title, accent } = content[lang].hero;
    assert.ok(accent.length > 0 && title.includes(accent), `${lang}: «${accent}» не найдено в «${title}»`);
  }
});

test("у трёх языков одинаковое число пунктов в каждом списке", () => {
  const shape = (lang: (typeof LOCALES)[number]) => {
    const t = content[lang];
    return {
      proof: t.hero.proof.length,
      stats: t.stats.items.length,
      demoSteps: t.demo.steps.length,
      them: t.contrast.them.items.length,
      us: t.contrast.us.items.length,
      how: t.how.steps.length,
      features: t.features.items.map((f) => f.icon).join(","),
      useCases: t.useCases.items.length,
      perks: t.access.perks.length,
      faq: t.faq.items.length,
      privacy: t.privacy.sections.length,
    };
  };
  const en = shape("en");
  for (const lang of LOCALES) assert.deepEqual(shape(lang), en, lang);
});

test("сравнение «генератор / Horsteppe» — строки попарно, без пустых ячеек", () => {
  for (const lang of LOCALES) {
    const { them, us } = content[lang].contrast;
    assert.equal(them.items.length, us.items.length, lang);
    for (const item of [...them.items, ...us.items]) assert.ok(item.trim().length > 0, lang);
  }
});

test("цифры под первым экраном — четыре и не повторяются", () => {
  for (const lang of LOCALES) {
    const values = content[lang].stats.items.map((s) => s.value);
    assert.equal(values.length, 4, lang);
    assert.equal(new Set(values).size, 4, `${lang}: ${values.join(" ")}`);
  }
});
