import { AlertTriangle } from 'lucide-react';
import { useT } from '@/i18n/useT';

/**
 * Bandeau DURABLE d'une lecture plafonnée.
 *
 * `warnIfTruncated` prévient par un toast, une fois par session : passé ce
 * toast, l'écran affichait des chiffres faux sans plus rien en dire (audit
 * « passage à l'échelle » du 2026-09-24). Ce bandeau reste tant que c'est vrai,
 * à l'endroit exact où l'on lit les chiffres concernés.
 *
 * `role="status"` et non `alert` : c'est un état de l'écran, pas un évènement.
 */
const TruncatedDataNotice = ({ limit }: { limit: number }) => {
  const { t } = useT('org');
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl border border-amber-300/70 dark:border-amber-700/50 bg-amber-50/70 dark:bg-amber-900/15 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
    >
      <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />
      <span>{t('truncation.tasks', { limit: String(limit) })}</span>
    </p>
  );
};

export default TruncatedDataNotice;
