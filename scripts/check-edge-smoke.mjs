// ═══════════════════════════════════════════════════════════════════
// C-91 — `check:edge` compare le CODE déployé, jamais le COMPORTEMENT
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. `scripts/check-edge-deploy.mjs` relit les sources en ligne et
// les compare au dépôt. C'est la garde qui a trouvé trois divergences le
// 2026-09-03, et elle vaut ce qu'elle vaut — mais elle compare du TEXTE. Une
// fonction identique au dépôt reste verte alors que :
//   · un SECRET a changé de valeur ou disparu (`RESEND_API_KEY`,
//     `CRON_SECRET`, `STRIPE_SECRET_KEY`) — le code est le même, la fonction
//     répond 503 à tout le monde ;
//   · une dépendance distante a bougé (`npm:stripe@…`, `https://deno.land/…`)
//     et la fonction ne démarre plus ;
//   · le déploiement a échoué et c'est une version ANTÉRIEURE qui répond.
//
// Le motif de la sonde existe déjà : il a été joué À LA MAIN pour
// `stripe-org-refund` (un `405` puis un `401` ÉMIS PAR LE CORPS de la
// fonction). Ce script l'automatise pour les huit.
//
// ── LE POINT QUI DÉCIDE DE TOUT : `401` PLATEFORME ≠ `401` FONCTION ──
//
// 🔴 Supabase place un contrôle `verify_jwt` DEVANT la fonction. Sans
// `Authorization`, la plateforme rend un 401 SANS JAMAIS EXÉCUTER UNE LIGNE
// du code déployé. Une sonde qui se contenterait de ce 401 vérifierait que
// Supabase est debout, pas que notre fonction l'est — exactement la classe
// « la garde répond sans mesurer » de `scripts/CLAUDE.md`.
//
// La sonde envoie donc la clé ANON (publique, déjà dans le bundle client),
// ce qui fait passer `verify_jwt`, puis vérifie une réponse que SEUL LE CORPS
// de la fonction peut produire : un code ET un marqueur de contenu.
//
// ── CE QUE ÇA NE PROUVE PAS ─────────────────────────────────────────
//
// ⚠️ Que la fonction fait son travail. On touche ses tout premiers mètres :
// le module se charge, le routage de méthode marche, le corps répond. Un
// remboursement Stripe cassé plus loin resterait invisible ici.
// ⚠️ Aucune de ces sondes n'écrit quoi que ce soit, et c'est vérifié par
// construction : toutes visent une branche de REFUS. `stripe-webhook` est la
// seule appelée en POST, et seulement pour se faire refuser sa signature.
//
// ❌ NE JAMAIS AJOUTER UNE SONDE QUI PASSE L'AUTHENTIFICATION MÉTIER. Une
//    sonde qui irait plus loin finirait par écrire en production.
// ═══════════════════════════════════════════════════════════════════

import { sep } from 'node:path';

/** Le projet de production. Publique : elle est dans le bundle client. */
const URL_DEFAUT = 'https://ykeugqfgklejcdbrmawy.supabase.co';
const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';

/**
 * 🔴 C-114 · La clé anon lue par l'API Management, avec le jeton déjà posé.
 *
 * La sonde n'a JAMAIS sondé en CI depuis sa pose (2026-09-20) : le workflow
 * lisait `secrets.VITE_SUPABASE_ANON_KEY`, un secret qui n'existe pas au
 * dépôt (relu le 2026-09-24 : seuls `CRON_SECRET`, `OPS_ALERT_WEBHOOK_URL`,
 * `SUPABASE_ACCESS_TOKEN` et `SUPABASE_DB_URL` y sont). La clé anon est
 * publique, elle est dans le bundle : la redemander à un humain ne protège
 * rien. On la lit donc là où elle fait foi, par le jeton qui sert déjà à
 * `check:edge`. Une clé fournie explicitement reste prioritaire.
 */
