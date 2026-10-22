import React, { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import BottomSheet from '@/components/mobile/BottomSheet';
import { Button } from '@/components/ui/button';
import { useHabits } from '@/modules/habits';
import { useTasks } from '@/modules/tasks';
import { useWorkTimeStats } from '@/modules/stats';
import { buildRecap, startOfWeek, type RecapData } from '@/lib/share/recap-data';
import { useT } from '@/i18n/useT';

/**
 * Bilan de la semaine, en image 1080×1920 prête à poster.
 *
 * Le lien de la légende porte `?ref=share_recap` : c'est ce paramètre que
 * `src/lib/attribution.ts` capte en first-touch chez le visiteur, donc le seul
 * moyen de savoir si ce canal produit quoi que ce soit.
 *
 * Confidentialité : l'image ne contient que des agrégats (cf. l'avertissement
 * en tête de `recap-data.ts`). Aucun nom de tâche, d'habitude ou de catégorie.
 */
const SHARE_URL = 'https://thecosmo.app/?ref=share_recap';

const toKey = (date: Date) => date.toLocaleDateString('en-CA');

interface Props {
  open: boolean;
  onClose: () => void;
}

const WeeklyRecapSheet: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useT('habits');
  const { data: habits = [] } = useHabits();
  const { data: tasks = [] } = useTasks();

  // Semaine en cours, en dates locales (convention en-CA du projet).
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const ranges = open ? [{ start: toKey(weekStart), end: toKey(weekEnd) }] : [];
  const { data: buckets } = useWorkTimeStats(ranges);

  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!open) {
      setDataUrl(null);
      setBlob(null);
      return;
    }
    let cancelled = false;
    setIsRendering(true);

    const recap: RecapData = buildRecap({
      habits,
      tasks,
      minutes: buckets?.[0]?.totalTime ?? null,
    });

    // Import dynamique : le moteur de rendu ne pèse sur aucun écran tant que
    // l'utilisateur n'a pas ouvert son bilan (règle P-2, docs/PERFORMANCE.md).
    import('@/lib/share/recap-canvas')
      .then(({ renderRecapPng }) =>
        renderRecapPng(recap, {
          title: t('recapTitle'),
          tasks: t('recapTasks'),
          streak: t('recapStreak'),
          streakUnit: t('recapStreakUnit'),
          time: t('recapTime'),
          habits: t('recapHabits'),
          cta: t('recapImageCta'),
        })
      )
      .then((result) => {
        if (cancelled) return;
        setDataUrl(result.dataUrl);
        setBlob(result.blob);
      })
      .finally(() => {
        if (!cancelled) setIsRendering(false);
      });

    return () => {
      cancelled = true;
    };
    // `buckets` change quand le temps investi arrive : on re-rend alors l'image.
  }, [open, habits, tasks, buckets, t]);

  const fileName = `cosmo-bilan-${toKey(weekStart)}.png`;

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  };

  /**
   * Web Share niveau fichier quand le navigateur le supporte (mobile), repli
   * téléchargement sinon : `navigator.share` sans `canShare({files})` échoue
   * silencieusement sur desktop, ce qui donnerait un bouton mort.
   */
  const canShareFile = () => {
    if (!blob || typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
    try {
      return navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] });
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      await navigator.share({ files: [file], text: `${t('recapShareText')} ${SHARE_URL}` });
    } catch {
      // Partage annulé ou refusé : on ne toaste pas une action que
      // l'utilisateur vient peut-être d'annuler lui-même.
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={t('recapTitle')}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {t('recapSheetTitle')}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--color-text-secondary))' }}>
              {t('recapSheetSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('recapClose')}
            className="p-2 rounded-lg"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="rounded-xl overflow-hidden mb-4 flex items-center justify-center"
          style={{ backgroundColor: 'rgb(var(--color-hover))', minHeight: 220 }}
        >
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={t('recapAlt')}
              className="w-full h-auto max-h-[46vh] object-contain"
            />
          ) : (
            <span className="text-sm py-16" style={{ color: 'rgb(var(--color-text-muted))' }}>
              {isRendering ? t('recapRendering') : t('recapEmpty')}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {canShareFile() && (
            <Button onClick={handleShare} disabled={!blob} className="flex-1">
              <Share2 className="w-4 h-4 mr-2" />
              {t('recapShare')}
            </Button>
          )}
          <Button variant="outline" onClick={handleDownload} disabled={!dataUrl} className="flex-1">
            <Download className="w-4 h-4 mr-2" />
            {t('recapDownload')}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};

export default WeeklyRecapSheet;
