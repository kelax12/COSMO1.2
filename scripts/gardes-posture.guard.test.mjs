// ═══════════════════════════════════════════════════════════════════
// TÉMOIN — les gardes qui interrogent la PRODUCTION (C-87, C-88, C-91,
// C-93, C-101, C-105, C-106)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CES SEPT-LÀ ONT BESOIN D'UN TÉMOIN PLUS QUE LES AUTRES.
// Elles ne tournent que dans un job planifié, avec un secret, contre un
// service distant. Personne ne les exécute en écrivant du code, personne ne
// les voit échouer sur une PR. Une expression cassée dedans ne se découvre
// que le jour où l'on compte sur elles — c'est-à-dire le jour où quelque
// chose va déjà mal.
//
// Ce fichier n'appelle AUCUN service : il teste les fonctions PURES de ces
// scripts (construction du SQL, extraction d'un plan, comparaison à une
// référence, lecture d'un document), et injecte un `fetch` factice là où un
// appel réseau est en jeu. Il tourne donc partout, en moins d'une seconde.
//
// ⚠️ CE QU'IL NE PROUVE PAS : que l'API distante répond ce qu'on croit. Cette
// question-là n'a qu'une réponse, et c'est le job planifié qui la donne.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resumerAdvisors, comparerAdvisors, REGLAGES_SURVEILLES } from './check-supabase-posture.mjs';
import { grilleDuCode, palierDe, rapprocher, prixStripe } from './check-stripe-prices.mjs';
import { sqlOrphelines, sqlAges, DUREE_DE_VIE_DU_COMPTE, DUREES_BORNEES, PREUVES } from './check-retention.mjs';
import { sqlExplain, extraire, pente, REQUETES } from './check-db-cost.mjs';
import { SONDES, jouer } from './check-edge-smoke.mjs';
import { variablesLues, variablesDeLExemple } from './check-env-contract.mjs';
import { lignesAnnuaires, dateDeRemesure, ETATS } from './check-acquisition.mjs';
import { lireMarqueur, lirePhrase, documents } from './check-docs-scored.mjs';
import { CATALOGUE } from './replay-sabotages.mjs';
import { aplatir, grouperPluriels, categoriesAttendues, volumeIndexable, decouper } from './check-i18n-pages.mjs';

const LF = String.fromCharCode(10);

