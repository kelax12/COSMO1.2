// src/components/org-guide/GuideBubble.tsx
import type { CursorPoint } from './GuideCursor';

/** Bulle collée au curseur, annoncée aux lecteurs d'écran par la région live de l'hôte. */
export function GuideBubble({ text, at, counter }: { text: string; at: CursorPoint | null; counter?: string }) {
  const style = at
    ? { left: Math.max(8, Math.min(at.x + 30, window.innerWidth - 260)), top: Math.max(8, Math.min(at.y + 16, window.innerHeight - 140)) }
    : { left: '50%', top: '40%', transform: 'translateX(-50%)' };
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[520] w-60 rounded-xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg"
      style={style}
    >
      {counter && <p className="mb-1 text-xs text-primary">{counter}</p>}
      <p className="leading-snug">{text}</p>
    </div>
  );
}
