// Détecte le mode « test » en observant la classe `test` du <html> (source de
// vérité globale appliquée par useDarkMode). Réactif via MutationObserver — le
// bascule de thème prend effet immédiatement même si l'utilisateur est déjà sur
// la page (useDarkMode étant un state local par instance).
import { useEffect, useState } from 'react';

const isTestTheme = () =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('test');

export function useTestMode(): boolean {
  const [testMode, setTestMode] = useState(isTestTheme);

  useEffect(() => {
    setTestMode(isTestTheme());
    const observer = new MutationObserver(() => setTestMode(isTestTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return testMode;
}
