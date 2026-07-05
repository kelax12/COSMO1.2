import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Raccourcis de navigation séquentiels « g puis lettre » (amélioration UX n°44),
 * convention Linear/GitHub :
 *   g d → Accueil · g t → Tâches · g a → Agenda · g h → Habitudes
 *   g o → OKR · g s → Statistiques
 * Fenêtre de 1,5 s après « g ». Ignoré dans les champs de saisie.
 */
const CHORD_TARGETS: Record<string, string> = {
  d: '/dashboard',
  t: '/tasks',
  a: '/agenda',
  h: '/habits',
  o: '/okr',
  s: '/statistics',
};

const CHORD_WINDOW_MS = 1500;

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

const GlobalNavShortcuts: React.FC = () => {
  const navigate = useNavigate();
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();

      if (pendingG.current !== null && Date.now() - pendingG.current < CHORD_WINDOW_MS) {
        pendingG.current = null;
        const path = CHORD_TARGETS[key];
        if (path) {
          e.preventDefault();
          navigate(path);
          return;
        }
      }
      if (key === 'g') {
        pendingG.current = Date.now();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return null;
};

export default GlobalNavShortcuts;
