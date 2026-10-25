// ═══════════════════════════════════════════════════════════════════
// Témoins des trois gardes « mesure finale humaine » (posés le 2026-10-24) :
//   check-lecteurs-ecran · check-exercice-violation · check-peremption-chantiers
//
// Une garde qui n'a jamais été vue rouge ne garde rien. Chaque cas ci-dessous
// FABRIQUE le défaut dans une copie du dépôt et exige que la garde le refuse,
// puis exige que le dépôt réel, lui, soit vert.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import * as lecteurs from './check-lecteurs-ecran.mjs';
import * as exercice from './check-exercice-violation.mjs';
import * as chantiers from './check-peremption-chantiers.mjs';

const RACINE = process.cwd();
const FICHIERS = [
  'docs/AUDIT-VOICEOVER-IOS.md',
  'docs/AUDIT-NVDA-WINDOWS.md',
  'docs/RGPD-VIOLATION.md',
  'docs/RGPD-VIOLATION-GABARITS.md',
  'docs/POST-AUDIT-GUIDE.md',
  'docs/RGPD.md',
  'docs/LEGAL.md',
  'docs/SECURITY.md',
  'docs/DEPLOYMENT.md',
  'docs/RGPD-REGISTRE.md',
  'docs/ACCESSIBILITY.md',
  'docs/STRIPE-LIVE.md',
  'faille.md',
  'a-faire-manuel.md',
  'package.json',
];

/** Une copie du dépôt, limitée à ce que les trois gardes lisent. */
function copie() {
  const d = mkdtempSync(join(tmpdir(), 'procedures-humaines-'));
  const cp = (rel) => {
    mkdirSync(dirname(join(d, rel)), { recursive: true });
    copyFileSync(join(RACINE, rel), join(d, rel));
  };
  FICHIERS.forEach(cp);
  for (const f of readdirSync(join(RACINE, 'supabase/migration'))) {
    if (f.startsWith('125_')) cp(`supabase/migration/${f}`);
  }
  return d;
}
const lire = (d, rel) => readFileSync(join(d, rel), 'utf8');
const ecrire = (d, rel, f) => writeFileSync(join(d, rel), f(lire(d, rel)));
const AVANT = new Date('2026-11-01T10:00:00Z');
const APRES_VO = new Date('2026-12-16T10:00:00Z');

describe('check-lecteurs-ecran', () => {
  it('le dépôt réel est vert aujourd hui, et mesure bien (94 + 33 étapes)', () => {
    const r = lecteurs.verifier(RACINE, AVANT);
    expect(r.erreurs).toEqual([]);
    expect(r.resume.join(' ')).toMatch(/94 étapes/);
    expect(r.resume.join(' ')).toMatch(/33 étapes/);
  });

  it('TÉMOIN : échéance dépassée sans séance consignée = ÉCHEC', () => {
    const r = lecteurs.verifier(RACINE, APRES_VO);
    expect(r.erreurs.some((e) => /VoiceOver iOS.*dépassée/.test(e))).toBe(true);
  });

  it('une séance « ✅ joué » datée et avec appareil éteint l échéance', () => {
    const d = copie();
    ecrire(d, 'docs/AUDIT-VOICEOVER-IOS.md', (t) =>
      t.replace('| _(aucune séance à ce jour)_ | | | |', '| 2026-12-10 | iPhone 13 · iOS 18.5 · Safari 18.5 | ✅ joué | aucun |'));
    const r = lecteurs.verifier(d, APRES_VO);
    expect(r.erreurs.some((e) => /VoiceOver iOS/.test(e))).toBe(false);
  });

  it('TÉMOIN : un « ⚠️ partiel » n éteint PAS l échéance', () => {
    const d = copie();
    ecrire(d, 'docs/AUDIT-VOICEOVER-IOS.md', (t) =>
      t.replace('| _(aucune séance à ce jour)_ | | | |', '| 2026-12-10 | iPhone 13 · iOS 18.5 · Safari 18.5 | ⚠️ partiel | |'));
    expect(lecteurs.verifier(d, APRES_VO).erreurs.some((e) => /VoiceOver iOS.*dépassée/.test(e))).toBe(true);
  });

  it('TÉMOIN : une étape sans résultat attendu est refusée', () => {
    const d = copie();
    ecrire(d, 'docs/AUDIT-NVDA-WINDOWS.md', (t) => t.replace(/^\| 4\.2 \| (.*?) \| (.*?) \|/m, '| 4.2 | $1 |  |'));
    expect(lecteurs.verifier(d, AVANT).erreurs.join('\n')).toMatch(/sans résultat attendu : 4\.2/);
  });

  it('TÉMOIN : repousser l échéance de plus de 30 jours est refusé', () => {
    const d = copie();
    ecrire(d, 'docs/AUDIT-VOICEOVER-IOS.md', (t) => t.replace('echeance-lecteur-ecran: 2026-12-15', 'echeance-lecteur-ecran: 2027-03-01'));
    expect(lecteurs.verifier(d, AVANT).erreurs.join('\n')).toMatch(/repoussée de plus de 30 jours/);
  });

  it('TÉMOIN : un marqueur absent est refusé, une analyse qui ne trouve rien aussi', () => {
    const d = copie();
    ecrire(d, 'docs/AUDIT-NVDA-WINDOWS.md', (t) => t.replace(/<!-- echeance-lecteur-ecran:.*?-->/, ''));
    expect(lecteurs.verifier(d, AVANT).erreurs.join('\n')).toMatch(/marqueur .* absent/);
    const e = copie();
    ecrire(e, 'docs/AUDIT-VOICEOVER-IOS.md', (t) => t.replace(/^\| \d+\.\d+ \|/gm, '| x |'));
    expect(lecteurs.verifier(e, AVANT).erreurs.join('\n')).toMatch(/plancher 90/);
  });
});

