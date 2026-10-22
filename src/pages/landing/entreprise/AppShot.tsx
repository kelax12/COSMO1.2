import React from 'react';

interface AppShotProps {
  /** Chemin de la capture dans `public/screenshots/entreprise/`. */
  src: string;
  /** Description du contenu de l'écran — vraie alternative textuelle. */
  alt: string;
  /** Libellé affiché dans la barre de fenêtre. */
  label: string;
  /** `eager` pour la capture visible dès le hero, `lazy` pour les autres. */
  loading?: 'eager' | 'lazy';
  className?: string;
}

/**
 * Une vraie capture de l'espace entreprise, dans son cadre de fenêtre.
 *
 * Les captures sont prises sur l'application en **mode démo, thème noir**
 * (`public/screenshots/entreprise/*.webp`, 1600 px de large, ~40 kB chacune) :
 * ce sont les écrans réels, avec les données réelles du seed démo — la même
 * organisation « Nova Studio » que le visiteur verra en cliquant sur la démo.
 * Le thème noir n'est pas un choix esthétique gratuit : une capture en thème
 * clair ferait une tache blanche au milieu d'un parcours graphite.
 *
 * ⚠️ À REPRENDRE quand l'UI entreprise change — une capture périmée ment sur
 * le produit. Procédure dans `docs/SEO.md` § captures de la landing.
 */
const AppShot: React.FC<AppShotProps> = ({ src, alt, label, loading = 'lazy', className = '' }) => (
  <figure
    className={`flex h-full flex-col overflow-hidden rounded-xl border border-white/[0.09] bg-[#0A0C11] shadow-[0_24px_70px_-30px_rgba(0,0,0,0.9)] ${className}`}
  >
    {/* Barre de fenêtre : signale « ceci est un écran de l'app », pas une
        illustration. */}
    <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
      <span className="flex gap-1.5" aria-hidden="true">
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="h-2 w-2 rounded-full bg-cyan-400/60" />
      </span>
      <figcaption className="ml-1 truncate font-mono text-caption uppercase tracking-[0.2em] text-slate-500">
        {label}
      </figcaption>
    </div>

    {/* `object-top` : les captures sont cadrées depuis la barre d'onglets, donc
        c'est le HAUT qui porte l'information. Un recadrage centré couperait les
        onglets, qui sont précisément ce qu'on veut montrer. */}
    <img
      src={src}
      alt={alt}
      width={1600}
      height={1000}
      loading={loading}
      decoding="async"
      className="h-full w-full object-cover object-top"
    />
  </figure>
);

export default AppShot;
