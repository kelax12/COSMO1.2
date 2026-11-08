// ═══════════════════════════════════════════════════════════════════
// check-coffre.guard.test.mjs · LE TÉMOIN DE LA VÉRIFICATION DU COFFRE (V4.2)
//
// Chaque cas soumet à `evaluerCoffre()` une situation qu'elle DOIT refuser, et
// échoue si elle répond « vert ». Le cas de référence (vérification récente et
// complète) pose le plancher : sans lui, une garde qui échoue toujours
// passerait tous les autres.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluerCoffre, elementsExiges, verifier, ELEMENTS_EXIGES, PERIODE_MAX_JOURS } from './check-coffre.mjs';

const RACINE = process.cwd();
const MAINTENANT = new Date('2027-03-01T12:00:00Z');
const il = (jours) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString().slice(0, 10);

const REGISTRE = { entries: [{ name: 'PHRASE_TEST', coffre: true }, { name: 'AUTRE', coffre: undefined }] };
const TOUS = elementsExiges(REGISTRE);
const verif = (o = {}) => ({ date: il(10), par: 'Axel', elements: TOUS, ...o });
const journal = (o = {}) => ({ periodeJours: 92, premiereEcheance: '2026-12-08', verifications: [verif()], ...o });
const evalue = (j, r = REGISTRE) => evaluerCoffre({ journal: j, registre: r, maintenant: MAINTENANT });

describe('check-coffre · plancher', () => {
  it('une vérification récente et complète passe', () => {
    const r = evalue(journal());
    expect(r.erreurs).toEqual([]);
    expect(r.resume.join()).toMatch(/10 j/);
  });

  it('les éléments exigés couvrent les cinq services, la console admin, sa sortie et l\'accès d\'urgence', () => {
    for (const el of ['mfa-github', 'mfa-supabase', 'mfa-vercel', 'mfa-stripe', 'mfa-hebergeur-courrier', 'admin-aal2', 'admin-aal2-sortie', 'acces-urgence']) {
      expect(ELEMENTS_EXIGES).toContain(el);
    }
    expect(TOUS).toContain('PHRASE_TEST');
  });
});

describe('check-coffre · ce que la garde DOIT refuser', () => {
  it('une vérification plus vieille que la période échoue ; à la limite exacte, passe', () => {
    expect(evalue(journal({ verifications: [verif({ date: il(92) })] })).erreurs).toEqual([]);
    expect(evalue(journal({ verifications: [verif({ date: il(93) })] })).erreurs.join()).toMatch(/93 j, borne 92 j/);
  });

  it('aucune vérification : verte avant la première échéance, rouge après', () => {
    const avant = evaluerCoffre({ journal: journal({ verifications: [] }), registre: REGISTRE, maintenant: new Date('2026-12-08T10:00:00Z') });
    expect(avant.erreurs).toEqual([]);
    const apres = evaluerCoffre({ journal: journal({ verifications: [] }), registre: REGISTRE, maintenant: new Date('2026-12-10T10:00:00Z') });
    expect(apres.erreurs.join()).toMatch(/première échéance dépassée de 2 j/);
  });

  it('la période ne se relève pas : au-delà de 92 jours, échec, et la borne reste 92', () => {
    expect(PERIODE_MAX_JOURS).toBe(92);
    const r = evalue(journal({ periodeJours: 365, verifications: [verif({ date: il(200) })] }));
    expect(r.erreurs.join('\n')).toMatch(/elle ne se relève pas/);
    expect(r.erreurs.join('\n')).toMatch(/200 j, borne 92 j/);
  });

  it('une période illisible échoue', () => {
    expect(evalue(journal({ periodeJours: 'souvent' })).erreurs.join()).toMatch(/periodeJours/);
  });

  it('une vérification qui oublie un élément exigé échoue, en le nommant', () => {
    const moins = TOUS.filter((e) => e !== 'mfa-stripe' && e !== 'acces-urgence');
    const r = evalue(journal({ verifications: [verif({ elements: moins })] }));
    expect(r.erreurs.join()).toMatch(/il manque : mfa-stripe, acces-urgence/);
  });

  it('un secret du registre marqué `coffre: true` est exigé', () => {
    const sans = TOUS.filter((e) => e !== 'PHRASE_TEST');
    expect(evalue(journal({ verifications: [verif({ elements: sans })] })).erreurs.join()).toMatch(/PHRASE_TEST/);
  });

  it('seule la DERNIÈRE vérification compte : une ancienne complète ne couvre pas une récente à trous', () => {
    const r = evalue(journal({ verifications: [verif({ date: il(80) }), verif({ date: il(5), elements: ['mfa-github'] })] }));
    expect(r.erreurs.join()).toMatch(/incomplète/);
  });

  it('une date dans le futur, un identifiant inconnu et un « par » vide échouent', () => {
    const t = evalue(journal({ verifications: [verif({ date: '2027-06-01', par: ' ', elements: [...TOUS, 'inconnu'] })] })).erreurs.join('\n');
    expect(t).toMatch(/dans le futur/);
    expect(t).toMatch(/`par`/);
    expect(t).toMatch(/élément inconnu « inconnu »/);
  });

  it('une forme de valeur dans le journal échoue', () => {
    const r = evalue(journal({ verifications: [verif({ note: 'code ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' })] }));
    expect(r.erreurs.join()).toMatch(/VALEUR/);
  });

  it('un journal sans liste, une date de première échéance fausse ou un journal absent échouent', () => {
    expect(evalue(journal({ verifications: 'oui' })).erreurs.join()).toMatch(/liste/);
    expect(evalue(journal({ premiereEcheance: 'bientôt' })).erreurs.join()).toMatch(/premiereEcheance/);
    expect(evalue(null).erreurs.join()).toMatch(/illisible/);
  });
});

