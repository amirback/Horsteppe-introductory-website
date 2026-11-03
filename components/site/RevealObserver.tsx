"use client";

import { useEffect } from "react";

/**
 * Проявляет блоки .reveal при прокрутке. Если наблюдателя нет в браузере
 * или скрипт не дошёл — страховка в <head> показывает всё через 2.5 с,
 * так что содержимое не остаётся невидимым ни при каком сбое.
 */
export function RevealObserver() {
  useEffect(() => {
    (window as unknown as { __hsReveal?: boolean }).__hsReveal = true;
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)"));
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
}
