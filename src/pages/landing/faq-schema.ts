// Construction + injection du JSON-LD FAQPage de la LandingPage — extrait pour
// être testable (buildFaqSchema pur) et alléger le composant.
import { useEffect } from 'react';
import { FAQ_ITEMS } from './data';
import { translator } from '@/i18n/useT';

/** Paire résolue — le JSON-LD porte du TEXTE, jamais des clés. */
export interface FaqPair {
  question: string;
  answer: string;
}

// Schéma FAQPage schema.org pur (testable, sans effet de bord).
export function buildFaqSchema(items: FaqPair[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

// ── FAQ Schema injection ──────────────────────────────────────────────────
export function useFaqSchema() {
  useEffect(() => {
    // Sur les pages pré-rendues (prerender.mjs), le FAQPage JSON-LD est déjà
    // présent en statique dans le <head> — ne pas le dupliquer côté client.
    if (document.getElementById('faq-schema')) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'faq-schema';
    // Résolution AU MOMENT de l'injection : le JSON-LD doit contenir le texte
    // de la langue servie, pas des clés de catalogue.
    const { t } = translator('landing');
    const pairs = FAQ_ITEMS.map(({ questionKey, answerKey }) => ({
      question: t(questionKey),
      answer: t(answerKey),
    }));
    script.textContent = JSON.stringify(buildFaqSchema(pairs));
    document.head.appendChild(script);
    return () => { document.getElementById('faq-schema')?.remove(); };
  }, []);
}