// ═══════════════════════════════════════════════════════════════════
describe('témoin — posture Supabase (C-88)', () => {
  it('`resumerAdvisors` réduit la réponse à ce qui se compare', () => {
    const resume = resumerAdvisors({
      lints: [
        { name: 'rls_enabled_no_policy', level: 'INFO', count: 9 },
        // `count` absent : on retombe sur le nombre de `findings`. Sans ce
        // repli, un advisor qui change de forme compterait ZÉRO, et une
        // hausse passerait pour une baisse.
        { name: 'autre', level: 'WARN', findings: [{}, {}, {}] },
      ],
    });
    expect(resume).toEqual({
      rls_enabled_no_policy: { niveau: 'INFO', compte: 9 },
      autre: { niveau: 'WARN', compte: 3 },
    });
    expect(resumerAdvisors({})).toEqual({});
  });

  it('`comparerAdvisors` voit une HAUSSE et un advisor NEUF', () => {
    const ref = { a: { niveau: 'WARN', compte: 52 } };
    const { ecarts } = comparerAdvisors(ref, {
      a: { niveau: 'WARN', compte: 53 },
      b: { niveau: 'ERROR', compte: 1 },
    });
    expect(ecarts.some((e) => e.includes('53 occurrence') && e.includes('+1'))).toBe(true);
    expect(ecarts.some((e) => e.includes('NOUVEAU') && e.includes('`b`'))).toBe(true);
  });

  it('une BAISSE n est pas un échec, et un changement de NIVEAU en est un', () => {
    // Une baisse est une amélioration à enregistrer, pas un rouge — sinon
    // corriger un défaut ferait échouer la CI.
    const { ecarts, baisses } = comparerAdvisors(
      { a: { niveau: 'WARN', compte: 9 } },
      { a: { niveau: 'WARN', compte: 4 } },
    );
    expect(ecarts).toEqual([]);
    expect(baisses).toHaveLength(1);
    // Un advisor qui passe de WARN à ERROR au même compte est bien un écart.
    expect(
      comparerAdvisors({ a: { niveau: 'WARN', compte: 9 } }, { a: { niveau: 'ERROR', compte: 9 } }).ecarts,
    ).toHaveLength(1);
  });

  it('les réglages surveillés portent tous une raison', () => {
    // 🔴 Une liste de clés sans raison redevient une liste qu'on ne relit
    // pas — et ces réglages se changent en deux clics, hors du dépôt.
    expect(Object.keys(REGLAGES_SURVEILLES).length).toBeGreaterThanOrEqual(8);
    for (const [cle, raison] of Object.entries(REGLAGES_SURVEILLES)) {
      expect(raison.length, `${cle} sans raison`).toBeGreaterThan(20);
    }
    expect(REGLAGES_SURVEILLES).toHaveProperty('password_hibp_enabled');
    expect(REGLAGES_SURVEILLES).toHaveProperty('mfa_totp_enroll_enabled');
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — grille Stripe (C-106)', () => {
  it('la grille est LUE dans premium-config.ts, pas recopiée', () => {
    const g = grilleDuCode();
    expect(g.paliers.map((p) => p.key)).toEqual(['free', 't10', 't20', 't50', 'tmax']);
    expect(g.remiseAnnuelle).toBe(0.3);
    // La dérivation annuelle : équivalent mensuel ARRONDI, puis ×12. L'ordre
    // compte — dériver du brut donnerait un centime d'écart avec « 12 × le
    // prix affiché », et un client se fie à sa multiplication.
    expect(g.totalAnnuelEur(20)).toBe(168);
    expect(g.totalAnnuelEur(50)).toBe(420);
    expect(g.totalAnnuelEur(100)).toBe(840);
    expect(g.totalAnnuelEur(200)).toBe(1680);
  });

  it('une grille illisible fait JETER, pas rendre une liste vide', () => {
    // 🔴 Une liste vide rendrait « 0 palier comparé », donc « 0 écart », donc
    // un vert. Un `throw` est la bonne réponse.
    expect(() => grilleDuCode('rien du tout')).toThrow(/ENTERPRISE_PRICING_TIERS/);
    expect(() => grilleDuCode('const ENTERPRISE_PRICING_TIERS = [] as const;')).toThrow(
      /ENTERPRISE_YEARLY_DISCOUNT/,
    );
  });

  it('`palierDe` lit le prix PUIS son produit', () => {
    expect(palierDe({ metadata: { cosmo_tier: 't10' } })).toBe('t10');
    expect(palierDe({ metadata: {}, product: { metadata: { cosmo_tier: 't20' } } })).toBe('t20');
    expect(palierDe({})).toBeNull();
  });

  it('LE DOUBLON est vu — le défaut silencieux de C-106', () => {
    // 🔴 Deux prix actifs pour le même palier font rendre `yearly_unavailable`
    // à la dérivation : l'encaissement annuel s'arrête sans que rien ne casse.
    const g = grilleDuCode();
    const prix = (tier, interval, cts) => ({
      id: `price_${tier}_${interval}_${cts}`,
      metadata: { cosmo_tier: tier },
      recurring: { interval },
      unit_amount: cts,
      currency: 'eur',
      tax_behavior: 'inclusive',
    });
    const complet = [];
    for (const p of g.paliers.filter((p) => p.priceEurPerMonth > 0)) {
      complet.push(prix(p.key, 'month', p.priceEurPerMonth * 100));
      complet.push(prix(p.key, 'year', Math.round(g.totalAnnuelEur(p.priceEurPerMonth) * 100)));
    }
    expect(rapprocher(g, complet).erreurs).toEqual([]);

    const avecDoublon = [...complet, prix('t10', 'year', 16800)];
    const e = rapprocher(g, avecDoublon).erreurs;
    expect(e.some((x) => x.includes('2 prix actifs') && x.includes('yearly_unavailable'))).toBe(true);
  });

  it('un MONTANT, une DEVISE ou un `tax_behavior` faux sont vus', () => {
    const g = grilleDuCode();
    const base = (patch) => {
      const out = [];
      for (const p of g.paliers.filter((p) => p.priceEurPerMonth > 0)) {
        out.push({
          id: `m_${p.key}`, metadata: { cosmo_tier: p.key }, recurring: { interval: 'month' },
          unit_amount: p.priceEurPerMonth * 100, currency: 'eur', tax_behavior: 'inclusive',
        });
        out.push({
          id: `y_${p.key}`, metadata: { cosmo_tier: p.key }, recurring: { interval: 'year' },
          unit_amount: Math.round(g.totalAnnuelEur(p.priceEurPerMonth) * 100),
          currency: 'eur', tax_behavior: 'inclusive',
        });
      }
      Object.assign(out[0], patch);
      return out;
    };
    expect(rapprocher(g, base({ unit_amount: 1 })).erreurs.some((e) => e.includes('centimes'))).toBe(true);
    expect(rapprocher(g, base({ currency: 'usd' })).erreurs.some((e) => e.includes('devise'))).toBe(true);
    // 🔴 `exclusive` ferait payer la TVA EN PLUS à un particulier — décision
    // définitive du 2026-08-26 : tout client est un consommateur.
    expect(
      rapprocher(g, base({ tax_behavior: 'exclusive' })).erreurs.some((e) => e.includes('L112-1')),
    ).toBe(true);
  });

  it('`prixStripe` pagine, et refuse une réponse en erreur', async () => {
    let appels = 0;
    const faux = async () => {
      appels += 1;
      return {
        ok: true,
        json: async () =>
          appels === 1
            ? { data: [{ id: 'a' }], has_more: true }
            : { data: [{ id: 'b' }], has_more: false },
      };
    };
    expect((await prixStripe({ cle: 'sk_test_x', fetchImpl: faux })).map((p) => p.id)).toEqual(['a', 'b']);

    const refus = async () => ({ ok: false, status: 401, text: async () => 'nope' });
    await expect(prixStripe({ cle: 'mauvaise', fetchImpl: refus })).rejects.toThrow(/401/);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — durées de conservation (C-93)', () => {
  it('le SQL des orphelines cite CHAQUE table, sans en sauter', () => {
    const sql = sqlOrphelines();
    for (const { table } of DUREE_DE_VIE_DU_COMPTE) {
      expect(sql, `table ${table} absente du SQL`).toContain(`public.${table}`);
    }
    expect((sql.match(/UNION ALL/g) ?? []).length).toBe(DUREE_DE_VIE_DU_COMPTE.length - 1);
    // Une jointure GAUCHE sur `auth.users` : c'est elle qui trouve les lignes
    // dont le compte n'existe plus.
    expect(sql).toContain('LEFT JOIN auth.users');
    expect(sql).toContain('WHERE u.id IS NULL');
  });

  it('le SQL des âges utilise la VRAIE colonne de date de chaque table', () => {
    // 🔴 Trois de ces tables n'ont pas de `created_at` : `payment_records`
    // porte `occurred_at`, `withdrawal_consents` `consented_at`,
    // `renewal_notices` `sent_at`. Une garde écrite sur `created_at` aurait
    // échoué sur une erreur SQL — rouge pour la mauvaise raison.
    const sql = sqlAges();
    expect(sql).toContain('min(occurred_at)');
    expect(sql).not.toMatch(/public\.payment_records[\s\S]{0,40}created_at/);
    for (const d of DUREES_BORNEES) expect(sql).toContain(`public.${d.table}`);
  });

  it('les deux tables de PREUVE sont exemptées du contrôle d orphelines', () => {
    // Leur survie est l'objet même : journal fiscal (CGI art. 286-I-3° bis) et
    // preuve de consentement (Conso. L221-28).
    expect(PREUVES.has('payment_records')).toBe(true);
    expect(PREUVES.has('withdrawal_consents')).toBe(true);
    expect(PREUVES.has('tasks')).toBe(false);
  });

  it('une durée NON DÉCLARÉE au registre vaut `null`, jamais un chiffre inventé', () => {
    const sansDuree = DUREES_BORNEES.filter((d) => d.jours === null);
    expect(sansDuree.map((d) => d.table).sort()).toEqual(['email_lookup_quota', 'rate_limits']);
    for (const d of DUREES_BORNEES) expect(d.source.length).toBeGreaterThan(30);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — coût serveur (C-87)', () => {
  it('l EXPLAIN tourne sous `authenticated`, avec des claims, et ROLLBACK', () => {
    // 🔴 Sans le rôle et les claims, l'API Management exécute en
    // superutilisateur : la RLS ne s'applique pas, et le plan mesuré n'est
    // PAS celui qu'un utilisateur rencontre — l'inverse de ce qu'on veut.
    const sql = sqlExplain(REQUETES[0]);
    expect(sql).toContain('SET LOCAL ROLE authenticated;');
    expect(sql).toContain('"role":"authenticated"');
    expect(sql).toMatch(/SET LOCAL request\.jwt\.claims = '\{"sub":"[0-9a-f-]{36}"/);
    expect(sql.startsWith('BEGIN;')).toBe(true);
    expect(sql.trimEnd().endsWith('ROLLBACK;')).toBe(true);
    expect(sql).toContain('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)');
  });

  it('`extraire` lit les chiffres d un plan, et compte les Seq Scan', () => {
    const plan = [{
      Plan: {
        'Node Type': 'Limit', 'Total Cost': 1109.22, 'Shared Hit Blocks': 28, 'Actual Rows': 50,
        Plans: [{ 'Node Type': 'Seq Scan', Plans: [{ 'Node Type': 'Seq Scan' }] }],
      },
      'Execution Time': 19.877,
      'Planning Time': 17.986,
    }];
    expect(extraire(plan)).toEqual({
      cout: 1109.22, ms: 19.877, planification_ms: 17.986, blocs: 28, lignes: 50, seq_scans: 2,
    });
    // Un plan illisible rend des `null`, pas des zéros : un zéro se lirait
    // « gratuit », ce qui est le pire contresens possible ici.
    expect(extraire({}).cout).toBeNull();
  });

  it('`pente` compare le DERNIER point au PREMIER, et refuse d un seul point', () => {
    expect(pente([100, 150, 300])).toBe(3);
    expect(pente([42])).toBeNull();
    expect(pente([])).toBeNull();
    // Les trous (mesure absente un jour) ne cassent pas la pente.
    expect(pente([100, null, undefined, 200])).toBe(2);
  });

  it('chaque requête de référence porte un plafond ET une raison', () => {
    expect(REQUETES.length).toBeGreaterThanOrEqual(4);
    for (const r of REQUETES) {
      expect(r.plafond_ms).toBeGreaterThan(0);
      expect(r.plafond_cout).toBeGreaterThan(0);
      expect(r.pourquoi.length).toBeGreaterThan(30);
      // Aucune requête de référence n'écrit. Ce sont des SELECT, point.
      expect(r.sql.trim().toUpperCase().startsWith('SELECT')).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — sondes de fumée des Edge Functions (C-91)', () => {
  it('les huit fonctions sont sondées, et aucune en écriture', () => {
    expect(SONDES).toHaveLength(8);
    for (const s of SONDES) {
      expect(s.prouve.length).toBeGreaterThan(30);
      expect(s.statut.length).toBeGreaterThan(0);
    }
    // 🔴 Les deux fonctions DESTRUCTRICES ne sont jamais appelées en POST.
    const destructrices = SONDES.filter((s) => ['delete-account', 'stripe-org-refund'].includes(s.fonction));
    expect(destructrices).toHaveLength(2);
    for (const s of destructrices) expect(s.methode).toBe('GET');
  });

  it('la sonde envoie la clé anon — sinon elle mesure Supabase, pas la fonction', async () => {
    // 🔴 Sans `Authorization`, `verify_jwt` refuse AVANT la fonction : la
    // sonde vérifierait alors que Supabase est debout, pas notre code.
    let vues = null;
    const faux = async (_url, init) => {
      vues = init.headers;
      return { status: 405, text: async () => '{"error":"method_not_allowed"}' };
    };
    const r = await jouer(SONDES[1], { base: 'https://x.invalid', anon: 'CLE', fetchImpl: faux });
    expect(vues.Authorization).toBe('Bearer CLE');
    expect(vues.apikey).toBe('CLE');
    expect(r.ok).toBe(true);
  });

  it('un bon CODE avec un MAUVAIS corps est refusé', () => {
    // C'est le cœur de C-91 : un 405 rendu par un proxy ou une version
    // antérieure déployée n'est pas un 405 rendu par notre corps de fonction.
    const faux = async () => ({ status: 405, text: async () => 'nginx' });
    return jouer(SONDES[1], { base: 'https://x.invalid', anon: 'k', fetchImpl: faux }).then((r) => {
      expect(r.ok).toBe(false);
      expect(r.raison).toContain('ne vient pas de la fonction');
    });
  });

  it('un statut inattendu et une panne réseau sont distingués', async () => {
    const mauvais = async () => ({ status: 500, text: async () => 'boom' });
    const r1 = await jouer(SONDES[1], { base: 'https://x.invalid', anon: 'k', fetchImpl: mauvais });
    expect(r1.ok).toBe(false);
    expect(r1.raison).toContain('statut 500');

    const mort = async () => { throw new Error('ECONNREFUSED'); };
    const r2 = await jouer(SONDES[1], { base: 'https://x.invalid', anon: 'k', fetchImpl: mort });
    expect(r2.ok).toBe(false);
    expect(r2.raison).toContain('injoignable');
    expect(r2.statut).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — contrat d environnement (C-105)', () => {
  it('toutes les `VITE_*` du code sont vues', () => {
    const vues = variablesLues();
    expect(vues.has('VITE_SUPABASE_URL')).toBe(true);
    expect(vues.has('VITE_SENTRY_DSN')).toBe(true);
    expect(vues.has('VITE_TURNSTILE_SITE_KEY')).toBe(true);
    expect(vues.size).toBeGreaterThanOrEqual(6);
  });

  it('`.env.example` est lu, et une variable REQUISE y figure', () => {
    const exemple = variablesDeLExemple();
    expect(exemple).not.toBeNull();
    // 🔴 La variable dont l'absence CHANGE LA FORME DU BUNDLE.
    expect(exemple.has('VITE_SENTRY_DSN')).toBe(true);
  });

  it('un arbre sans `.env.example` rend `null`, pas un ensemble vide', () => {
    // Un ensemble vide se comparerait silencieusement à tout ; `null` force
    // l'appelant à traiter le cas.
    const tmp = mkdtempSync(join(tmpdir(), 'env-'));
    try {
      expect(variablesDeLExemple(tmp)).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — acquisition (C-101)', () => {
  it('les lignes du tableau des annuaires sont lues avec leur état', () => {
    const lignes = lignesAnnuaires(
      ['| # | Site | Coût | État | Fait le | Prépa | Note |',
       '|---|---|---|---|---|---|---|',
       '| 1 | **Appvizer** | Gratuit | `a-faire` | — | x | y |',
       '| 2 | **AlternativeTo** | Gratuit | `fait` | 2026-09-01 | x | y |'].join(LF),
    );
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({ numero: 1, etat: 'a-faire' });
    expect(lignes[1]).toMatchObject({ numero: 2, etat: 'fait', date: '2026-09-01' });
  });

  it('les cinq états sont les cinq, et pas un de plus', () => {
    expect(ETATS).toEqual(['a-faire', 'en-cours', 'fait', 'refuse', 'abandonne']);
  });

  it('la fraîcheur se lit sur un MARQUEUR, pas sur la première date venue', () => {
    // 🔴 La première écriture prenait « la date la plus récente citée quelque
    // part » : elle trouvait le 2026-09-20 d'une note sur une migration et
    // déclarait les chiffres frais, alors qu'ils dataient du 09-14.
    const doc = ['<!-- chiffres-remesures: 2026-09-14 -->',
                 '# Titre', 'Une note du 2026-09-20 sur autre chose.'].join(LF);
    expect(dateDeRemesure(doc)).toBe('2026-09-14');
    expect(dateDeRemesure('# Sans marqueur, mais daté 2026-09-30')).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — notes d audit déclarées (C-109)', () => {
  it('les quatre formes de marqueur sont reconnues', () => {
    expect(lireMarqueur('<!-- note-audit: note=84 -->')).toMatchObject({ forme: 'note', valeur: '84' });
    expect(lireMarqueur('<!-- note-audit: couvert-par=RGPD.md -->')).toMatchObject({
      forme: 'couvert-par', valeur: 'RGPD.md',
    });
    expect(lireMarqueur('<!-- note-audit: non-note -->')).toMatchObject({ forme: 'non-note' });
    expect(lireMarqueur('<!-- note-audit: tableau-de-bord -->')).toMatchObject({ forme: 'tableau-de-bord' });
    expect(lireMarqueur('<!-- note-audit: n_importe_quoi -->')).toMatchObject({ forme: 'INCONNUE' });
    expect(lireMarqueur('# Sans marqueur')).toBeNull();
  });

  it('la phrase lisible est lue, et exigée', () => {
    expect(lirePhrase(`> **Note d'audit** — Couvert par RGPD.md, même domaine.`))
      .toBe('Couvert par RGPD.md, même domaine.');
    expect(lirePhrase('# Rien')).toBeNull();
  });

  it('les 28 documents de `docs/` sont vus', () => {
    const d = documents();
    expect(d.length).toBeGreaterThanOrEqual(20);
    expect(d).toContain('SECURITY.md');
    expect(d.every((f) => f.endsWith('.md'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — catalogue de sabotages (C-81)', () => {
  it('chaque sabotage nomme sa cible, son témoin et ce qu il protège', () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(10);
    const ids = CATALOGUE.map((s) => s.id);
    expect(new Set(ids).size, 'deux sabotages portent le même id').toBe(ids.length);
    for (const s of CATALOGUE) {
      expect(s.cible).toBeTruthy();
      expect(s.temoin).toMatch(/\.(test|spec)\.(ts|tsx|mjs)$/);
      expect(s.chercher).toBeTruthy();
      expect(s.remplacer).not.toBe(s.chercher);
      expect(s.pourquoi.length, `${s.id} sans explication`).toBeGreaterThan(40);
    }
  });

  it('le catalogue couvre PLUSIEURS témoins, pas un seul', () => {
    // Un catalogue concentré sur un témoin donnerait une fausse impression de
    // couverture : le script IMPRIME déjà le rapport couvert/total, ce cas
    // empêche qu'il tombe à un.
    expect(new Set(CATALOGUE.map((s) => s.temoin)).size).toBeGreaterThanOrEqual(6);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('témoin — pages et pluriels i18n (C-99)', () => {
  it('`aplatir` descend les objets et laisse les tableaux entiers', () => {
    expect(aplatir({ a: { b: { c: 1 } }, d: [1, 2] })).toEqual({ 'a.b.c': 1, d: [1, 2] });
  });

  it('`grouperPluriels` regroupe par racine', () => {
    const g = grouperPluriels({ 'x_one': 1, 'x_other': 2, 'y_other': 3, z: 4 });
    expect([...g.keys()].sort()).toEqual(['x', 'y']);
    expect([...g.get('x')].sort()).toEqual(['one', 'other']);
  });

  it('les catégories CLDR viennent d `Intl`, pas d une liste écrite de tête', () => {
    expect([...categoriesAttendues('en')].sort()).toEqual(['one', 'other']);
    expect([...categoriesAttendues('fr')].sort()).toEqual(['many', 'one', 'other']);
  });

  it('`volumeIndexable` compte le bloc prérendu, pas le HTML entier', () => {
    const page = '<html><head><title>x</title><script>var a=1</script></head><body>'
      + '<div id="seo-fallback"><h1>Un titre</h1><p>trois mots ici</p></div></body></html>';
    // « Un titre » (2) + « trois mots ici » (3) = 5. Le titre du <head> et le
    // <script> sont HORS du bloc prerendu : ils ne comptent pas.
    expect(volumeIndexable(page)).toBe(5);
  });

  it('`decouper` apparie les slugs LOCALISÉS', () => {
    // 🔴 Sans l'appariement, `/a-propos/` et `/en/about/` sont deux pages sans
    // rapport : le ratio fr↔en ne se calcule jamais sur les neuf pages
    // éditoriales, c'est-à-dire celles qui portent le contenu.
    expect(decouper('/en/about/')).toEqual({ locale: 'en', nu: '/a-propos/' });
    expect(decouper('/en/for-companies/')).toEqual({ locale: 'en', nu: '/entreprise-presentation/' });
    // Le piège : un chemin qui COMMENCE par « en » sans être une locale.
    expect(decouper('/entreprise-presentation/')).toEqual({
      locale: 'fr', nu: '/entreprise-presentation/',
    });
  });

  it('un catalogue jetable se lit, et un dossier absent rend `{}`', async () => {
    const { catalogue } = await import('./check-i18n-pages.mjs');
    const tmp = mkdtempSync(join(tmpdir(), 'i18n-'));
    try {
      mkdirSync(join(tmp, 'fr'));
      writeFileSync(join(tmp, 'fr', 'ns.json'), JSON.stringify({ a: { b: 'x' } }));
      expect(catalogue('fr', tmp)).toEqual({ 'ns.a.b': 'x' });
      expect(catalogue('es', tmp)).toEqual({});
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
