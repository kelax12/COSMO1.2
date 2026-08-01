// Le contrat de `catalog.ts` : les catalogues sont DÉCOUVERTS, pas déclarés.
//
// L'enjeu de ce fichier n'est pas la couverture — c'est d'empêcher une
// régression silencieuse. Si quelqu'un remplace un jour le glob par des imports
// statiques « pour simplifier », l'app continuera de fonctionner parfaitement
// en français et en anglais, et la langue suivante partira en prod à moitié
// traduite sans que rien n'échoue. Ces tests sont ce qui rend cet oubli bruyant.

import { describe, expect, it } from 'vitest';
import {
  getCatalog,
  getFallbackCatalog,
  hasCatalog,
  listNamespaces,
  loadCatalogs,
  registerCatalog,
  resolveMessage,
} from './catalog';
import { ALL_LOCALES, DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locale';

describe('découverte automatique des catalogues', () => {
  it('sert chaque locale exposée sans qu’elle soit listée dans le code', async () => {
    // LE test de non-régression du module. Il ne vérifie pas « en marche » : il
    // vérifie qu'ouvrir une langue ne demande que des fichiers JSON. Le jour où
    // `SUPPORTED_LOCALES` gagnera `es`, ce test échouera tant que
    // `src/locales/es/` sera absent — et passera au vert sans toucher au code
    // dès que le dossier existera.
    for (const locale of SUPPORTED_LOCALES) {
      await loadCatalogs(locale);
      for (const namespace of listNamespaces()) {
        expect(
          hasCatalog(locale, namespace),
          `catalogue ${locale}/${namespace}.json introuvable ou non enregistré`
        ).toBe(true);
      }
    }
  });

  it('résout immédiatement pour la locale de référence, déjà en mémoire', async () => {
    // `fr` est importé statiquement : il ne doit JAMAIS passer par le glob,
    // sinon le repli ne serait pas disponible au premier rendu synchrone.
    await expect(loadCatalogs(DEFAULT_LOCALE)).resolves.toBeUndefined();
    for (const namespace of listNamespaces()) {
      expect(getCatalog(DEFAULT_LOCALE, namespace)).not.toBeNull();
    }
  });

  it('ne rejette pas pour une locale connue mais sans fichiers', async () => {
    // Un catalogue absent est un état de transition légitime (traduction en
    // cours d'écriture). L'app doit démarrer et rendre via le repli, pas
    // planter au bootstrap — `src/main.tsx` attend cette promesse.
    const untranslated = ALL_LOCALES.filter((l) => !SUPPORTED_LOCALES.includes(l));
    for (const locale of untranslated) {
      await expect(loadCatalogs(locale)).resolves.toBeUndefined();
    }
  });

  it('partage un seul chargement entre appels concurrents', () => {
    const [locale] = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE);
    if (!locale) return;
    expect(loadCatalogs(locale)).toBe(loadCatalogs(locale));
  });
});

describe('registre', () => {
  it('retombe sur le catalogue de référence quand la locale n’a pas la clé', () => {
    // Le comportement qui fait qu'une traduction incomplète dégrade au lieu de
    // casser : la clé existe en `fr`, pas dans la locale demandée.
    const [namespace] = listNamespaces();
    expect(getFallbackCatalog(namespace)).toEqual(getCatalog(DEFAULT_LOCALE, namespace));
  });

  it('retourne null pour une clé absente partout, au lieu de la clé elle-même', () => {
    // Distinction indispensable à `normalizeApiError` : un code d'erreur
    // inconnu ne doit pas relayer le message brut du serveur (faille V7/N1).
    const [namespace] = listNamespaces();
    expect(resolveMessage(namespace, 'clé.qui.nexiste.pas', DEFAULT_LOCALE)).toBeNull();
  });

  it('accepte un catalogue enregistré à la main', () => {
    const [namespace] = listNamespaces();
    const [locale] = SUPPORTED_LOCALES.filter((l) => l !== DEFAULT_LOCALE);
    if (!locale) return;
    registerCatalog(locale, namespace, { __probe__: 'valeur' });
    expect(resolveMessage(namespace, '__probe__', locale)).toBe('valeur');
  });
});
