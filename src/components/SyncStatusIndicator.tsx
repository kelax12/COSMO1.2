import { useEffect, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Check, Loader2, WifiOff } from 'lucide-react';
import { useIsDemo } from '@/lib/app-mode.store';

/**
 * Indicateur d'état de synchronisation (#37) : répond à l'angoisse de fond
 * « est-ce que c'est bien enregistré ? ». Trois états :
 *   ✓ Synchronisé · ⟳ Synchronisation… · ⚠ Hors ligne
 * En mode démo (localStorage), affiche « Local » — rien ne part au réseau.
 * `compact` = pastille seule (header mobile).
 */
const SyncStatusIndicator: React.FC<{ compact?: boolean; hideWhenSynced?: boolean }> = ({ compact = false, hideWhenSynced = false }) => {
  const isMutating = useIsMutating() > 0;
  const isDemo = useIsDemo();
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
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

  const state = !online ? 'offline' : isMutating ? 'syncing' : 'synced';

  // Mobile : zéro chrome au repos — l'indicateur n'apparaît que si ça bouge.
  if (hideWhenSynced && state === 'synced') return null;

  const config = {
    offline: { icon: WifiOff, label: 'Hors ligne', className: 'text-amber-500' },
    syncing: { icon: Loader2, label: 'Synchronisation…', className: 'text-blue-500' },
    synced: { icon: Check, label: isDemo ? 'Enregistré (local)' : 'Synchronisé', className: 'text-[rgb(var(--color-text-muted))]' },
  }[state];

  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={config.label}
      title={config.label}
      className={`flex items-center gap-1.5 text-xs ${config.className}`}
    >
      <Icon size={13} className={state === 'syncing' ? 'animate-spin' : ''} aria-hidden="true" />
      {!compact && <span>{config.label}</span>}
    </div>
  );
};

export default SyncStatusIndicator;
