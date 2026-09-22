/**
 * FAQ — preguntas frecuentes extraídas del diccionario de traducciones.
 * Se centraliza aquí para que la home, la página de FAQ y el JSON-LD
 * (FAQPage) usen exactamente el mismo contenido.
 */
import { type Locale, t } from "~/lib/i18n";

export type FaqItem = { question: string; answer: string };

export function getFaq(locale: Locale): FaqItem[] {
  const tr = t(locale);
  const f = tr.faq;
  return [
    { question: f.q1, answer: f.a1 },
    { question: f.q2, answer: f.a2 },
    { question: f.q3, answer: f.a3 },
    { question: f.q4, answer: f.a4 },
    { question: f.q5, answer: f.a5 },
    { question: f.q6, answer: f.a6 },
    { question: f.q7, answer: f.a7 },
    { question: f.q8, answer: f.a8 },
    { question: f.q9, answer: f.a9 },
    { question: f.q10, answer: f.a10 },
  ];
}
