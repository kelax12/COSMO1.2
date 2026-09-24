// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  COOKIE_CONSENT_KEY,
  COOKIE_CONSENT_AT_KEY,
  CONSENT_MAX_AGE_MS,
  requestConsentReview,
  stampLegacyConsent,
  subscribeConsentReview,
  readConsent,
  hasConsented,
  setConsent,
  subscribe,
  getSnapshot,
} from './cookie-consent';

/**
 * Ce module conditionne le chargement de deux traceurs. Une régression ici ne
 * casse aucun écran : elle rend simplement le bandeau menteur, ce qui est
 * exactement le manquement corrigé le 2026-08-26 (art. 82 loi I&L). D'où des
 * tests qui portent sur la SÉMANTIQUE des valeurs, pas sur la mécanique du
 * localStorage.
 */
describe('cookie-consent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('readConsent', () => {
    it('renvoie null quand la personne n a pas encore repondu', () => {
      expect(readConsent()).toBeNull();
    });

    it('relit une acceptation et un refus', () => {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      expect(readConsent()).toBe('accepted');
      localStorage.setItem(COOKIE_CONSENT_KEY, 'refused');
      expect(readConsent()).toBe('refused');
    });

    it('traite une valeur inattendue comme une absence de reponse', () => {
      // Une valeur corrompue ne doit JAMAIS valoir acceptation : on redemande.
      localStorage.setItem(COOKIE_CONSENT_KEY, 'peut-etre');
      expect(readConsent()).toBeNull();
    });

    it('renvoie null si le stockage est inaccessible', () => {
      // Navigation privée stricte : l'accès jette. Se tromper dans ce sens
      // coûte une mesure manquante, jamais un traceur posé sans consentement.
      const storage = {
        getItem: () => {
          throw new Error('SecurityError');
        },
      };
      expect(readConsent(storage)).toBeNull();
    });
  });

  describe('hasConsented', () => {
    it('n est vrai QUE sur une acceptation explicite', () => {
      expect(hasConsented()).toBe(false);
      localStorage.setItem(COOKIE_CONSENT_KEY, 'refused');
      expect(hasConsented()).toBe(false);
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      expect(hasConsented()).toBe(true);
    });

    it('ne traite pas l absence de reponse comme un accord tacite', () => {
      // C'est LE point de l'article 82 : le silence ne vaut pas consentement.
      expect(readConsent()).toBeNull();
      expect(hasConsented()).toBe(false);
    });
  });

  describe('setConsent', () => {
    it('persiste la reponse', () => {
      setConsent('accepted');
      expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('accepted');
      setConsent('refused');
      expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('refused');
    });

    it('notifie les abonnes', () => {
      const listener = vi.fn();
      subscribe(listener);
      setConsent('accepted');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifie MEME si le stockage echoue', () => {
      // La décision doit valoir pour la session en cours même si elle ne
      // survivra pas au rechargement : sans notification, accepter
      // n'afficherait rien et l'utilisateur croirait le clic perdu.
      const listener = vi.fn();
      subscribe(listener);
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => setConsent('accepted')).not.toThrow();
      expect(listener).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('subscribe', () => {
    it('rend une fonction de desabonnement qui fonctionne', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);
      unsubscribe();
      setConsent('accepted');
      expect(listener).not.toHaveBeenCalled();
    });

    it('notifie tous les abonnes, pas seulement le dernier', () => {
      // Trois surfaces distinctes écoutent ce store : le script d'audience,
      // <Analytics /> et le bandeau. Si une seule était réveillée, l'un des
      // deux traceurs resterait non monté après acceptation.
      const a = vi.fn();
      const b = vi.fn();
      const c = vi.fn();
      subscribe(a);
      subscribe(b);
      subscribe(c);
      setConsent('accepted');
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
      expect(c).toHaveBeenCalledTimes(1);
    });
  });

  describe('expiration a six mois (CNIL, lignes directrices 2020)', () => {
    it('date chaque reponse enregistree', () => {
      setConsent('accepted');
      expect(Number(localStorage.getItem(COOKIE_CONSENT_AT_KEY))).toBeGreaterThan(0);
    });

    it('redemande une fois la reponse perimee, et ne charge rien d ici la', () => {
      const t0 = 1_700_000_000_000;
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      localStorage.setItem(COOKIE_CONSENT_AT_KEY, String(t0));
      expect(readConsent(undefined, t0 + CONSENT_MAX_AGE_MS - 1)).toBe('accepted');
      expect(readConsent(undefined, t0 + CONSENT_MAX_AGE_MS + 1)).toBeNull();
    });

    it('garde valable une reponse sans date, puis la date', () => {
      // Réponses enregistrées avant l'expiration, et fixtures e2e.
      localStorage.setItem(COOKIE_CONSENT_KEY, 'refused');
      expect(readConsent()).toBe('refused');
      stampLegacyConsent(42);
      expect(localStorage.getItem(COOKIE_CONSENT_AT_KEY)).toBe('42');
      stampLegacyConsent(99);
      expect(localStorage.getItem(COOKIE_CONSENT_AT_KEY)).toBe('42');
    });
  });

  describe('requestConsentReview (RGPD art. 7.3)', () => {
    it('reveille le bandeau, sans toucher a la reponse', () => {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
      const listener = vi.fn();
      const unsubscribe = subscribeConsentReview(listener);
      requestConsentReview();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(readConsent()).toBe('accepted');
      unsubscribe();
      requestConsentReview();
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSnapshot', () => {
    it('reflete l etat courant, pour useSyncExternalStore', () => {
      expect(getSnapshot()).toBeNull();
      setConsent('refused');
      expect(getSnapshot()).toBe('refused');
    });
  });
});
