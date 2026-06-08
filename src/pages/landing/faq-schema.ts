// Construction + injection du JSON-LD FAQPage de la LandingPage — extrait pour
// être testable (buildFaqSchema pur) et alléger le composant.
import { useEffect } from 'react';
import { FAQ_ITEMS, type FaqItemData } from './data';

// Schéma FAQPage schema.org pur (testable, sans effet de bord).
export function buildFaqSchema(items: FaqItemData[]) {
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
    script.textContent = JSON.stringify(buildFaqSchema(FAQ_ITEMS));
    document.head.appendChild(script);
    return () => { document.getElementById('faq-schema')?.remove(); };
  }, []);
}
