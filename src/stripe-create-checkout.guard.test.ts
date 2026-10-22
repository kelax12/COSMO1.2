// ═══════════════════════════════════════════════════════════════════
// GARDE — `stripe-create-checkout`, la seule Edge Function que RIEN ne
// regardait (C-82)
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 COMMENT CE FICHIER EST NÉ. `scripts/edge-function-coverage.mjs` a été
// écrit le 2026-09-20 pour poser un plancher : aucune Edge Function sans au
// moins un témoin qui la nomme. Au premier run il a rendu :
//
//     stripe-create-checkout    0
//
// Huit fonctions déployées, sept regardées par entre 1 et 5 témoins, et une à
// zéro. C'est la fonction qui ouvre la session de paiement PARTICULIER : elle
// crée un client Stripe, écrit dans `subscriptions`, et rend l'URL vers
// laquelle on envoie quelqu'un saisir une carte.
//
// ⚠️ Elle est TEXTUELLE, comme les dix autres témoins d'Edge Functions de ce
// dépôt, et pour la même raison : ces modules sont du Deno, importent depuis
// `npm:` et `https://`, et rien ici ne peut les exécuter. Ce qu'elle prouve
// est ce qui a déjà cassé une fois dans ce fichier (failles N7, U1, M-3,
// audit archi M6), pas que le paiement fonctionne.
//
// ❌ NE JAMAIS lire un vert ici comme « le checkout marche ». La preuve
//    d'exécution est une session Stripe réellement ouverte, et elle appartient
//    à la bascule live (`docs/STRIPE-LIVE.md`).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LF = String.fromCharCode(10);

/**
 * Lu et NORMALISÉ en `\n`.
 *
 * 🔴 Ce fichier est en CRLF sur ce poste. Un motif multi-lignes écrit en `\n`
 * n'y remplacerait rien, donc le témoin de sabotage plus bas passerait au vert
 * en n'ayant RIEN saboté — la garde répondrait sans mesurer. Défaut rencontré
 * à l'écriture de ce fichier même, avant qu'il ne soit vert une seule fois.
 */
const source = readFileSync(join(process.cwd(), 'supabase/functions/stripe-create-checkout/index.ts'), 'utf-8')
  .split('\r\n')
  .join(LF);

/** Le CODE seul : ce fichier cite ses propres pièges en commentaire. */
function codeOnly(texte: string): string {
  return texte
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(LF)
    .map((ligne) => {
      const at = ligne.indexOf('//');
      return at === -1 ? ligne : ligne.slice(0, at);
    })
    .join(LF);
}

const code = codeOnly(source);

/**
 * Le bloc d'arguments d'un `createClient(` donne, parentheses EQUILIBREES.
 *
 * 🔴 La premiere ecriture de ce temoin coupait au premier `)` rencontre. Or le
 * premier `)` de ce bloc est celui de `Deno.env.get('SUPABASE_URL')` : le bloc
 * extrait s'arretait a la deuxieme ligne, donc il ne contenait NI
 * `SUPABASE_SERVICE_ROLE_KEY`, NI l'option `global` ou vivrait le defaut. Les
 * deux assertions repondaient sans rien regarder — l'une passait par hasard
 * dans un sens, l'autre echouait dans l'autre. C'est le temoin de sabotage qui
 * l'a revele, pas la lecture.
 */
function blocCreateClient(texte: string, nomVariable: string): string {
  const depart = texte.indexOf(nomVariable);
  if (depart === -1) return '';
  const ouvre = texte.indexOf('createClient(', depart);
  if (ouvre === -1) return '';
  let profondeur = 0;
  for (let i = ouvre + 'createClient'.length; i < texte.length; i += 1) {
    if (texte[i] === '(') profondeur += 1;
    else if (texte[i] === ')') {
      profondeur -= 1;
      if (profondeur === 0) return texte.slice(depart, i + 1);
    }
  }
  return texte.slice(depart);
}

/**
 * Le joker CORS, dans ses DEUX formes.
 *
 * 🔴 La première écriture de ce témoin ne cherchait que la forme littérale
 * (`'Access-Control-Allow-Origin': '*'`) alors que ce fichier écrit son
 * en-tête par AFFECTATION INDEXÉE (`headers['…'] = allow`). Le détecteur
 * n'aurait donc pas vu le sabotage le plus naturel de ce code-là. Une
 * expression qui ne couvre qu'une des deux formes rend une garde verte sur
 * l'autre.
 */
const JOKER_CORS = /Access-Control-Allow-Origin'\]?\s*[:=]\s*'\*'/;

