// src/components/org-guide/GuideControlBar.tsx
import type { SyntheticEvent } from 'react';
import { Pause, Play, SkipForward, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { Button } from '@/components/ui/button';

interface Props {
  actionLabel: string;
  current: number;
  total: number;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onQuit: () => void;
}

/**
 * Un dialogue Radix ouvert par la démo écoute `pointerdown` sur le document
 * pour se fermer au clic extérieur : la barre arrête la propagation, sinon
 * « Pause » refermerait le formulaire qu'on est en train d'expliquer.
 */
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function GuideControlBar({ actionLabel, current, total, paused, onPause, onResume, onSkip, onQuit }: Props) {
  const { t } = useT('orgGuide');
  return (
    <div
      role="toolbar"
      aria-label={actionLabel}
      onPointerDown={stop}
      onMouseDown={stop}
      className="pointer-events-auto fixed bottom-6 left-1/2 z-[530] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-popover px-3 py-1.5 text-popover-foreground shadow-lg"
    >
      <span className="px-2 text-xs text-muted-foreground">
        {t('control.progress', { action: actionLabel, current, total })}
      </span>
      <Button type="button" size="icon" variant="ghost" aria-label={t(paused ? 'control.resume' : 'control.pause')} onClick={paused ? onResume : onPause}>
        {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onSkip}>
        <SkipForward className="mr-1 h-4 w-4" aria-hidden="true" />{t('control.skip')}
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label={t('control.quit')} onClick={onQuit}>
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
