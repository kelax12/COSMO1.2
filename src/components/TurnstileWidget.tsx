import React, { useEffect, useRef } from 'react';
import { isTurnstileEnabled, loadTurnstile, turnstileSiteKey } from '@/lib/turnstile';

interface Props {
  /** Reçoit le jeton, ou `null` quand il expire / échoue. */
  onToken: (token: string | null) => void;
}

/**
 * Widget Turnstile. **Ne rend RIEN si la protection n'est pas configurée** —
 * c'est ce qui rend ce composant sûr à déployer avant que le compte Cloudflare
 * existe.
 *
 * ⚠️ Le jeton est à **usage unique et de courte durée**. D'où
 * `expired-callback`, qui remet le jeton à `null` : sans lui, un formulaire
 * resté ouvert dix minutes soumettrait un jeton périmé, le serveur le
 * refuserait, et l'utilisateur verrait un échec inexplicable sur une saisie
 * pourtant correcte.
 *
 * ⚠️ **Un échec de chargement ne bloque pas le formulaire.** Extension de
 * navigateur, réseau d'entreprise filtrant, panne du fournisseur : dans tous
 * ces cas on laisse soumettre. Si la protection est réellement active côté
 * Supabase, c'est le serveur qui refusera, avec un message traduit. Faire du
 * CAPTCHA une porte fermée côté client reviendrait à confier notre
 * disponibilité à un tiers.
 */
const TurnstileWidget: React.FC<Props> = ({ onToken }) => {
  const holder = useRef<HTMLDivElement>(null);
  // Le callback change à chaque rendu du parent ; le garder dans une ref évite
  // de re-rendre le widget (donc de redemander un challenge) pour rien.
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (!isTurnstileEnabled()) return;
    let widgetId: string | undefined;
    let cancelled = false;

    void loadTurnstile().then((api) => {
      const sitekey = turnstileSiteKey();
      if (cancelled || !api || !sitekey || !holder.current) return;
      widgetId = api.render(holder.current, {
        sitekey,
        callback: (token) => onTokenRef.current(token),
        'error-callback': () => onTokenRef.current(null),
        'expired-callback': () => onTokenRef.current(null),
        theme: 'auto',
      });
    });

    return () => {
      cancelled = true;
      try {
        if (widgetId) window.turnstile?.remove(widgetId);
      } catch {
        // Le script a pu disparaître avant nous — rien à nettoyer.
      }
    };
  }, []);

  if (!isTurnstileEnabled()) return null;
  return <div ref={holder} className="flex justify-center" />;
};

export default TurnstileWidget;
