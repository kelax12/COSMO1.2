// Témoin : chaque Edge Function déclare `verify_jwt` dans `supabase/config.toml`,
// et la valeur colle à la façon dont elle authentifie son appelant
// (audit de sécurité du 2026-09-30).
//
// 🔴 Pourquoi. `org-webhook-dispatch` était absente de `config.toml` : déployée
// avec le défaut `verify_jwt = true`, elle répondait 401 à la passerelle avant
// d'exécuter une ligne, et AUCUN webhook n'est jamais parti. Symétriquement,
// une fonction qui lit un JWT mais passe en `verify_jwt = false` accepterait un
// appel sans clé du projet.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FUNCTIONS = join(__dirname, '..', 'supabase', 'functions');
const config = readFileSync(join(__dirname, '..', 'supabase', 'config.toml'), 'utf8');

const fonctions = readdirSync(FUNCTIONS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name);

function verifyJwt(nom: string): boolean | null {
  const m = config.match(new RegExp(`\\[functions\\.${nom}\\]\\s*\\n\\s*verify_jwt\\s*=\\s*(true|false)`));
  return m ? m[1] === 'true' : null;
}

describe('config.toml décrit chaque Edge Function', () => {
  it('le dépôt en porte au moins douze (témoin du ramassage)', () => {
    expect(fonctions.length).toBeGreaterThanOrEqual(12);
  });

  it.each(fonctions)('%s a un `verify_jwt` explicite', (nom) => {
    expect(verifyJwt(nom), `[functions.${nom}] absent de supabase/config.toml`).not.toBeNull();
  });

  it.each(fonctions)('%s : `verify_jwt` cohérent avec son authentification', (nom) => {
    const src = readFileSync(join(FUNCTIONS, nom, 'index.ts'), 'utf8');
    const cron = src.includes('CRON_SECRET');
    const signeParStripe = src.includes('constructEvent');
    if (cron || signeParStripe) {
      // Appelée par la CI ou par Stripe, sans JWT : la passerelle doit laisser passer,
      // c'est le secret ou la signature qui autorise.
      expect(verifyJwt(nom)).toBe(false);
    } else {
      expect(src, `${nom} n'authentifie pas son appelant`).toContain('getUser');
      expect(verifyJwt(nom)).toBe(true);
    }
  });
});
