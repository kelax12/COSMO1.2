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
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  resumerAdvisors,
  comparerAdvisors,
  comparerPerformance,
  fusionnerReference,
  PERF_BLOQUANTS,
  REGLAGES_SURVEILLES,
} from './check-supabase-posture.mjs';
import { grilleDuCode, palierDe, rapprocher, prixStripe } from './check-stripe-prices.mjs';
import { sqlOrphelines, sqlAges, DUREE_DE_VIE_DU_COMPTE, DUREES_BORNEES, PREUVES, libelle } from './check-retention.mjs';
import { sqlExplain, extraire, pente, REQUETES } from './check-db-cost.mjs';
import { SONDES, jouer, cleAnonDepuisApi } from './check-edge-smoke.mjs';
import { variablesLues, variablesDeLExemple, secretsExposes, serveurNonLues } from './check-env-contract.mjs';
import { lignesAnnuaires, dateDeRemesure, ETATS } from './check-acquisition.mjs';
import { lireMarqueur, lirePhrase, documents } from './check-docs-scored.mjs';
import { CATALOGUE, verifierCatalogue } from './replay-sabotages.mjs';
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

  it('TEMOIN : la forme de l API Management, une entrée PAR OCCURRENCE, se compte', () => {
    // C'est la forme que rend réellement `/v1/projects/{ref}/advisors/security` :
    // ni `count` ni `findings`, le même `name` répété. Du 2026-09-20 au
    // 2026-10-02, chaque nom comptait ZÉRO (production : 11 / 2 / 80 / 1), et
    // la hausse 52 → 80 des fonctions DEFINER est passée sans un mot.
    const entree = (name, level, detail) => ({ name, level, detail, metadata: {} });
    const resume = resumerAdvisors({
      lints: [
        entree('authenticated_security_definer_function_executable', 'WARN', 'f1'),
        entree('authenticated_security_definer_function_executable', 'WARN', 'f2'),
        entree('authenticated_security_definer_function_executable', 'WARN', 'f3'),
        entree('auth_leaked_password_protection', 'WARN', 'auth'),
      ],
    });
    expect(resume).toEqual({
      authenticated_security_definer_function_executable: { niveau: 'WARN', compte: 3 },
      auth_leaked_password_protection: { niveau: 'WARN', compte: 1 },
    });
    // Et ce compte-là doit faire ROUGIR la garde contre une référence plus basse.
    const { ecarts } = comparerAdvisors(
      { authenticated_security_definer_function_executable: { niveau: 'WARN', compte: 2 } },
      resume,
    );
    expect(ecarts.some((e) => e.includes('+1'))).toBe(true);
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

  it('TEMOIN (AM-7) : `--update` recale les comptes et CONSERVE les `_note` humaines', () => {
    // Avant, le recalage réécrivait le fichier en entier : la raison pour
    // laquelle chaque objet est légitime disparaissait avec le recalage.
    const ancienne = {
      _securite_source: ['historique'],
      securite: {
        a: { niveau: 'INFO', compte: 11, _note: 'raison relue au catalogue' },
        disparu: { niveau: 'WARN', compte: 1, _note: 'ira' },
      },
      reglages_auth: { x: 1 },
    };
    const neuf = fusionnerReference(
      ancienne,
      { a: { niveau: 'INFO', compte: 14 }, b: { niveau: 'WARN', compte: 2 } },
      { x: 2 },
      '2026-10-24',
    );
    expect(neuf.securite.a).toEqual({ niveau: 'INFO', compte: 14, _note: 'raison relue au catalogue' });
    // Un advisor NOUVEAU naît sans note : elle s'écrit à la main, après relecture.
    expect(neuf.securite.b).toEqual({ niveau: 'WARN', compte: 2 });
    expect(neuf.securite.disparu).toBeUndefined();
    expect(neuf._securite_source).toEqual(['historique']);
    expect(neuf.reglages_auth).toEqual({ x: 2 });
    expect(neuf.pose_le).toBe('2026-10-24');
    // Première pose : pas d'ancienne référence, pas d'exception.
    expect(fusionnerReference(undefined, { a: { niveau: 'INFO', compte: 1 } }, {}, 'd').securite.a.compte).toBe(1);
  });

  it('AM-5 · TEMOIN : une FK neuve sans index fait ROUGIR, un index « inutilisé » de plus non', () => {
    const ref = {
      unindexed_foreign_keys: { niveau: 'INFO', compte: 0 },
      unused_index: { niveau: 'INFO', compte: 35 },
    };
    // La forme de l'API Management : une entrée par occurrence.
    const entree = (name) => ({ name, level: 'INFO', detail: 'x', metadata: {} });
    const mesure = resumerAdvisors({
      lints: [entree('unindexed_foreign_keys'), ...Array.from({ length: 40 }, () => entree('unused_index'))],
    });
    const { ecarts, infos } = comparerPerformance(ref, mesure);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain('unindexed_foreign_keys');
    expect(ecarts[0]).toContain('+1');
    // 35 → 40 index inutilisés : imprimé, jamais bloquant (suit le volume).
    expect(infos).toHaveLength(1);
    expect(infos[0]).toContain('unused_index');
    expect(PERF_BLOQUANTS.has('unused_index')).toBe(false);
  });

  it('AM-5 · un advisor de performance NEUF bloque, une baisse s enregistre sans rougir', () => {
    const ref = { unindexed_foreign_keys: { niveau: 'INFO', compte: 40 } };
    const neuf = comparerPerformance(ref, {
      unindexed_foreign_keys: { niveau: 'INFO', compte: 40 },
      table_bloat: { niveau: 'WARN', compte: 1 },
    });
    expect(neuf.ecarts.some((e) => e.includes('NOUVEAU') && e.includes('table_bloat'))).toBe(true);
    // La migration 227 : 40 → 0. L'advisor disparaît de la réponse.
    const apres = comparerPerformance(ref, {});
    expect(apres.ecarts).toEqual([]);
    expect(apres.baisses.some((b) => b.includes('DISPARU'))).toBe(true);
  });

  it('AM-5 · la référence commitée porte les advisors de performance', () => {
    const ref = JSON.parse(readFileSync(join(process.cwd(), 'scripts', 'supabase-posture.reference.json'), 'utf8'));
    expect(ref.performance).toBeTruthy();
    expect(ref.performance.unindexed_foreign_keys.compte).toBeGreaterThanOrEqual(0);
    expect(ref.performance.unused_index.compte).toBeGreaterThan(0);
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
    expect(sql).toContain('IS NOT NULL AND u.id IS NULL');
  });

  it('C-112 · chaque couple table/colonne a un libellé UNIQUE, et friend_requests est lue sur ses deux comptes', () => {
    // 🔴 La garde a planté à chaque run du 2026-09-20 au 2026-09-24 sur
    // `friend_requests.user_id`, une colonne qui n'existe pas. Les deux vraies
    // colonnes sont relues ici : retirer l'une ou revenir à `user_id` rougit.
    const libelles = DUREE_DE_VIE_DU_COMPTE.map(libelle);
    expect(new Set(libelles).size).toBe(libelles.length);
    expect(libelles).toContain('friend_requests.sender_id');
    expect(libelles).toContain('friend_requests.receiver_id');
    expect(libelles).not.toContain('friend_requests.user_id');
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
  it('les treize fonctions sont sondées, et aucune en écriture', () => {
    // 8 jusqu'au 2026-09-30 : les quatre fonctions du mode entreprise
    // n'étaient sondées par rien (A-2). Une par dossier de supabase/functions/.
    expect(SONDES).toHaveLength(13);
    expect(new Set(SONDES.map((s) => s.fonction)).size).toBe(13);
    for (const s of SONDES) {
      expect(s.prouve.length).toBeGreaterThan(30);
      expect(s.statut.length).toBeGreaterThan(0);
    }
    // 🔴 Les deux fonctions DESTRUCTRICES ne sont jamais appelées en POST.
    const destructrices = SONDES.filter((s) => ['delete-account', 'stripe-org-refund'].includes(s.fonction));
    expect(destructrices).toHaveLength(2);
    for (const s of destructrices) expect(s.methode).toBe('GET');
    // Celles qui ENVOIENT (e-mail, webhook) ne sont jamais sondées au-delà d'un refus.
    const emettrices = SONDES.filter((s) => ['send-org-invite', 'org-digest', 'org-webhook-dispatch', 'inactive-accounts'].includes(s.fonction));
    expect(emettrices).toHaveLength(4);
    for (const s of emettrices) expect(s.statut.every((c) => c >= 400)).toBe(true);
  });

  it('A-3 · une fonction cron se sonde SANS jeton, et un 401 de la passerelle échoue', async () => {
    const cron = SONDES.find((s) => s.fonction === 'org-webhook-dispatch');
    expect(cron.sansJeton).toBe(true);
    let vues = null;
    const corps = async (_url, init) => {
      vues = init.headers;
      return { status: 401, text: async () => '{"error":"unauthorized"}' };
    };
    const r1 = await jouer(cron, { base: 'https://x.invalid', anon: 'CLE', fetchImpl: corps });
    expect(vues.Authorization).toBeUndefined();
    expect(r1.ok).toBe(true);
    // TÉMOIN : le 401 que rendait la passerelle en verify_jwt = true.
    const passerelle = async () => ({ status: 401, text: async () => '{"code":401,"message":"Missing authorization header"}' });
    const r2 = await jouer(cron, { base: 'https://x.invalid', anon: 'CLE', fetchImpl: passerelle });
    expect(r2.ok).toBe(false);
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

  it('TEMOIN : `INVITE_ROW` n est PAS une variable `VITE_ROW`', () => {
    // 🔴 Faux positif du 2026-10-01 : la constante `INVITE_ROW` (rubrique
    // Inviter, `f9d8c875`) contient la sous-chaîne `VITE_ROW`, et la garde
    // réclamait au contrat deux variables qui n'existent pas.
    const tmp = mkdtempSync(join(tmpdir(), 'env-'));
    try {
      mkdirSync(join(tmp, 'src'));
      writeFileSync(join(tmp, 'src', 'a.ts'),
        "export const INVITE_ROW = 'x';\nexport const INVITE_ICON_BTN = 'y';\nconst u = import.meta.env.VITE_VRAIE;\n");
      const vues = variablesLues(tmp);
      expect(vues.has('VITE_VRAIE')).toBe(true);
      expect(vues.has('VITE_ROW')).toBe(false);
      expect(vues.has('VITE_ICON_BTN')).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('`.env.example` est lu, et une variable REQUISE y figure', () => {
    const exemple = variablesDeLExemple();
    expect(exemple).not.toBeNull();
    // 🔴 La variable dont l'absence CHANGE LA FORME DU BUNDLE.
    expect(exemple.has('VITE_SENTRY_DSN')).toBe(true);
  });

  it('TEMOIN : un nom de secret sous le préfixe `VITE_` est signalé (il partirait dans le bundle)', () => {
    expect(secretsExposes(new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_SECRET_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY'])))
      .toEqual(['VITE_SUPABASE_SECRET_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY']);
    // Le code réel n'en lit aucune.
    expect(secretsExposes(variablesLues())).toEqual([]);
  });

  it('TEMOIN : la clé serveur du collecteur est lue par son fichier, et une entrée morte se voit', () => {
    expect(serveurNonLues()).toEqual([]);
    const tmp = mkdtempSync(join(tmpdir(), 'env-'));
    try {
      mkdirSync(join(tmp, 'api'));
      writeFileSync(join(tmp, 'api', 'collect.ts'), 'const key = process.env.VITE_SUPABASE_ANON_KEY;\n');
      // `api/` est parcouru : dans un arbre SANS `src/`, sa `VITE_*` est vue.
      expect(variablesLues(tmp).has('VITE_SUPABASE_ANON_KEY')).toBe(true);
      expect(serveurNonLues(tmp)).toEqual(['SUPABASE_SECRET_KEY (api/collect.ts)']);
      rmSync(join(tmp, 'api'), { recursive: true, force: true });
      expect(serveurNonLues(tmp)).toEqual(['SUPABASE_SECRET_KEY (api/collect.ts)']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
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
  it('chaque sabotage nomme sa cible, sa garde, ce qui doit rougir et ce qu il protège', () => {
    // La forme détaillée (ids uniques, `attendu` pour un fichier de test,
    // `raison` pour une commande, `pourquoi` écrit) est jugée par
    // `verifierCatalogue`, que `replay-sabotages.guard.test.mjs` soumet à des
    // entrées fautives.
    // Cliquet posé au réel du 2026-10-15 (221 sabotages) : le catalogue ne
    // rétrécit pas en silence. Retirer un sabotage est une décision écrite.
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(220);
    expect(verifierCatalogue(CATALOGUE)).toEqual([]);
  });

  it('le catalogue couvre PLUSIEURS gardes, pas une seule', () => {
    // Un catalogue concentré sur une garde donnerait une fausse impression de
    // couverture : le script IMPRIME déjà le rapport couvert/total, ce cas
    // empêche qu'il se réduise.
    const gardes = new Set(CATALOGUE.map((s) => (typeof s.garde === 'string' ? s.garde : s.garde.commande)));
    expect(gardes.size).toBeGreaterThanOrEqual(55);
    // Et les deux familles : le défaut du PRODUIT vu par la garde, la garde
    // DÉSARMÉE vue par son témoin.
    expect(new Set(CATALOGUE.map((s) => s.famille))).toEqual(new Set(['produit', 'detecteur']));
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

// ═══════════════════════════════════════════════════════════════════
describe('témoin — la sonde de fumée trouve sa clé anon (C-114)', () => {
  it('lit la clé nommée « anon » par l API Management', async () => {
    const vues = [];
    const fetchImpl = async (url, init) => {
      vues.push({ url, auth: init.headers.Authorization });
      return { ok: true, json: async () => [{ name: 'service_role', api_key: 'NON' }, { name: 'anon', api_key: 'cle-anon' }] };
    };
    expect(await cleAnonDepuisApi({ token: 'jeton', projet: 'p', fetchImpl })).toBe('cle-anon');
    expect(vues[0].url).toBe('https://api.supabase.com/v1/projects/p/api-keys');
    expect(vues[0].auth).toBe('Bearer jeton');
  });

  it('échoue plutôt que de sonder sans clé : refus de l API, ou aucune clé anon', async () => {
    const refus = async () => ({ ok: false, status: 401 });
    await expect(cleAnonDepuisApi({ token: 'x', fetchImpl: refus })).rejects.toThrow(/401/);
    const sansAnon = async () => ({ ok: true, json: async () => [{ name: 'service_role', api_key: 'NON' }] });
    await expect(cleAnonDepuisApi({ token: 'x', fetchImpl: sansAnon })).rejects.toThrow(/anon/);
  });
});
