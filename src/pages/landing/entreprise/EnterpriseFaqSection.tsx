import React from 'react';
import FaqItem from '../FaqItem';
import { useT } from '@/i18n/useT';
import { ENTERPRISE_FAQ } from './data';

/**
 * FAQ du track entreprise — les cinq objections d'achat, distinctes de la FAQ
 * produit du track perso.
 *
 * Pas de JSON-LD `FAQPage` ici : `useFaqSchema` en injecte déjà un pour la FAQ
 * perso, et deux blocs `FAQPage` sur la même URL sont une erreur de balisage.
 * Les deux tracks ayant des URL distinctes, ce sera à arbitrer le jour où l'on
 * voudra faire remonter ces questions-ci dans les résultats enrichis.
 */
const EnterpriseFaqSection: React.FC = () => {
  const { t } = useT('landing');

  return (
    <section
      className="relative border-t border-white/[0.06] py-24 lg:py-28"
      aria-labelledby="enterprise-faq-title"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2
          id="enterprise-faq-title"
          className="mb-10 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl"
        >
          {t('enterprise.faq.title')}
        </h2>

        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0C11] px-6 sm:px-8">
          {ENTERPRISE_FAQ.map(({ questionKey, answerKey }, index) => (
            <FaqItem key={questionKey} index={index} question={t(questionKey)} answer={t(answerKey)} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default EnterpriseFaqSection;
