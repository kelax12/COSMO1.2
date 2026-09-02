import React from 'react';

/**
 * Rend un texte traduit contenant du **gras** inline.
 *
 * Pourquoi ce composant plutôt que du JSX dans la page : la prose du Guide
 * mêle des `<strong>` au milieu des phrases (« cliquez sur **Nouvelle tâche**
 * en haut de la page »). Les deux alternatives sont pires :
 *
 *   - découper la phrase en clés (`avant` / `gras` / `après`) fige l'ordre des
 *     mots, alors qu'il change d'une langue à l'autre — c'est précisément ce
 *     qu'une chaîne complète est censée permettre au traducteur ;
 *   - retirer le gras appauvrit une page dont c'est le repère de lecture
 *     principal (les libellés de boutons à cliquer).
 *
 * Le catalogue porte donc la phrase entière avec un balisage minimal, et le
 * traducteur reste libre de placer l'emphase où sa langue l'exige.
 *
 * Volontairement limité au gras : pas de moteur Markdown, pas de HTML injecté
 * (`dangerouslySetInnerHTML` sur du contenu de catalogue serait une porte XSS
 * ouverte le jour où une traduction vient d'ailleurs que du dépôt).
 */
export const RichText: React.FC<{
  children: string;
  /** Classe appliquée aux segments en gras (la page décide de sa couleur). */
  strongClassName?: string;
}> = ({ children, strongClassName = 'font-semibold text-[rgb(var(--color-text-primary))]' }) => {
  // Découpe en gardant les délimiteurs : « a **b** c » → ['a ', '**b**', ' c'].
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={i} className={strongClassName}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

export default RichText;