export async function cleAnonDepuisApi({ token, projet = PROJET_DEFAUT, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${projet}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`API Management : ${res.status} en lisant les clés du projet ${projet}`);
  }
  const cles = await res.json();
  const anon = Array.isArray(cles) ? cles.find((c) => c.name === 'anon') : null;
  if (!anon?.api_key) {
    throw new Error("API Management : aucune clé nommée « anon » dans la réponse");
  }
  return anon.api_key;
}

/**
 * LES SONDES.
 *
 * `methode` / `entetes` / `corps` : la requête.
 * `statut`   : le ou les codes acceptables.
 * `marqueur` : une chaîne que SEUL le corps de la fonction produit. C'est
 *              elle qui distingue « la fonction répond » de « Supabase
 *              répond à sa place ».
 * `prouve`   : ce qu'on apprend quand la sonde passe.
 */
export const SONDES = [
  {
    fonction: 'delete-account',
    methode: 'GET',
    statut: [405],
    marqueur: 'Method not allowed',
    prouve:
      'Le module se charge et son routage de méthode s\'exécute. Cette fonction '
      + 'SUPPRIME un compte : on ne la sonde jamais en POST.',
  },
  {
    fonction: 'report-bug',
    methode: 'GET',
    statut: [405],
    marqueur: 'method_not_allowed',
    prouve: 'Le module se charge. Aucun e-mail n\'est envoyé sur cette branche.',
  },
  {
    fonction: 'stripe-create-checkout',
    methode: 'OPTIONS',
    statut: [200],
    marqueur: 'ok',
    prouve:
      'Le préflight CORS est calculé par le corps de la fonction '
      + '(`corsHeadersFor`), donc le module est chargé et son allowlist évaluée.',
  },
  {
    fonction: 'stripe-org-checkout',
    methode: 'POST',
    corps: '{}',
    statut: [400, 401],
    marqueur: 'bad_request|Unauthorized',
    prouve:
      'Le corps refuse une requête sans organisation AVANT tout appel Stripe : '
      + 'rien n\'est créé, rien n\'est débité.',
  },
  {
    fonction: 'stripe-org-portal',
    methode: 'POST',
    corps: '{}',
    statut: [400, 401],
    marqueur: 'bad_request|Unauthorized',
    prouve: 'Le corps valide son entrée avant de parler à Stripe.',
  },
  {
    fonction: 'stripe-org-refund',
    methode: 'GET',
    statut: [405],
    marqueur: 'method_not_allowed',
    prouve:
      'La sonde d\'origine de C-91, celle qui avait été jouée à la main. '
      + 'Cette fonction REMBOURSE : jamais en POST.',
  },
  {
    fonction: 'stripe-webhook',
    methode: 'POST',
    corps: '{}',
    statut: [400],
    marqueur: 'Invalid signature',
    prouve:
      'La vérification de signature Stripe s\'exécute et REFUSE. C\'est la '
      + 'garde la plus importante de cette fonction : sans elle, n\'importe qui '
      + 'lui déclare un paiement.',
  },
  {
    fonction: 'renewal-notice',
    methode: 'POST',
    corps: '{}',
    statut: [401, 503],
    marqueur: 'unauthorized|cron_secret_not_configured',
    prouve:
      "La garde `x-cron-secret` s'exécute et refuse. 🔴 `503 "
      + "cron_secret_not_configured` est ACCEPTÉ et c'est volontaire : il "
      + 'signifie que le secret est absent, donc que la fonction refuse TOUT — '
      + "la bonne réponse. C'est le contraire du motif « on ne se protège que "
      + 'quand on est déjà protégé », et le distinguer du 401 est utile.',
  },
];

