// ═══════════════════════════════════════════════════════════════════
// La SURFACE de Sentry que ce produit utilise, et rien d'autre
// ═══════════════════════════════════════════════════════════════════
//
// Pourquoi ce fichier : accéder à `@sentry/react` par NAMESPACE
// (`mod.captureException(err)`) empêche Rollup d'élaguer le paquet, qui passe de
// 49,3 ko à 155,9 ko gzip (replay compris) : un recul net pour tout visiteur muni
// d'un DSN, chargé à la première inactivité.
//
// Ce module réexporte donc NOMMÉMENT les fonctions utilisées. Rollup voit des
// liaisons statiques au lieu d'un namespace opaque, et élague le reste.
//
// ❌ Ne jamais y ajouter `export * from '@sentry/react'` : ça rétablit
//    exactement le namespace opaque que ce fichier existe pour éviter.
// ✅ Ajouter une fonction ici quand le produit en a besoin — une par une, et
//    en remesurant `check:bundle` derrière.
//
// ── `init` EST ÉCRIT ICI, PAS RÉEXPORTÉ (Sentry 11, V18.2) ──
//
// L'`init` du SDK appelle `getDefaultIntegrations()`, qui référence en dur les
// douze intégrations par défaut : aucune n'est élagable. La v11 en ajoute trois
// dont le produit n'a pas l'usage (`conversationId` pour l'IA, `console` pour
// les journaux, `cultureContext`) : `sentry-client` passait de 49,4 à 53,9 ko
// gzip, au-delà de son plafond de 52,0. Monter le `BrowserClient` soi-même,
// avec la liste explicite des intégrations par défaut de la v10 gardées, est la
// voie que Sentry documente pour élaguer (« tree shaking default integrations »).
//
// ⚠️ Une intégration retirée de `defaultIntegrations()` ne prévient pas :
// `eventFiltersIntegration` porte `ignoreErrors`, `globalHandlersIntegration`
// les erreurs non rattrapées. La liste est figée par `sentry-client.test.ts`.

import {
  BrowserClient,
  breadcrumbsIntegration,
  browserApiErrorsIntegration,
  browserSessionIntegration,
  dedupeIntegration,
  defaultStackParser,
  eventFiltersIntegration,
  getCurrentScope,
  globalHandlersIntegration,
  httpContextIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
  addIntegration,
  type BrowserOptions,
} from '@sentry/react';

export {
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  browserTracingIntegration,
  addIntegration,
} from '@sentry/react';

/** Une intégration, au type que le SDK attend (le nom n'est pas exporté par `@sentry/react`). */
type Integration = Parameters<typeof addIntegration>[0];

/**
 * Les intégrations par défaut de Sentry 10, dans leur ordre d'origine, moins
 * `functionToString` : elle ne fait que rendre la source d'origine à `toString()`
 * d'une fonction enveloppée par Sentry, ce que rien dans le produit ne lit. Sans
 * ce retrait, le chunk dépasse encore son plafond (52,1 ko pour 52,0).
 */
export function defaultIntegrations(): Integration[] {
  return [
    eventFiltersIntegration(),
    browserApiErrorsIntegration(),
    breadcrumbsIntegration(),
    globalHandlersIntegration(),
    linkedErrorsIntegration(),
    dedupeIntegration(),
    httpContextIntegration(),
    browserSessionIntegration(),
  ];
}

/**
 * Ce que `main.tsx` passe. `tunnel` est exclu : la v11 l'accepte aussi en
 * booléen (tunnel géré), que seul l'`init` du SDK résout ; le produit n'en a pas.
 */
export type InitOptions = Omit<BrowserOptions, 'integrations' | 'transport' | 'stackParser' | 'defaultIntegrations' | 'tunnel'> & {
  integrations?: Integration[];
};

/**
 * L'équivalent de `Sentry.init` de `@sentry/react`, sans `getDefaultIntegrations`.
 * Deux étiquettes de `@sentry/react` sont abandonnées, faute de place sous le
 * plafond (57 octets manquaient) : le nom de SDK (`sentry.javascript.browser`
 * au lieu de `react`) et le contexte `react` (sa version, que le SHA de release
 * fixe déjà par `package.json`). Aucune n'agit sur la capture.
 */
export function init(options: InitOptions): BrowserClient {
  const client = new BrowserClient({
    ...options,
    integrations: [...defaultIntegrations(), ...(options.integrations ?? [])],
    stackParser: defaultStackParser,
    transport: makeFetchTransport,
  });
  getCurrentScope().setClient(client);
  client.init();
  return client;
}
