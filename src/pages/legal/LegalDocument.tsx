import React from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { RichText } from '@/components/ui/rich-text';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

/**
 * Coquille commune aux trois documents contractuels (CGU, confidentialité,
 * mentions légales).
 *
 * 🔴 POURQUOI (revue du 2026-09-02, risque R-13). Les trois pages étaient
 * écrites en JSX français en dur : 153 chaînes, soit l'essentiel de la dette
 * i18n du dépôt. La locale `en` étant réellement servie (`SUPPORTED_LOCALES`),
 * un anglophone se voyait présenter des conditions générales dans une langue
 * qu'il n'a pas choisie, au moment précis où leur opposabilité compte.
 *
 * ── CE QUE CE COMPOSANT NE FAIT PAS ────────────────────────────────
 *
 * Il ne met AUCUN texte dans le code. Chaque page déclare la STRUCTURE de son
 * document (l'ordre des sections, et pour chacune si le bloc est un paragraphe,
 * une liste ou une note), et le texte vient du catalogue `legal`. C'est la
 * séparation qui permet à une traduction de déplacer une emphase ou un lien
 * sans toucher au rendu.
 *
 * ⚠️ Le gras et les liens sont portés par le catalogue en `**gras**` et
 * `[libellé](url)`, rendus par `RichText`. Découper une phrase en trois clés
 * (avant / gras / après) figerait l'ordre des mots, ce qu'aucune langue ne
 * supporte — et sur un document contractuel, une phrase recomposée n'est plus
 * la phrase qui a été relue.
 */

/** Un bloc de contenu à l'intérieur d'une section. */
export type LegalBlock =
  | { kind: 'p'; key: KeyOf<'legal'> }
  /** Paragraphe secondaire, rendu plus discret (précisions, exceptions). */
  | { kind: 'note'; key: KeyOf<'legal'> }
  | { kind: 'ul'; items: KeyOf<'legal'>[]; bullets?: boolean };

export interface LegalSection {
  title: KeyOf<'legal'>;
  blocks: LegalBlock[];
}

const STRONG = 'text-white font-semibold';
// Soulignement PERMANENT : sur un document contractuel, un lien reconnaissable
// à sa seule couleur est un échec WCAG 1.4.1 (le bandeau cookies porte déjà
// cette règle en commentaire).
const LINK = 'text-blue-300 underline underline-offset-2 hover:text-blue-200';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-10">
    <h2 className="text-xl font-bold text-white mb-4 pb-2 border-b border-white/10">{title}</h2>
    <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
  </div>
);

interface LegalDocumentProps {
  /** Clé du titre principal, dans le namespace `legal`. */
  titleKey: KeyOf<'legal'>;
  /** Clé de la date de dernière mise à jour (une chaîne, pas une date). */
  updatedAtKey: KeyOf<'legal'>;
  sections: LegalSection[];
}

export const LegalDocument: React.FC<LegalDocumentProps> = ({
  titleKey,
  updatedAtKey,
  sections,
}) => {
  const { t } = useT('legal');
  const navigate = useNavigate();

  const renderBlock = (block: LegalBlock, i: number) => {
    if (block.kind === 'ul') {
      const bullets = block.bullets ?? true;
      return (
        <ul
          key={i}
          className={`${bullets ? 'list-disc list-inside' : 'list-none'} space-y-1 mt-2`}
        >
          {block.items.map((item) => (
            <li key={item}>
              <RichText strongClassName={STRONG} linkClassName={LINK}>{t(item)}</RichText>
            </li>
          ))}
        </ul>
      );
    }
    const className = block.kind === 'note' ? 'mt-3 text-slate-400 text-sm' : undefined;
    return (
      <p key={i} className={className}>
        <RichText strongClassName={STRONG} linkClassName={LINK}>{t(block.key)}</RichText>
      </p>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-10 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          {t('back')}
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">{t(titleKey)}</h1>
        <p className="text-slate-400 mb-10">{t('updated', { date: t(updatedAtKey) })}</p>

        {sections.map((section) => (
          <Section key={section.title} title={t(section.title)}>
            {section.blocks.map(renderBlock)}
          </Section>
        ))}
      </div>
    </div>
  );
};

export default LegalDocument;
