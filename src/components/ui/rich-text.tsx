import React from 'react';

/**
 * Rend un texte traduit contenant du **gras** et des [liens](url) inline.
 *
 * Pourquoi ce composant plutôt que du JSX dans la page : la prose du Guide et
 * celle des pages légales mêlent des `<strong>` et des liens au milieu des
 * phrases (« cliquez sur **Nouvelle tâche** en haut de la page », « écrivez-nous
 * à [contact](mailto:…) »). Les deux alternatives sont pires :
 *
 *   - découper la phrase en clés (`avant` / `gras` / `après`) fige l'ordre des
 *     mots, alors qu'il change d'une langue à l'autre — c'est précisément ce
 *     qu'une chaîne complète est censée permettre au traducteur ;
 *   - retirer le gras appauvrit une page dont c'est le repère de lecture
 *     principal, et retirer les liens casse l'exercice des droits RGPD, qui
 *     passe par une adresse cliquable.
 *
 * Le catalogue porte donc la phrase entière avec un balisage minimal, et le
 * traducteur reste libre de placer l'emphase et le lien où sa langue l'exige.
 *
 * Volontairement limité au gras et aux liens : pas de moteur Markdown, pas de
 * HTML injecté (`dangerouslySetInnerHTML` sur du contenu de catalogue serait une
 * porte XSS ouverte le jour où une traduction vient d'ailleurs que du dépôt).
 */

/**
 * Schémas autorisés dans un `[libellé](url)`.
 *
 * ⚠️ Un chemin INTERNE (`/cgu`) n'est volontairement pas accepté : les slugs de
 * routes sont localisés (`src/i18n/routes.ts`), donc un chemin écrit dans un
 * catalogue rendrait une 404 dans l'autre langue — le bug mesuré le 2026-09-02
 * sur les liens du bandeau cookies. La navigation interne passe par un `<Link>`
 * et `useLocalizedPath()`, jamais par le texte traduit.
 *
 * ❌ Ne JAMAIS élargir cette liste à `javascript:` ni à `data:`. Les catalogues
 * viennent du dépôt aujourd'hui, mais une traduction contribuée reste du texte
 * dont on ne contrôle pas la provenance, et un lien est le vecteur le plus
 * court entre une chaîne et une exécution. Une URL refusée est rendue en TEXTE
 * BRUT : la phrase reste lisible, seul le lien disparaît.
 */
const SAFE_SCHEMES = ['https://', 'mailto:'];

const isSafeHref = (url: string): boolean =>
  SAFE_SCHEMES.some((scheme) => url.toLowerCase().startsWith(scheme));

/** Découpe en gardant les délimiteurs : gras d'abord, puis liens. */
// L'URL accepte UNE parenthese imbriquee : `…/Turing_(machine)`. Avec `[^)]+`,
// le motif s'arretait a la premiere parenthese fermante et rendait un lien vers
// une URL TRONQUEE, en laissant le `)` restant dans la phrase. Un lien qui pointe
// silencieusement ailleurs est pire que pas de lien du tout.
const URL_PART = '(?:[^()]|\\([^()]*\\))+';
const TOKEN = new RegExp(`(\\*\\*[^*]+\\*\\*|\\[[^\\]]+\\]\\(${URL_PART}\\))`, 'g');
const LINK = new RegExp(`^\\[([^\\]]+)\\]\\((${URL_PART})\\)$`);

export const RichText: React.FC<{
  children: string;
  /** Classe appliquée aux segments en gras (la page décide de sa couleur). */
  strongClassName?: string;
  /**
   * Classe appliquée aux liens (idem).
   *
   * ⚠️ Le défaut porte un `underline` PERMANENT, pas au seul survol : un lien
   * distingué par la seule couleur est un échec WCAG 1.4.1, et ces phrases
   * incluent les pages contractuelles. Une surcharge qui retire le soulignement
   * doit fournir un autre repère non chromatique.
   */
  linkClassName?: string;
}> = ({
  children,
  strongClassName = 'font-semibold text-[rgb(var(--color-text-primary))]',
  linkClassName = 'text-[rgb(var(--color-accent-solid))] underline underline-offset-2',
}) => {
  const parts = children.split(TOKEN);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return (
            <strong key={i} className={strongClassName}>
              {part.slice(2, -2)}
            </strong>
          );
        }

        const link = LINK.exec(part);
        if (link) {
          const [, label, url] = link;
          if (!isSafeHref(url)) {
            // Schéma refusé : on garde le LIBELLÉ, on jette le lien. Le silence
            // était le vrai défaut — une phrase perdait son lien sans que rien
            // ne le dise, y compris sur les pages contractuelles. En dev, le
            // refus est annoncé ; en prod, la phrase reste lisible.
            if (import.meta.env.DEV) {
              console.warn(`[RichText] lien ignoré, schéma non autorisé : ${url}`);
            }
            return <React.Fragment key={i}>{label}</React.Fragment>;
          }
          const external = url.startsWith('https://');
          return (
            <a
              key={i}
              href={url}
              className={linkClassName}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {label}
            </a>
          );
        }

        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
};

export default RichText;
