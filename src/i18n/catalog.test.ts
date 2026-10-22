// Le contrat de `catalog.ts` : les catalogues sont DÉCOUVERTS, pas déclarés.
//
// L'enjeu de ce fichier n'est pas la couverture — c'est d'empêcher une
// régression silencieuse. Si quelqu'un remplace un jour le glob par des imports
// statiques « pour simplifier », l'app continuera de fonctionner parfaitement
// en français et en anglais, et la langue suivante partira en prod à moitié
// traduite sans que rien n'échoue. Ces tests sont ce qui rend cet oubli bruyant.

import { describe, expect, it } from 'vitest';
import {
  EAGER_NAMESPACES,
  ensureNamespaces,
  getCatalog,
  getFallbackCatalog,
  hasCatalog,
  listLoaderKeys,
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
      // Depuis le découpage du 2026-08-25, `loadCatalogs` ne charge que les
      // namespaces eager : les autres arrivent avec leur page, via
      // `ensureNamespaces`. On demande donc tout explicitement.
      await ensureNamespaces(listNamespaces(), locale);
      for (const namespace of listNamespaces()) {
        expect(
          hasCatalog(locale, namespace),
          `catalogue ${locale}/${namespace}.json introuvable ou non enregistré`
        ).toBe(true);
      }
    }
  });

  it('a un chargeur pour chaque couple (locale, namespace) sauf les eager en `fr`', () => {
    // Le motif du glob exclut en dur les DEUX namespaces eager de `fr`, ceux
    // qui sont importés statiquement. Un fichier à la fois statique et dans le
    // glob ferait avertir Rollup et ré-enregistrerait un catalogue déjà en
    // mémoire. Ce test attrape le désalignement entre `EAGER_NAMESPACES` et le
    // motif, qui ne casserait rien de visible.
    const keys = new Set(listLoaderKeys());
    for (const locale of SUPPORTED_LOCALES) {
      for (const namespace of listNamespaces()) {
        const key = `${locale}/${namespace}`;
        const isEagerFr =
          locale === DEFAULT_LOCALE && (EAGER_NAMESPACES as readonly string[]).includes(namespace);
        expect(
          keys.has(key),
          isEagerFr
            ? `\`${key}\` est importé statiquement, il ne doit PAS être dans le glob`
            : `\`${key}\` n'a aucun chargeur`
        ).toBe(!isEagerFr);
      }
    }
  });

  it('garde les namespaces eager en mémoire, sans aucun chargement', async () => {
    // C'est la propriété qui rend `t()` utilisable synchroniquement au premier
    // rendu : ces deux-là sont dans le chunk d'entrée, pas derrière un `await`.
    await expect(loadCatalogs(DEFAULT_LOCALE)).resolves.toBeUndefined();
    for (const namespace of EAGER_NAMESPACES) {
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
      await expect(ensureNamespaces(listNamespaces(), locale)).resolves.toBeUndefined();
    }
  });

  it('ne charge un couple (locale, namespace) qu’une seule fois', async () => {
    // Deux routes qui demandent le même catalogue, une navigation rapide, un
    // préchargement au survol, doivent partager le chargement. La preuve est
    // l'IDENTITÉ de l'objet enregistré : un second chargement produirait un
    // nouvel objet JSON.
    const namespace = listNamespaces().find(
      (ns) => !(EAGER_NAMESPACES as readonly string[]).includes(ns)
    );
    if (!namespace) return;

    await Promise.all([
      ensureNamespaces([namespace], DEFAULT_LOCALE),
      ensureNamespaces([namespace], DEFAULT_LOCALE),
    ]);
    const first = getCatalog(DEFAULT_LOCALE, namespace);
    await ensureNamespaces([namespace], DEFAULT_LOCALE);
    expect(getCatalog(DEFAULT_LOCALE, namespace)).toBe(first);
  });

  it('n’essaie même pas de charger un namespace eager', async () => {
    // `ensureNamespaces` les filtre en amont : ils sont déjà là, et le glob
    // n'a pas de chargeur pour eux. Sans ce filtre, l'appel partirait chercher
    // un module qui n'existe pas.
    await expect(ensureNamespaces(['common', 'errors'], DEFAULT_LOCALE)).resolves.toBeUndefined();
    expect(getCatalog(DEFAULT_LOCALE, 'common')).not.toBeNull();
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
