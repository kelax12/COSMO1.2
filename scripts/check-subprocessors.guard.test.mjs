// ═══════════════════════════════════════════════════════════════════
// TÉMOIN de `check:subprocessors` (AM-3 du registre art. 30)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 Une dérivation cassée rend le vide, et le vide se lit « tout va bien ».
// Ce témoin joue la garde sur des dépôts jetables dont il connaît la réponse :
// un dépôt cohérent passe, puis CHAQUE défaut visé la fait rougir.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

import { deriver, comparer, tableauTransferts, tableauLegal, PLANCHER_TIERS } from './check-subprocessors.mjs';

const CSP = "default-src 'self'; connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.ingest.de.sentry.io";

const REGISTRE = [
  '## Transferts hors Union européenne',
  '',
  '| Sous-traitant | Localisation | Encadrement |',
  '|---|---|---|',
  '| **Supabase** | Irlande | aucun |',
  '| Stripe | Irlande | DPA |',
  '| Sentry | États-Unis | DPA |',
  '| Resend | États-Unis | DPA |',
  '| Vercel | États-Unis | DPA |',
  '| Anthropic | États-Unis | T11 |',
  '',
  '## Mesures de sécurité',
].join('\n');

const LEGAL = [
  '## 6. Sous-traitants et transferts',
  '',
  '| Prestataire | Rôle | Localisation | À faire |',
  '|---|---|---|---|',
  '| Supabase | base | Irlande | x |',
  '| Vercel | front | US | x |',
  '| Stripe | paiement | IE | x |',
  '| Sentry | monitoring | US | x |',
  '| Resend | mail | US | x |',
  '',
  '---',
].join('\n');

function depot(surcharges = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'ss-'));
  const fichiers = {
    'vercel.json': JSON.stringify({ headers: [{ source: '/(.*)', headers: [{ key: 'Content-Security-Policy', value: CSP }] }] }),
    'package.json': JSON.stringify({ dependencies: { '@supabase/supabase-js': '2', '@sentry/react': '10', '@vercel/analytics': '2' } }),
    'supabase/functions/a/index.ts': "import Stripe from 'npm:stripe@14.21.0'\nawait fetch('https://api.resend.com/emails', {})",
    'src/rien.ts': "export const lien = 'https://thecosmo.app'",
    ...surcharges,
  };
  for (const [nom, contenu] of Object.entries(fichiers)) {
    if (contenu === null) continue;
    const p = join(racine, nom);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, contenu);
  }
  return racine;
}

function jouer(surcharges = {}, registre = REGISTRE, legal = LEGAL) {
  const racine = depot(surcharges);
  try {
    const d = deriver(racine);
    return { d, erreurs: comparer(d, registre, legal) };
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

describe('témoin · sous-traitants dérivés du code (AM-3)', () => {
  it('un dépôt cohérent dérive les cinq tiers et passe', () => {
    const { d, erreurs } = jouer();
    expect([...d.tiers.keys()].sort()).toEqual(['resend', 'sentry', 'stripe', 'supabase', 'vercel']);
    expect(d.tiers.size).toBeLessThan(PLANCHER_TIERS + 1);
    expect(erreurs).toEqual([]);
  });

  it('extrait les lignes des deux tableaux', () => {
    expect(tableauTransferts(REGISTRE)).toEqual(['**Supabase**', 'Stripe', 'Sentry', 'Resend', 'Vercel', 'Anthropic']);
    expect(tableauLegal(LEGAL)).toEqual(['Supabase', 'Vercel', 'Stripe', 'Sentry', 'Resend']);
  });

  it('une origine ajoutée à la CSP et absente du registre rougit', () => {
    const csp = CSP + ' https://challenges.cloudflare.com';
    const { erreurs } = jouer({
      'vercel.json': JSON.stringify({ headers: [{ headers: [{ key: 'Content-Security-Policy', value: csp }] }] }),
    });
    expect(erreurs.join('\n')).toMatch(/`cloudflare` est appelé par le code .*CSP challenges\.cloudflare\.com.*n'apparaît nulle part/);
  });

  it('une origine de CSP qu aucune entrée du catalogue ne connaît rougit', () => {
    const { erreurs } = jouer({
      'vercel.json': JSON.stringify({ headers: [{ headers: [{ key: 'Content-Security-Policy', value: CSP + ' https://cdn.nouveau-saas.io' }] }] }),
    });
    expect(erreurs.join('\n')).toMatch(/hôte inconnu `cdn\.nouveau-saas\.io`/);
  });

  it('un fetch vers un hôte inconnu dans une Edge Function rougit', () => {
    const { erreurs } = jouer({ 'supabase/functions/b/index.ts': "await fetch('https://api.mailgun-clone.com/v3', {})" });
    expect(erreurs.join('\n')).toMatch(/hôte inconnu `api\.mailgun-clone\.com`/);
  });

  it('un SDK réseau ajouté à package.json sans entrée rougit', () => {
    const { erreurs } = jouer({
      'package.json': JSON.stringify({ dependencies: { '@supabase/supabase-js': '2', '@sentry/react': '10', '@vercel/analytics': '2', 'posthog-js': '1' } }),
    });
    expect(erreurs.join('\n')).toMatch(/dépendance `posthog-js` : SDK réseau absent du catalogue/);
  });

  it('un tiers du code absent de LEGAL.md rougit', () => {
    const legal = LEGAL.replace('| Resend | mail | US | x |\n', '');
    const { erreurs } = jouer({}, REGISTRE, legal);
    expect(erreurs.join('\n')).toMatch(/`resend` .* absent du tableau § 6 de LEGAL\.md/);
  });

  it('un tiers déclaré au registre que plus rien n appelle rougit', () => {
    const { erreurs } = jouer({ 'supabase/functions/a/index.ts': "import Stripe from 'npm:stripe@14.21.0'" });
    expect(erreurs.join('\n')).toMatch(/« Resend » mais plus aucun code ne l'appelle/);
  });

  it('un tiers hors dépôt déclaré (Anthropic) ne rougit PAS', () => {
    const { erreurs } = jouer();
    expect(erreurs.join('\n')).not.toMatch(/Anthropic/);
  });

  it('une ligne du registre que le catalogue ne porte pas rougit', () => {
    const { erreurs } = jouer({}, REGISTRE.replace('| Vercel |', '| Mystère SA |'));
    expect(erreurs.join('\n')).toMatch(/« Mystère SA » : aucun tiers du catalogue/);
  });

  it('un workflow de sauvegarde qui dépose un artefact désigne GitHub, un workflow de test non', () => {
    const avec = jouer({ '.github/workflows/db-backup.yml': 'uses: actions/upload-artifact@v4' });
    expect(avec.d.tiers.has('github')).toBe(true);
    const sans = jouer({ '.github/workflows/ci.yml': 'uses: actions/upload-artifact@v4' });
    expect(sans.d.tiers.has('github')).toBe(false);
  });

  it('un dépôt vide dérive moins que le plancher (la garde réelle échouerait)', () => {
    const { d } = jouer({ 'vercel.json': '{}', 'package.json': '{}', 'supabase/functions/a/index.ts': '' });
    expect(d.tiers.size).toBeLessThan(PLANCHER_TIERS);
  });
});
