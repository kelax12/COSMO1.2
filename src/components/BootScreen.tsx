import React from 'react';
import { useT } from '@/i18n/useT';

/**
 * Le spinner de démarrage d'index.html (`#boot-screen`), rendu par React.
 *
 * 🔴 POURQUOI (2026-10-21). Sur une page publique (guide, blog, cas d'usage,
 * pages légales, connexion…), un visiteur voyait le texte SEO brut sur fond
 * blanc, puis le `PageLoader` de l'app (un AUTRE spinner, aux couleurs du
 * thème, centré dans 60vh), puis la page : trois écrans. Ces pages peignent
 * désormais le spinner de démarrage (prerender.mjs ne leur pose plus
 * `data-prerendered`), et ce composant le prolonge pendant le chargement du
 * chunk de la page : même classe, donc même CSS (le <style> d'index.html),
 * mêmes couleurs de thème (`html[data-boot-theme]`), même position plein
 * écran. La relève spinner → spinner est invisible.
 *
 * ❌ Ne pas l'utiliser DANS le Layout de l'app : il couvrirait la barre
 * latérale. Le `PageLoader` d'`App.tsx` reste celui des pages protégées.
 */
const BootScreen: React.FC = () => {
  const { t } = useT('common');
  return (
    <div className="boot-screen" role="status" aria-label={t('loading')}>
      <div className="ring" />
    </div>
  );
};

export default BootScreen;
