// @vitest-environment jsdom
//
// Faille B7, deuxième occurrence. Le bug d'origine n'était pas une exception :
// c'était un SUCCÈS SILENCIEUX — le toast « Profil mis à jour » s'affichait et
// rien ne changeait, parce que l'écriture allait dans une clé que plus personne
// ne relisait. Aucun test ne pouvait l'attraper, puisque le seul test existant
// vérifiait… que l'écriture atteignait bien cette clé morte.
//
// D'où la forme de ces tests : ils vérifient ce que l'UTILISATEUR obtient
// (`buildDemoUser()`, la valeur que lit l'écran), pas ce que le code écrit.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEMO_PROFILE_KEY,
  DEMO_SENTINEL_EMAIL,
  buildDemoUser,
  persistDemoProfile,
  readDemoProfile,
} from './demo-profile';

beforeEach(() => localStorage.clear());

describe('demo-profile — le profil démo par défaut', () => {
  it('rend l’utilisateur démo canonique quand rien n’est persisté', () => {
    expect(buildDemoUser()).toEqual({
      id: 'demo-user',
      name: 'Utilisateur Démo',
      email: DEMO_SENTINEL_EMAIL,
    });
  });
});

describe('demo-profile — une modification est réellement visible', () => {
  it('le nom modifié est celui que rend buildDemoUser (le bug d’origine)', () => {
    persistDemoProfile({ name: 'Axel' });
    expect(buildDemoUser().name).toBe('Axel');
  });

  it('survit à un rechargement — c’est buildDemoUser qui relit', () => {
    persistDemoProfile({ name: 'Axel', email: 'axel@exemple.fr' });
    // Pas de state React ici : un nouvel appel simule le remontage au reload.
    expect(buildDemoUser()).toMatchObject({ name: 'Axel', email: 'axel@exemple.fr' });
  });

  it('les patchs successifs se cumulent au lieu de s’écraser', () => {
    persistDemoProfile({ name: 'Axel' });
    persistDemoProfile({ avatar: 'data:image/jpeg;base64,xxx' });
    expect(buildDemoUser()).toMatchObject({ name: 'Axel', avatar: 'data:image/jpeg;base64,xxx' });
  });

  it('retirer sa photo se dit `avatar: undefined` et doit être appliqué', () => {
    persistDemoProfile({ avatar: 'data:image/jpeg;base64,xxx' });
    persistDemoProfile({ avatar: undefined });
    // Un `if (patch[field])` aurait ignoré ce patch : la photo serait restée
    // affichée après une suppression confirmée par l'utilisateur.
    expect(buildDemoUser().avatar).toBeUndefined();
  });

  it('renvoie null quand le patch ne porte aucun champ modifiable', () => {
    expect(persistDemoProfile({})).toBeNull();
  });
});

describe('demo-profile — ce qui ne doit PAS être modifiable', () => {
  it('ignore un champ hors whitelist à l’écriture', () => {
    persistDemoProfile({ id: 'admin', premiumTokens: 999 } as never);
    expect(buildDemoUser().id).toBe('demo-user');
    expect(readDemoProfile()).toEqual({});
  });

  it('ignore un `id` injecté À LA MAIN dans localStorage', () => {
    // Le filtre est refait à la LECTURE, pas seulement à l'écriture : la valeur
    // vient d'une source que l'utilisateur peut éditer dans les devtools, et
    // `demo-user` est la clé sous laquelle les seeds démo sont rangés.
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify({ id: 'usurpé', name: 'Axel' }));
    const user = buildDemoUser();
    expect(user.id).toBe('demo-user');
    expect(user.name).toBe('Axel');
  });
});

describe('demo-profile — robustesse du stockage', () => {
  it('retombe sur le profil canonique si le JSON est corrompu (faille B14)', () => {
    localStorage.setItem(DEMO_PROFILE_KEY, '{ pas du json');
    expect(buildDemoUser().name).toBe('Utilisateur Démo');
  });

  it('ignore une valeur qui n’est pas un objet', () => {
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(['nope']));
    expect(readDemoProfile()).toEqual({});
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(null));
    expect(readDemoProfile()).toEqual({});
  });
});
