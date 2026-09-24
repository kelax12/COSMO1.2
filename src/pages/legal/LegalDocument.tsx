import React from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { RichText } from '@/components/ui/rich-text';
import { useT } from '@/i18n/useT';
import type { KeyOf, Namespace } from '@/i18n/catalog';
import ManageCookiesButton from '@/components/ManageCookiesButton';

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
 * une liste ou une note), et le texte vient du catalogue de CE document
 * (`legalTerms`, `legalPrivacy` ou `legalNotice`). C'est la
 * séparation qui permet à une traduction de déplacer une emphase ou un lien
 * sans toucher au rendu.
 *
 * ⚠️ Le gras et les liens sont portés par le catalogue en `**gras**` et
 * `[libellé](url)`, rendus par `RichText`. Découper une phrase en trois clés
 * (avant / gras / après) figerait l'ordre des mots, ce qu'aucune langue ne
 * supporte — et sur un document contractuel, une phrase recomposée n'est plus
 * la phrase qui a été relue.
 */

/**
 * Un namespace par document contractuel (découpage du 2026-09-24, cf.
 * `src/i18n/catalog.ts`) : chaque page ne télécharge que SON texte. Les deux
 * libellés de la coquille vivent à part, dans `legalShared`.
 */
export type LegalDocNamespace = Extract<Namespace, 'legalTerms' | 'legalPrivacy' | 'legalNotice'>;

/** Un bloc de contenu à l'intérieur d'une section. */
export type LegalBlock<N extends LegalDocNamespace> =
  | { kind: 'p'; key: KeyOf<N> }
  /** Paragraphe secondaire, rendu plus discret (précisions, exceptions). */
  | { kind: 'note'; key: KeyOf<N> }
  | { kind: 'ul'; items: KeyOf<N>[]; bullets?: boolean }
  /** Bouton qui rouvre le bandeau de consentement (RGPD art. 7.3). */
  | { kind: 'cookie-settings' };

export interface LegalSection<N extends LegalDocNamespace> {
  title: KeyOf<N>;
  blocks: LegalBlock<N>[];
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

interface LegalDocumentProps<N extends LegalDocNamespace> {
  /**
   * Namespace du document. La route doit le déclarer dans `lazyWithRetry`
   * (src/App.tsx), avec `legalShared` : c'est ce qui le charge AVANT le rendu.
   */
  namespace: N;
  // ⚠️ `NoInfer` : `N` se déduit de `namespace` SEUL. Laisser TypeScript le
  // déduire aussi des clés lui fait unifier des unions de plusieurs centaines
  // de chemins, jusqu'à l'erreur TS2589 (« excessively deep »).
  /** Clé du titre principal, dans le namespace du document. */
  titleKey: NoInfer<KeyOf<N>>;
  /** Clé de la date de dernière mise à jour (une chaîne, pas une date). */
  updatedAtKey: NoInfer<KeyOf<N>>;
  sections: NoInfer<LegalSection<N>[]>;
}

export function LegalDocument<N extends LegalDocNamespace>({
  namespace,
  titleKey,
  updatedAtKey,
  sections,
}: LegalDocumentProps<N>) {
  const { t } = useT(namespace);
  const { t: tShared } = useT('legalShared');
  const navigate = useNavigate();

  const renderBlock = (block: LegalBlock<N>, i: number) => {
    if (block.kind === 'cookie-settings') {
      return (
        <p key={i}>
          <ManageCookiesButton className={LINK} />
        </p>
      );
    }
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
          {tShared('back')}
        </button>

        <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-white">{t(titleKey)}</h1>
        <p className="text-slate-400 mb-10">{tShared('updated', { date: t(updatedAtKey) })}</p>

        {sections.map((section) => (
          <Section key={section.title} title={t(section.title)}>
            {section.blocks.map(renderBlock)}
          </Section>
        ))}
      </div>
    </div>
  );
}

export default LegalDocument;
