import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
import { useT } from '@/i18n/useT';

/**
 * Toast d'annulation réutilisable avec barre de progression.
 *
 * Affiche un message + un bouton « Annuler » et une barre de progression qui
 * se vide sur `duration` ms (5 s par défaut). À l'expiration, le toast se ferme
 * tout seul. Le bouton « Annuler » exécute `onUndo` puis ferme le toast.
 *
 * Le Toaster global est positionné en haut à droite (cf. `src/App.tsx`), donc
 * ce toast apparaît bien en haut à droite comme attendu.
 */
export function showUndoToast(
  message: string,
  onUndo: () => void,
  opts?: { duration?: number }
): void {
  const duration = opts?.duration ?? 5000;

  toast.custom(
    (id) => (
      <UndoToastCard
        message={message}
        duration={duration}
        onUndo={() => {
          onUndo();
          toast.dismiss(id);
        }}
      />
    ),
    { duration }
  );
}

interface UndoToastCardProps {
  message: string;
  duration: number;
  onUndo: () => void;
}

/**
 * Décompte 100 % → 0 % via la Web Animations API : contrairement à
 * framer-motion, elle ignore `MotionConfig reducedMotion` et le réglage OS
 * « réduire les animations » ne gèle donc pas le décompte visuel. Ce détail
 * n'est pas cosmétique : le décompte est ce qui remplace la confirmation, un
 * décompte figé ferait croire que le geste est encore rattrapable.
 */
/**
 * Maquette 24 — « Annuler avec un compte à rebours visible ».
 *
 * L'anneau entoure le bouton « Annuler » : il dit, sans dialogue et sans
 * phrase, que le geste devient irréversible dans cinq secondes. C'est lui qui
 * remplace la boîte de confirmation, et c'est pour ça qu'il vit SUR le bouton
 * plutôt qu'ailleurs dans le toast — la question « puis-je encore revenir ? »
 * se pose à l'endroit où l'on revient.
 *
 * Mobile uniquement : sur desktop la barre du bas est conservée telle quelle.
 */
function CountdownRing({ duration }: { duration: number }) {
  const circleRef = useRef<SVGCircleElement>(null);
  const R = 15;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    const el = circleRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const anim = el.animate(
      [{ strokeDashoffset: '0' }, { strokeDashoffset: `${C}` }],
      { duration, easing: 'linear', fill: 'forwards' }
    );
    return () => anim.cancel();
  }, [duration, C]);

  return (
    <svg viewBox="0 0 34 34" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
      <circle
        ref={circleRef}
        cx="17"
        cy="17"
        r={R}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        stroke="rgb(var(--color-accent-solid))"
        strokeDasharray={C}
      />
    </svg>
  );
}

function ProgressBar({ duration }: { duration: number }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el || typeof el.animate !== 'function') return;
    const anim = el.animate(
      [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
      { duration, easing: 'linear', fill: 'forwards' }
    );
    return () => anim.cancel();
  }, [duration]);

  return <div ref={barRef} className="h-full w-full bg-[rgb(var(--color-accent-solid))] origin-left" />;
}

function UndoToastCard({ message, duration, onUndo }: UndoToastCardProps) {
  const { t } = useT('common');
  return (
    <div
      className="flex flex-col gap-0 md:gap-2 w-[320px] max-w-[90vw] rounded-xl border shadow-lg overflow-hidden"
      style={{
        backgroundColor: 'rgb(var(--color-surface))',
        borderColor: 'rgb(var(--color-border))',
      }}
    >
      <div className="flex items-center justify-between gap-3 py-1 pl-4 pr-1.5 md:px-4 md:pt-3 md:pb-0">
        <span
          className="text-sm font-medium"
          style={{ color: 'rgb(var(--color-text-primary))' }}
        >
          {message}
        </span>
        {/* ── Mobile : l'anneau (maquette 24) ── */}
        <button
          type="button"
          onClick={onUndo}
          aria-label={t('actions.undo')}
          className="relative md:hidden shrink-0 inline-flex h-touch w-touch items-center justify-center rounded-full text-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid))]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <CountdownRing duration={duration} />
          <Undo2 size={17} aria-hidden="true" />
        </button>

        {/* ── Desktop (inchangé) ── */}
        <button
          type="button"
          onClick={onUndo}
          className="hidden md:inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] active:bg-blue-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Undo2 size={15} aria-hidden="true" />
          {t('actions.undo')}
        </button>
      </div>
      {/* La barre du bas ne sert plus que le desktop : sur mobile l'anneau dit
          déjà le temps qu'il reste, et deux décomptes pour un seul geste. */}
      <div
        className="hidden md:block h-1.5 w-full overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-hover))' }}
      >
        <ProgressBar duration={duration} />
      </div>
    </div>
  );
}
