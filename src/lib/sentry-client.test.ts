/**
 * `init` est écrit dans `sentry-client.ts` pour élaguer les intégrations par
 * défaut de Sentry 11 (V18.2). Ce qui se perd sans bruit, et que ces cas
 * figent : la liste des intégrations (une absente ne prévient pas), et le
 * branchement du client sur la portée courante (sans lui, rien ne part).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { getCurrentScope } from '@sentry/react';
import { defaultIntegrations, init } from './sentry-client';

/** Les intégrations par défaut de Sentry 10 que le produit garde (sans FunctionToString). */
const ATTENDUES = [
  'EventFilters',
  'BrowserApiErrors',
  'Breadcrumbs',
  'GlobalHandlers',
  'LinkedErrors',
  'Dedupe',
  'HttpContext',
  'BrowserSession',
];

afterEach(async () => {
  await getCurrentScope().getClient()?.close(0);
  getCurrentScope().setClient(undefined);
});

describe('sentry-client : init sans getDefaultIntegrations', () => {
  it('huit intégrations par défaut de la v10, aucune de celles ajoutées par la v11', () => {
    const noms = defaultIntegrations().map((i) => i.name);
    expect(noms).toEqual(ATTENDUES);
    for (const ajout of ['ConversationId', 'Console', 'CultureContext', 'FunctionToString']) {
      expect(noms).not.toContain(ajout);
    }
  });

  it('le client est branché sur la portée, avec ses intégrations et celles passées', () => {
    const extra = { name: 'Temoin', setupOnce: () => undefined };
    // Un client DÉSACTIVÉ n'installe aucune intégration : il faut un DSN, jamais joint ici.
    const client = init({ dsn: 'https://cle@example.invalid/0', integrations: [extra] });
    expect(getCurrentScope().getClient()).toBe(client);
    for (const nom of [...ATTENDUES, 'Temoin']) {
      expect(client.getIntegrationByName(nom), nom).toBeDefined();
    }
    expect(client.getOptions()._metadata?.sdk?.name).toBe('sentry.javascript.browser');
  });

  it('TÉMOIN : un client sans init ne porte aucune de ces intégrations', () => {
    expect(getCurrentScope().getClient()).toBeUndefined();
  });
});