describe('garde — stripe-create-checkout (C-82)', () => {
  it('TEMOIN : le nettoyage de commentaires ne mange pas le code', () => {
    // 🔴 Sans cette sonde, un `codeOnly` cassé viderait la source et TOUS les
    // `not.toMatch` ci-dessous passeraient au vert sur du vide.
    expect(code.length).toBeGreaterThan(source.length / 3);
    expect(code).toContain('Deno.serve');
    expect(codeOnly('const a = 1; // commentaire')).not.toContain('commentaire');
  });

  it("l'origine CORS est une ALLOWLIST, jamais le joker", () => {
    // Faille N7. L'endpoint est authentifié par JWT, donc le joker n'était pas
    // directement exploitable — mais il amplifie la portée d'un JWT qui fuit,
    // en autorisant le rejeu depuis n'importe quelle origine.
    expect(code).toContain('ALLOWED_ORIGINS');
    expect(code).not.toMatch(JOKER_CORS);
    // `Vary: Origin` : sans lui, un cache intermédiaire sert à une origine la
    // réponse calculée pour une autre, ce qui annule l'allowlist.
    expect(code).toContain("'Vary': 'Origin'");
  });

  it('sans en-tete Authorization, la reponse est 401 AVANT tout appel Stripe', () => {
    const premier401 = code.indexOf('401');
    const stripeNew = code.indexOf('new Stripe(');
    expect(premier401).toBeGreaterThan(-1);
    expect(stripeNew).toBeGreaterThan(-1);
    expect(premier401).toBeLessThan(stripeNew);
  });

  it("le client service_role n'est JAMAIS construit avec le JWT de l'appelant", () => {
    // Le motif dangereux : passer `Authorization: authHeader` au client
    // service_role. La RLS serait contournée ET l'identité viendrait du
    // client, donc l'appelant choisirait pour qui on paie.
    const bloc = blocCreateClient(code, 'supabaseAdmin');
    expect(bloc, 'bloc `supabaseAdmin = createClient(...)` introuvable').not.toEqual('');
    expect(bloc).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(bloc).not.toContain('authHeader');
  });

  it("l'identite vient du JWT verifie, jamais du corps de la requete", () => {
    // 🔴 Le mass-assignment de cette fonction : si `supabase_uid` venait du
    // corps JSON, n'importe qui paierait un abonnement au nom d'un autre — ou,
    // pire, s'en ferait attribuer un.
    expect(code).toContain('supabaseUser.auth.getUser()');
    expect(code).toMatch(/metadata:\s*\{\s*supabase_uid:\s*user\.id\s*\}/);
    expect(code).not.toMatch(/await\s+req\.json\(\)/);
  });

  it('les deux ecritures Stripe portent une cle d idempotence (M-3)', () => {
    // Un double-clic ou une reprise réseau créait deux clients Stripe, donc
    // deux abonnements possibles pour un seul compte.
    expect(code).toContain('idempotencyKey: `customer:${user.id}`');
    expect(code).toContain('idempotencyKey: `checkout:${user.id}:${dayKey}`');
  });

  it("l'identifiant client Stripe est persiste par UPSERT, pas par UPDATE (faille U1)", () => {
    // Un `UPDATE` seul ne matchait aucune ligne tant que la ligne
    // `subscriptions` n'existait pas : l'identifiant du client Stripe était
    // perdu en silence, et chaque reprise créait un client orphelin de plus —
    // des clients payants sans ligne en base.
    expect(code).toContain('.upsert(');
    expect(code).toMatch(/onConflict:\s*'user_id'/);
  });

  it('un abonnement DEJA actif est refuse', () => {
    // Sans ce contrôle, un compte déjà abonné pouvait ouvrir une seconde
    // session et être débité deux fois.
    expect(code).toContain('already_subscribed');
    expect(code).toMatch(/status === 'active'/);
    expect(code).toMatch(/status === 'trialing'/);
  });

  it('un echec ALERTE, et ne fuit rien (audit archi M6)', () => {
    // Cette fonction n'avait AUCUNE alerte : un checkout cassé (clé expirée,
    // price id supprimé) échouait en silence, c'est-à-dire en perte de revenu
    // que personne ne voit.
    expect(code).toContain("opsAlert('stripe-create-checkout'");
    // Le corps rendu au client reste générique : ni message d'erreur Stripe,
    // ni trace. Un message d'erreur de fournisseur est un oracle.
    expect(code).toMatch(/error:\s*'Internal server error'/);
    expect(code).not.toMatch(/JSON\.stringify\(\{\s*error:\s*(err|error)\b/);
  });

  it('TEMOIN : chaque detecteur voit son defaut sur une source SABOTEE', () => {
    // 🔴 La règle du dépôt : un détecteur qui ne détecte plus rend une garde
    // verte pour toujours. Chaque motif ci-dessus est donc soumis à la version
    // fautive qu'il doit refuser. Et chaque sabotage vérifie d'abord qu'il a
    // bien remplacé quelque chose — un sabotage qui ne sabote rien est la
    // façon la plus discrète de désarmer un témoin.

    // ── 1. Le joker CORS, dans ses deux formes ──────────────────────
    const jokerIndexe = source.replace(
      "if (allow) headers['Access-Control-Allow-Origin'] = allow",
      "headers['Access-Control-Allow-Origin'] = '*'",
    );
    const jokerLitteral = source.replace(
      "'Vary': 'Origin',",
      "'Vary': 'Origin',    'Access-Control-Allow-Origin': '*',",
    );
    for (const [nom, sabote] of [
      ['indexee', jokerIndexe],
      ['litterale', jokerLitteral],
    ] as const) {
      expect(sabote, `le sabotage CORS ${nom} n a rien remplace`).not.toEqual(source);
      expect(codeOnly(sabote)).toMatch(JOKER_CORS);
    }

    // ── 2. Le service_role construit avec le JWT de l'appelant ──────
    const jwtAuService = source.replace(
      `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',${LF}    )`,
      `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',${LF}      { global: { headers: { Authorization: authHeader } } },${LF}    )`,
    );
    expect(jwtAuService, 'le sabotage service_role n a rien remplace').not.toEqual(source);
    expect(blocCreateClient(codeOnly(jwtAuService), 'supabaseAdmin')).toContain('authHeader');

    // ── 3. Le retour à UPDATE ───────────────────────────────────────
    const retourUpdate = source.replace('.upsert(', '.update(');
    expect(retourUpdate, 'le sabotage upsert n a rien remplace').not.toEqual(source);
    expect(codeOnly(retourUpdate)).not.toContain('.upsert(');

    // ── 4. La clé d'idempotence retirée ─────────────────────────────
    const sansIdempotence = source.replace('idempotencyKey: `customer:${user.id}`', '');
    expect(sansIdempotence, 'le sabotage idempotence n a rien remplace').not.toEqual(source);
    expect(codeOnly(sansIdempotence)).not.toContain('idempotencyKey: `customer:${user.id}`');
  });
});
