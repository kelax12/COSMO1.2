import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  // Calculé dès le premier rendu (2026-10-21) : à `undefined`, tout composant
  // se rendait d'abord en version bureau sur un téléphone, puis basculait une
  // image plus tard (pile du hero entreprise, relève de la copie du prérendu).
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() =>
    typeof window === 'undefined' ? undefined : window.innerWidth < MOBILE_BREAKPOINT,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isMobile;
}
