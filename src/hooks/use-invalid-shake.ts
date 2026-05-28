import { useCallback, useRef, useState } from 'react';

/**
 * Marque visuellement les champs requis non remplis quand l'utilisateur tente
 * de valider un formulaire qui ne l'est pas encore.
 *
 * Pattern : le bouton de validation reste cliquable (jamais `disabled`) mais
 * stylé "inactif". Au clic, si le formulaire est invalide, on appelle
 * `trigger(missingFields)` : chaque champ enregistré via `register(name)`
 * reçoit une bordure rouge (via `isInvalid(name)`) + une animation de secousse,
 * et le premier champ manquant scrolle dans la vue.
 */
export function useInvalidShake() {
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const register = useCallback(
    (name: string) => (el: HTMLElement | null) => {
      refs.current[name] = el;
    },
    []
  );

  const trigger = useCallback((missing: string[]) => {
    if (!missing.length) return;
    setInvalid(Object.fromEntries(missing.map((m) => [m, true])));

    requestAnimationFrame(() => {
      missing.forEach((name) => {
        const el = refs.current[name];
        if (!el) return;
        // Retire puis ré-ajoute la classe pour re-déclencher l'animation
        // même si le champ était déjà marqué invalide au clic précédent.
        el.classList.remove('animate-shake');
        void el.offsetWidth; // force reflow
        el.classList.add('animate-shake');
        const onEnd = () => {
          el.classList.remove('animate-shake');
          el.removeEventListener('animationend', onEnd);
        };
        el.addEventListener('animationend', onEnd);
      });
      const first = refs.current[missing[0]];
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const clear = useCallback((name: string) => {
    setInvalid((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const reset = useCallback(() => setInvalid({}), []);

  const isInvalid = useCallback((name: string) => !!invalid[name], [invalid]);

  return { register, trigger, clear, reset, isInvalid };
}
