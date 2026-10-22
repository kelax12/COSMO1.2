import { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
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

  // ── Maquette 104 : le RETOUR se dit aussi ────────────────────────────
  //
  // Le bandeau annonçait la panne et se taisait ensuite : il disparaissait, ce
  // qui laisse exactement la question qu'on se pose en le lisant (« est-ce que
  // ce que j'ai fait est parti ? ») sans réponse. Une confirmation brève vaut
  // mieux qu'un silence, et elle ne coûte qu'un état.
  //
  // ⚠️ `wasOffline` et pas un simple `online` : sans lui, la confirmation
  // s'afficherait au PREMIER rendu de toute session normale, où l'on a
  // toujours été en ligne.
  const wasOffline = useRef(false);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        setJustBack(true);
      }
    };
    const goOffline = () => {
      wasOffline.current = true;
      setJustBack(false);
      setOnline(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // La confirmation s'efface seule. Le minuteur est nettoyé au démontage comme
  // à tout nouveau passage hors ligne, sinon deux coupures rapprochées
  // laisseraient un `setJustBack(false)` en vol.
  useEffect(() => {
    if (!justBack) return;
    const id = setTimeout(() => setJustBack(false), 3000);
    return () => clearTimeout(id);
  }, [justBack]);

  if (isDemo) return null;

  if (online) {
    if (!justBack) return null;
    return (
      <div
        role="status"
        aria-live="polite"
        className="md:hidden flex items-center gap-2 px-gutter py-1.5 border-b border-emerald-500/25 bg-emerald-500/10 text-caption leading-snug text-[rgb(var(--color-text-secondary))]"
      >
        <Wifi size={13} className="shrink-0 text-emerald-500" aria-hidden="true" />
        <p className="min-w-0 flex-1 font-medium text-[rgb(var(--color-text-primary))]">
          {t('offline.back')}
        </p>
      </div>
    );
  }

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
