import React from 'react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { useT } from '@/i18n/useT';
import LegalDocument, { type LegalSection } from './legal/LegalDocument';

/**
 * Politique de confidentialité.
 *
 * Le texte vit dans le catalogue `legal` (fr + en) ; cette page ne déclare que
 * la structure du document. Voir `legal/LegalDocument.tsx` (risque R-13).
 *
 * 🔴 Ce document DÉCRIT DES TRAITEMENTS RÉELS. Chaque phrase y est une
 * déclaration vérifiable, pas une formule : durées de conservation, liste des
 * sous-traitants, pages exclues de la mesure d'audience. Modifier le code sans
 * modifier ce texte transforme une politique en fausse déclaration. Le registre
 * de l'article 30 (`docs/RGPD-REGISTRE.md`) est l'autre moitié de la paire.
 */
const SECTIONS: LegalSection[] = [
  { title: 'privacy.s1.title', blocks: [{ kind: 'p', key: 'privacy.s1.p1' }] },
  {
    title: 'privacy.s2.title',
    blocks: [
      { kind: 'p', key: 'privacy.s2.intro' },
      {
        kind: 'ul',
        items: [
          'privacy.s2.li1', 'privacy.s2.li2', 'privacy.s2.li3',
          'privacy.s2.li4', 'privacy.s2.li5',
        ],
      },
      { kind: 'p', key: 'privacy.s2.p1' },
      { kind: 'p', key: 'privacy.s2.p2' },
      { kind: 'p', key: 'privacy.s2.p3' },
      { kind: 'note', key: 'privacy.s2.note' },
    ],
  },
  {
    title: 'privacy.s3.title',
    blocks: [
      { kind: 'p', key: 'privacy.s3.intro' },
      { kind: 'ul', items: ['privacy.s3.li1', 'privacy.s3.li2'] },
    ],
  },
  {
    title: 'privacy.s4.title',
    blocks: [
      { kind: 'p', key: 'privacy.s4.intro' },
      {
        kind: 'ul',
        items: [
          'privacy.s4.li1', 'privacy.s4.li2', 'privacy.s4.li3',
          'privacy.s4.li4', 'privacy.s4.li5',
        ],
      },
    ],
  },
  {
    title: 'privacy.s5.title',
    blocks: [
      { kind: 'p', key: 'privacy.s5.intro' },
      { kind: 'ul', items: ['privacy.s5.li1', 'privacy.s5.li2', 'privacy.s5.li3'] },
    ],
  },
  {
    title: 'privacy.s6.title',
    blocks: [
      {
        kind: 'ul',
        items: [
          'privacy.s6.li1', 'privacy.s6.li2', 'privacy.s6.li3',
          'privacy.s6.li4', 'privacy.s6.li5', 'privacy.s6.li6',
        ],
      },
      { kind: 'note', key: 'privacy.s6.note' },
    ],
  },
  {
    title: 'privacy.s7.title',
    blocks: [
      { kind: 'p', key: 'privacy.s7.intro' },
      {
        kind: 'ul',
        items: [
          'privacy.s7.li1', 'privacy.s7.li2', 'privacy.s7.li3', 'privacy.s7.li4',
          'privacy.s7.li5', 'privacy.s7.li6', 'privacy.s7.li7',
        ],
      },
      { kind: 'p', key: 'privacy.s7.outro' },
    ],
  },
  {
    title: 'privacy.s7bis.title',
    blocks: [
      { kind: 'p', key: 'privacy.s7bis.p1' },
      { kind: 'p', key: 'privacy.s7bis.p2' },
      { kind: 'p', key: 'privacy.s7bis.p3' },
    ],
  },
  {
    title: 'privacy.s8.title',
    blocks: [
      { kind: 'p', key: 'privacy.s8.intro' },
      {
        kind: 'ul',
        items: [
          'privacy.s8.li1', 'privacy.s8.li2', 'privacy.s8.li3',
          'privacy.s8.li4', 'privacy.s8.li5', 'privacy.s8.li6',
        ],
      },
      { kind: 'p', key: 'privacy.s8.p1' },
      { kind: 'p', key: 'privacy.s8.p2' },
      { kind: 'p', key: 'privacy.s8.p3' },
    ],
  },
  { title: 'privacy.s9.title', blocks: [{ kind: 'p', key: 'privacy.s9.p1' }] },
  {
    title: 'privacy.s10.title',
    blocks: [
      { kind: 'p', key: 'privacy.s10.intro' },
      { kind: 'ul', items: ['privacy.s10.li1', 'privacy.s10.li2', 'privacy.s10.li3'] },
      { kind: 'p', key: 'privacy.s10.consentIntro' },
      { kind: 'ul', items: ['privacy.s10.consentLi1'] },
      { kind: 'note', key: 'privacy.s10.note1' },
      { kind: 'note', key: 'privacy.s10.note2' },
    ],
  },
  { title: 'privacy.s11.title', blocks: [{ kind: 'p', key: 'privacy.s11.p1' }] },
  { title: 'privacy.s12.title', blocks: [{ kind: 'p', key: 'privacy.s12.p1' }] },
];

const PolitiqueConfidentialitePage: React.FC = () => {
  const { t } = useT('legal');
  useSeoMeta({
    title: t('privacy.seoTitle'),
    description: t('privacy.seoDescription'),
    canonical: 'https://thecosmo.app/politique-confidentialite',
  });

  return (
    <LegalDocument
      titleKey="privacy.title"
      updatedAtKey="privacy.updatedAt"
      sections={SECTIONS}
    />
  );
};

export default PolitiqueConfidentialitePage;
