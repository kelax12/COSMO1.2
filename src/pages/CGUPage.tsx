import React from 'react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { useT } from '@/i18n/useT';
import LegalDocument, { type LegalSection } from './legal/LegalDocument';

/**
 * Conditions Générales d'Utilisation.
 *
 * Le texte vit dans le catalogue `legal` (fr + en) ; cette page ne déclare que
 * la STRUCTURE du document. Voir l'en-tête de `legal/LegalDocument.tsx` pour la
 * raison de ce découpage (risque R-13).
 *
 * ⚠️ Ajouter une section, c'est modifier un CONTRAT. Deux conséquences que le
 * code ne rappellera pas tout seul :
 *   - la date `terms.updatedAt` doit être avancée dans les DEUX catalogues ;
 *   - l'article 11 prévoit un préavis de 30 jours par e-mail pour toute
 *     modification substantielle.
 */
const SECTIONS: LegalSection[] = [
  {
    title: 'terms.s1.title',
    blocks: [{ kind: 'p', key: 'terms.s1.p1' }, { kind: 'p', key: 'terms.s1.p2' }],
  },
  {
    title: 'terms.s2.title',
    blocks: [
      { kind: 'p', key: 'terms.s2.intro' },
      { kind: 'ul', items: ['terms.s2.li1', 'terms.s2.li2', 'terms.s2.li3'] },
      { kind: 'p', key: 'terms.s2.outro' },
    ],
  },
  {
    title: 'terms.s3.title',
    blocks: [{ kind: 'p', key: 'terms.s3.p1' }, { kind: 'p', key: 'terms.s3.p2' }],
  },
  {
    title: 'terms.s4.title',
    blocks: [
      { kind: 'p', key: 'terms.s4.intro' },
      {
        kind: 'ul',
        items: [
          'terms.s4.li1', 'terms.s4.li2', 'terms.s4.li3',
          'terms.s4.li4', 'terms.s4.li5', 'terms.s4.li6',
        ],
      },
    ],
  },
  {
    title: 'terms.s5.title',
    blocks: [
      { kind: 'p', key: 'terms.s5.intro' },
      {
        kind: 'ul',
        items: [
          'terms.s5.li1', 'terms.s5.li2', 'terms.s5.li3',
          'terms.s5.li4', 'terms.s5.li5', 'terms.s5.li5bis', 'terms.s5.li6',
        ],
      },
    ],
  },
  {
    title: 'terms.s5bis.title',
    blocks: [
      { kind: 'p', key: 'terms.s5bis.p1' },
      { kind: 'p', key: 'terms.s5bis.p2' },
      { kind: 'p', key: 'terms.s5bis.p3' },
    ],
  },
  {
    title: 'terms.s6.title',
    blocks: [{ kind: 'p', key: 'terms.s6.p1' }, { kind: 'p', key: 'terms.s6.p2' }],
  },
  { title: 'terms.s7.title', blocks: [{ kind: 'p', key: 'terms.s7.p1' }] },
  { title: 'terms.s8.title', blocks: [{ kind: 'p', key: 'terms.s8.p1' }] },
  {
    title: 'terms.s9.title',
    blocks: [
      { kind: 'p', key: 'terms.s9.p1' },
      { kind: 'p', key: 'terms.s9.p2' },
      // Les garanties légales du consommateur ne se limitent pas : les omettre
      // rendait la clause abusive, donc réputée non écrite (2026-09-02).
      { kind: 'p', key: 'terms.s9.p3' },
    ],
  },
  {
    title: 'terms.s10.title',
    blocks: [{ kind: 'p', key: 'terms.s10.p1' }, { kind: 'p', key: 'terms.s10.p2' }],
  },
  {
    title: 'terms.s11.title',
    blocks: [{ kind: 'p', key: 'terms.s11.p1' }, { kind: 'p', key: 'terms.s11.p2' }],
  },
  {
    title: 'terms.s12.title',
    blocks: [
      { kind: 'p', key: 'terms.s12.p1' },
      // Une clause attributive de juridiction ne vaut pas contre un
      // consommateur : la réserver explicitement évite qu'elle le dissuade
      // d'agir, ce qui est le seul effet qu'elle avait (2026-09-02).
      { kind: 'p', key: 'terms.s12.p2' },
      { kind: 'p', key: 'terms.s12.p3' },
    ],
  },
  { title: 'terms.s13.title', blocks: [{ kind: 'p', key: 'terms.s13.p1' }] },
  { title: 'terms.s14.title', blocks: [{ kind: 'p', key: 'terms.s14.p1' }] },
];

const CGUPage: React.FC = () => {
  const { t } = useT('legal');
  useSeoMeta({
    title: t('terms.seoTitle'),
    description: t('terms.seoDescription'),
    canonical: 'https://thecosmo.app/cgu',
  });

  return (
    <LegalDocument
      titleKey="terms.title"
      updatedAtKey="terms.updatedAt"
      sections={SECTIONS}
    />
  );
};

export default CGUPage;
