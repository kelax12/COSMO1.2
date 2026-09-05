import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useIsDemo } from '@/lib/app-mode.store';
import { useT } from '@/i18n/useT';

/**
 * Bandeau hors ligne (maquette 48) — mobile.
 *
 * « Le cas mobile par excellence — métro, ascenseur, avion. » Le produit ne
 * disait rien : la liste continuait de s'afficher (le cache React Query la
 * sert), et cocher une tâche la cochait puis la décochait toute seule, parce
 * que la mutation optimiste se remet en arrière quand l'écriture échoue. Une
 * coche qui revient en arrière sans explication fait douter de toutes les
 * autres, et le doute suffit à faire rouvrir un carnet papier.
 *
 * 🔴 CE QUE LE BANDEAU DIT EST CE QUI SE PASSE VRAIMENT, et ce n'est pas la
 * phrase de la maquette (« vos modifications partiront au retour du réseau »).
 * Cette phrase supposerait une file d'écritures différées : `App.tsx` fixe
 * `networkMode: 'always'` sur les mutations, délibérément et avec sa raison
 * écrite (`navigator.onLine` est peu fiable sur Safari iOS et laissait les
 * pages bloquées sur leur squelette). Avec ce réglage, une écriture hors ligne
 * ne s'empile pas : elle échoue. Promettre qu'elle partira plus tard serait le
 * seul mensonge que cet écran ne peut pas se permettre — c'est justement la
 * confiance qu'il existe pour réparer.
 *
 * Le jour où une vraie file sera posée (mutations en `networkMode: 'online'` +
 * persistance du cache de mutations), c'est CETTE clé qu'il faudra changer,
 * pas le bandeau.
 *
 * En mode démo, rien ne part au réseau : le bandeau n'a aucun sens et n'est pas
 * monté.
 */
const OfflineBanner: React.FC = () => {
  const { t } = useT('common');
  const isDemo = useIsDemo();
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (online || isDemo) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Mobile uniquement : sur desktop, `SyncStatusIndicator` dit déjà
      // « Hors ligne » dans la barre latérale, et ce bandeau y serait un
      // changement de rendu que rien ne demande.
      className="md:hidden flex items-center gap-2 px-gutter py-1.5 border-b border-amber-500/25 bg-amber-500/10 text-caption leading-snug text-[rgb(var(--color-text-secondary))]"
    >
      <WifiOff size={13} className="shrink-0 text-amber-500" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-medium text-[rgb(var(--color-text-primary))]">
          {t('offline.label')}
        </span>
        {t('offline.text')}
      </p>
    </div>
  );
};

export default OfflineBanner;