/** Joue une sonde. Rend `{ ok, statut, extrait, raison }`. */
export async function jouer(sonde, { base, anon, fetchImpl = fetch }) {
  const url = `${base}/functions/v1/${sonde.fonction}`;
  let res;
  let texte = '';
  try {
    res = await fetchImpl(url, {
      method: sonde.methode,
      headers: {
        // 🔴 La clé ANON, publique. Sans elle, `verify_jwt` refuse AVANT la
        // fonction et la sonde mesurerait Supabase, pas notre code.
        Authorization: `Bearer ${anon}`,
        apikey: anon,
        ...(sonde.corps ? { 'Content-Type': 'application/json' } : {}),
        ...(sonde.entetes ?? {}),
      },
      body: sonde.corps,
    });
    texte = await res.text();
  } catch (e) {
    return { ok: false, statut: 0, extrait: '', raison: `injoignable : ${e.message}` };
  }

  const extrait = texte.slice(0, 160).replace(/\s+/g, ' ');
  if (!sonde.statut.includes(res.status)) {
    return {
      ok: false,
      statut: res.status,
      extrait,
      raison: `statut ${res.status}, attendu ${sonde.statut.join(' ou ')}`,
    };
  }
  const re = new RegExp(sonde.marqueur);
  if (!re.test(texte)) {
    return {
      ok: false,
      statut: res.status,
      extrait,
      raison:
        `le code est bon mais le corps ne contient pas \`${sonde.marqueur}\` : `
        + 'la réponse ne vient pas de la fonction (plateforme, proxy, ou version '
        + 'antérieure déployée).',
    };
  }
  return { ok: true, statut: res.status, extrait, raison: '' };
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const base = (process.env.SUPABASE_URL || URL_DEFAUT).replace(/\/+$/, '');
  let anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!anon && process.env.SUPABASE_ACCESS_TOKEN) {
    anon = await cleAnonDepuisApi({
      token: process.env.SUPABASE_ACCESS_TOKEN,
      projet: process.env.SUPABASE_PROJECT_REF || PROJET_DEFAUT,
    });
    console.log('Clé anon lue par l API Management (aucune clé fournie).');
  }

  // 🔴 Pas de repli silencieux. La clé anon est PUBLIQUE, mais elle n'est pas
  // dans le dépôt : sans elle, toutes les sondes se feraient refuser par
  // `verify_jwt` et la garde mesurerait la plateforme. Un secret absent se
  // solde par un échec, jamais par un avertissement dans un run vert.
  if (!anon) {
    console.error(
      '✖ SUPABASE_ANON_KEY absente. Sans elle, `verify_jwt` refuse AVANT la\n'
        + '  fonction : la sonde mesurerait Supabase et non le code déployé.\n'
        + '  Cette clé est publique (elle est dans le bundle client) ; elle est\n'
        + '  passée par `SUPABASE_ANON_KEY`, ou lue par l API Management quand\n'
        + '  `SUPABASE_ACCESS_TOKEN` est posé.',
    );
    process.exit(1);
  }

  console.log(`Sondes de fumée des Edge Functions · ${base}`);
  const echecs = [];
  for (const sonde of SONDES) {
    const r = await jouer(sonde, { base, anon });
    console.log(
      `  ${sonde.fonction.padEnd(24)} ${sonde.methode.padEnd(7)} → `
        + `${String(r.statut).padStart(3)}  ${r.ok ? '✓' : '✖'}  ${r.extrait}`,
    );
    if (!r.ok) echecs.push({ sonde, r });
  }

  console.log(
    `\n${SONDES.length} sonde(s) sur ${SONDES.length} fonction(s).`
      + '\n⚠️ Ce que ça prouve : le module se charge et son corps répond. PAS que la'
      + '\n   fonction fait son travail — un remboursement cassé plus loin reste'
      + '\n   invisible ici.',
  );

  if (echecs.length > 0) {
    console.error('\n✖ Comportement déployé :');
    for (const { sonde, r } of echecs) {
      console.error(
        `  - ${sonde.fonction} (${sonde.methode}) : ${r.raison}\n`
          + `      ce que la sonde prouve d'habitude : ${sonde.prouve}\n`
          + `      réponse : ${r.extrait || '(vide)'}`,
      );
    }
    process.exit(1);
  }
  console.log('\n✓ Les huit fonctions déployées répondent depuis leur propre corps.');
}