describe('check-coffre · le journal commité', () => {
  const brut = () => JSON.parse(readFileSync(join(RACINE, '.github/coffre-verifications.json'), 'utf8'));
  const registre = () => JSON.parse(readFileSync(join(RACINE, '.github/secrets-registry.json'), 'utf8'));

  it('porte la borne de 92 jours et une première échéance datée', () => {
    expect(brut().periodeJours).toBe(PERIODE_MAX_JOURS);
    expect(brut().premiereEcheance).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(verifier(RACINE, new Date()).erreurs.join()).not.toMatch(/illisible/);
  });

  it('vierge de vérification : vert avant la première échéance, rouge après (le fichier réel, sans ses vérifications)', () => {
    const vierge = { ...brut(), verifications: [] };
    const avant = new Date(`${brut().premiereEcheance}T00:00:00Z`);
    avant.setUTCDate(avant.getUTCDate() - 1);
    const apres = new Date(`${brut().premiereEcheance}T00:00:00Z`);
    apres.setUTCDate(apres.getUTCDate() + 2);
    expect(evaluerCoffre({ journal: vierge, registre: registre(), maintenant: avant }).erreurs).toEqual([]);
    expect(evaluerCoffre({ journal: vierge, registre: registre(), maintenant: apres }).erreurs.join()).toMatch(/première échéance dépassée/);
  });

  it('le registre exige la phrase des sauvegardes au coffre', () => {
    const reg = JSON.parse(readFileSync(join(RACINE, '.github/secrets-registry.json'), 'utf8'));
    expect(elementsExiges(reg)).toContain('BACKUP_PASSPHRASE');
  });
});

describe('check-coffre · branchement', () => {
  const lire = (f) => readFileSync(join(RACINE, f), 'utf8').replace(/\r\n/g, '\n');

  it('`npm run check:coffre` existe', () => {
    expect(JSON.parse(lire('package.json')).scripts['check:coffre']).toBe('node scripts/check-coffre.mjs');
  });

  it('joue chaque jour dans gardes-calendrier.yml, jamais dans un job bloquant', () => {
    expect(lire('.github/workflows/gardes-calendrier.yml')).toContain('run: npm run check:coffre\n');
    for (const f of ['ci-noyau.yml', 'ci.yml']) expect(lire(`.github/workflows/${f}`), f).not.toContain('check:coffre');
  });

  it('la procédure existe dans docs/SECURITY.md sous le titre que la garde cite', () => {
    expect(lire('docs/SECURITY.md')).toMatch(/^## Coffre /m);
  });
});