describe('check-exercice-violation', () => {
  const PKG_OK = () => {
    // le dépôt réel cite sa propre commande : le test lit package.json réel,
    // qui doit déjà la porter une fois la garde branchée
    return JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8')).scripts['check:exercice-violation'];
  };

  it('le dépôt réel est vert, et mesure bien (liens, commandes, gabarits)', () => {
    expect(PKG_OK()).toBeTruthy();
    const r = exercice.verifier(RACINE, AVANT);
    expect(r.erreurs).toEqual([]);
    expect(r.resume.join(' ')).toMatch(/6 gabarits/);
  });

  it('TÉMOIN : un exercice de plus de 12 mois est refusé', () => {
    const r = exercice.verifier(RACINE, new Date('2027-11-01T00:00:00Z'));
    expect(r.erreurs.join('\n')).toMatch(/plus de 12 mois/);
  });

  it('un exercice daté dans le futur est refusé', () => {
    expect(exercice.verifier(RACINE, new Date('2026-09-01T00:00:00Z')).erreurs.join('\n')).toMatch(/futur/);
  });

  it('TÉMOIN : l absence d exercice daté est refusée', () => {
    const d = copie();
    ecrire(d, 'docs/RGPD-VIOLATION.md', (t) => t.replace(/^\| 2026-10-24 \| \*\*Mode table\*\*/m, '| bientôt | **Mode table**'));
    expect(exercice.verifier(d, AVANT).erreurs.join('\n')).toMatch(/Aucun exercice daté/);
  });

  it('TÉMOIN : un trou sans état est refusé', () => {
    const d = copie();
    ecrire(d, 'docs/RGPD-VIOLATION.md', (t) => t.replace(/^(\| T-5 \|.*\|) 🟠 ouvert[^\n]*$/m, '$1  |'));
    expect(exercice.verifier(d, AVANT).erreurs.join('\n')).toMatch(/Trou T-5 sans état/);
  });

  it('TÉMOIN : un gabarit disparu est refusé', () => {
    const d = copie();
    ecrire(d, 'docs/RGPD-VIOLATION-GABARITS.md', (t) => t.replace('## Message aux personnes concernées', '## Autre'));
    expect(exercice.verifier(d, AVANT).erreurs.join('\n')).toMatch(/Gabarit manquant : « Message aux personnes concernées »/);
  });

  it('TÉMOIN : un lien mort, une ancre morte et une commande inconnue sont refusés', () => {
    const d = copie();
    ecrire(d, 'docs/RGPD-VIOLATION.md', (t) => `${t}\n[a](./N-EXISTE-PAS.md) [b](./SECURITY.md#ancre-fantome) \`npm run check:fantome\`\n`);
    const e = exercice.verifier(d, AVANT).erreurs.join('\n');
    expect(e).toMatch(/Lien mort : \.\/N-EXISTE-PAS\.md/);
    expect(e).toMatch(/Ancre morte : \.\/SECURITY\.md#ancre-fantome/);
    expect(e).toMatch(/npm run check:fantome/);
  });
});

describe('check-peremption-chantiers', () => {
  it('le dépôt réel est vert, et lit bien ses 5 chantiers', () => {
    const r = chantiers.verifier(RACINE, AVANT);
    expect(r.erreurs).toEqual([]);
    expect(r.total).toBe(5);
  });

  it('TÉMOIN : un chantier actif relu il y a plus de 90 jours est refusé, un chantier clos non', () => {
    const r = chantiers.verifier(RACINE, new Date('2027-03-01T00:00:00Z'));
    expect(r.erreurs).toHaveLength(1);
    expect(r.erreurs[0]).toMatch(/Point 2.*relu le 2026-10-24/);
  });

  it('TÉMOIN : un chantier sans marqueur est refusé', () => {
    const d = copie();
    ecrire(d, 'docs/POST-AUDIT-GUIDE.md', (t) => t.replace('<!-- chantier: clos le=2026-09-04 -->', ''));
    expect(chantiers.verifier(d, AVANT).erreurs.join('\n')).toMatch(/Point 3.*pas de marqueur/);
  });

  it('un statut incohérent avec sa clé est refusé', () => {
    const d = copie();
    ecrire(d, 'docs/POST-AUDIT-GUIDE.md', (t) => t.replace('chantier: actif relu=2026-10-24', 'chantier: actif le=2026-10-24'));
    expect(chantiers.verifier(d, AVANT).erreurs.join('\n')).toMatch(/porte `relu=`/);
  });

  it('une date dans le futur est refusée', () => {
    expect(chantiers.verifier(RACINE, new Date('2026-06-01T00:00:00Z')).erreurs.join('\n')).toMatch(/futur/);
  });
});
