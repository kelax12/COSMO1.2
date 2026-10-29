// Le pointeur sait-il survoler ? Souris oui, doigt non. Suit les changements
// (tablette qui gagne une souris).
import { useEffect, useState } from 'react';

export const useCanHover = (): boolean => {
  const query = '(hover: hover) and (pointer: fine)';
  const [canHover, setCanHover] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setCanHover(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);
  return canHover;
};
