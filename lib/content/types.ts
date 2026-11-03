import type { UseCase, Volume } from "../leads/schema.ts";

export type FeatureIcon = "script" | "motion" | "product" | "photo" | "voice" | "formats" | "quality" | "honest";

/**
 * Все тексты сайта одного языка. Тип строгий: забытая фраза в любом из трёх
 * языков — ошибка сборки, а не пустое место на странице.
 */
export type SiteDict = {
  meta: { title: string; description: string };
  nav: {
    features: string; how: string; useCases: string; faq: string;
    signIn: string; cta: string; menu: string; close: string; skip: string; language: string;
  };
  hero: { kicker: string; title: string; sub: string; primary: string; secondary: string; proof: string[] };
  demo: {
    label: string; prompt: string; steps: string[]; timeline: string;
    real: string; camera: string; done: string; file: string;
  };
  contrast: {
    kicker: string; title: string; sub: string;
    them: { label: string; items: string[] };
    us: { label: string; items: string[] };
  };
  how: { kicker: string; title: string; steps: { title: string; text: string }[] };
  features: { kicker: string; title: string; sub: string; items: { icon: FeatureIcon; title: string; text: string }[] };
  useCases: { kicker: string; title: string; exampleLabel: string; items: { title: string; text: string; example: string }[] };
  access: {
    kicker: string; title: string; sub: string; perks: string[];
    form: {
      name: string; email: string; contact: string; contactHint: string; company: string; optional: string;
      useCase: string; useCaseOptions: Record<UseCase, string>;
      volume: string; volumeOptions: Record<Volume, string>;
      choose: string; message: string; messagePlaceholder: string;
      consentBefore: string; consentLink: string; consentAfter: string;
      submit: string; sending: string;
      /** {email} подставляется. */
      successTitle: string; successText: string; again: string;
      errors: {
        name: string; email: string; consent: string; invalid: string;
        rate_limited: string; unavailable: string; network: string;
      };
    };
  };
  faq: { kicker: string; title: string; more: string; items: { q: string; a: string }[] };
  final: { title: string; sub: string; cta: string };
  footer: { tagline: string; contact: string; privacy: string; signIn: string; rights: string; orda: string };
  privacy: { title: string; updated: string; intro: string; sections: { h: string; p: string[] }[]; back: string };
  notFound: { title: string; text: string; home: string };
};
