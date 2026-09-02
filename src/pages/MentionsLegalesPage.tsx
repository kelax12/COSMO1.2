import React from 'react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { useT } from '@/i18n/useT';
import LegalDocument, { type LegalSection } from './legal/LegalDocument';

/**
 * Mentions légales.
 *
 * Le texte vit dans le catalogue `legal` (fr + en) ; cette page ne déclare que
 * la structure du document. Voir `legal/LegalDocument.tsx` (risque R-13).
 *
 * ⚠️ Les deux premières sections portent des informations FACTUELLES (éditeur,
 * hébergeurs et leurs adresses). Elles doivent être vérifiées, pas traduites
 * librement : une adresse d'hébergeur inexacte est un défaut de mention légale,
 * pas une maladresse de rédaction.
 */
const SECTIONS: LegalSection[] = [
  {
    title: 'notice.s1.title',
    blocks: [
      { kind: 'p', key: 'notice.s1.intro' },
      {
        kind: 'ul',
        items: ['notice.s1.li1', 'notice.s1.li2', 'notice.s1.li3'],
        bullets: false,
      },
    ],
  },
  {
    title: 'notice.s2.title',
    blocks: [
      { kind: 'p', key: 'notice.s2.intro' },
      { kind: 'ul', items: ['notice.s2.li1', 'notice.s2.li2'], bullets: false },
    ],
  },
  {
    title: 'notice.s3.title',
    blocks: [{ kind: 'p', key: 'notice.s3.p1' }, { kind: 'p', key: 'notice.s3.p2' }],
  },
  {
    title: 'notice.s4.title',
    blocks: [{ kind: 'p', key: 'notice.s4.p1' }, { kind: 'p', key: 'notice.s4.p2' }],
  },
  { title: 'notice.s5.title', blocks: [{ kind: 'p', key: 'notice.s5.p1' }] },
  { title: 'notice.s6.title', blocks: [{ kind: 'p', key: 'notice.s6.p1' }] },
  { title: 'notice.s7.title', blocks: [{ kind: 'p', key: 'notice.s7.p1' }] },
];

const MentionsLegalesPage: React.FC = () => {
  const { t } = useT('legal');
  useSeoMeta({
    title: t('notice.seoTitle'),
    description: t('notice.seoDescription'),
    canonical: 'https://thecosmo.app/mentions-legales',
  });

  return (
    <LegalDocument
      titleKey="notice.title"
      updatedAtKey="notice.updatedAt"
      sections={SECTIONS}
    />
  );
};

export default MentionsLegalesPage;
