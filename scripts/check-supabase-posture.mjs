// ═══════════════════════════════════════════════════════════════════
// C-88 — les advisors Supabase et les réglages du Dashboard ne sont lus
// par AUCUN job
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 DEUX ANGLES MORTS, ET ILS SE RESSEMBLENT.
//
// 1. LES ADVISORS. C'est la seule source qui voie une policy manquante ou une
//    fonction `SECURITY DEFINER` exposée APRÈS COUP — c'est-à-dire les
//    régressions qu'aucune garde statique du dépôt ne peut voir, parce
//    qu'elles naissent d'un état de la base et non d'une ligne de code. Dans
//    `ci.yml`, le mot « advisor » désigne en réalité `npm audit`. Les
//    chiffres `9 / 52 / 2 / 1` du 2026-09-14 ont été relevés À LA MAIN.
//
// 2. LES RÉGLAGES D'AUTH vivent HORS DU DÉPÔT. Protection contre les mots de
//    passe compromis, expiration des OTP, rotation des jetons : ils se
//    modifient en deux clics, sans commit et sans trace. Plusieurs sont
//    cochés ✅ dans `POST-AUDIT-GUIDE.md`, et 🔴 un ✅ daté décrit un
//    INSTANT, pas un état.
//
// ── COMMENT CETTE GARDE JUGE ────────────────────────────────────────
//
// Sur un ÉCART à une référence COMMITÉE, jamais sur une valeur absolue. Le
// dépôt compte aujourd'hui 52 fonctions `SECURITY DEFINER` exposées à
// `authenticated`, et c'est un choix d'architecture (les helpers RLS en sont)
// — exiger zéro rendrait la garde rouge en permanence, donc ignorée. Ce qui
// doit alerter est la 53ᵉ, ou une policy qui disparaît.
//
// ⚠️ LES ADVISORS DE PERFORMANCE SONT IMPRIMÉS, PAS BLOQUANTS. Ils bougent
// avec le VOLUME de données (un index « inutilisé » le devient dès qu'une
// table grossit) : les gater produirait un rouge que personne ne pourrait
// tenir. La perte de performance, elle, a ses propres gardes (C-87).
//
// ❌ NE JAMAIS RELEVER UN COMPTE DE RÉFÉRENCE POUR FAIRE PASSER LA CI. Un
//    écart dit qu'un objet est apparu, et la question est ce qu'il est. Le
//    recaler se fait APRÈS avoir répondu, par `--update`.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const REFERENCE = join(RACINE, 'scripts', 'supabase-posture.reference.json');
const PROJET_DEFAUT = 'ykeugqfgklejcdbrmawy';

/**
 * Les réglages d'authentification surveillés, et pourquoi chacun compte.
 *
 * ⚠️ Cette liste est le PÉRIMÈTRE, pas la valeur attendue : les valeurs
 * vivent dans la référence commitée. Un réglage absent de la réponse de
 * l'API est signalé — il a pu être renommé, et une garde qui compare une clé
 * inexistante à une autre clé inexistante est toujours verte.
 */
export const REGLAGES_SURVEILLES = {
  password_hibp_enabled:
    "Protection contre les mots de passe compromis (HaveIBeenPwned). Désactivée "
    + 'au 2026-09-20, et c est un advisor WARN à part entière.',
  mailer_otp_exp: "Durée de validité d'un code envoyé par e-mail. Un OTP qui vit trop longtemps est un mot de passe.",
  security_update_password_require_reauthentication:
    'Ré-authentification exigée pour changer de mot de passe. Sans elle, une session volée suffit à prendre le compte.',
  refresh_token_rotation_enabled: 'Rotation des jetons de rafraîchissement.',
  security_refresh_token_reuse_interval: 'Fenêtre de tolérance au rejeu d un jeton déjà utilisé.',
  mfa_totp_enroll_enabled: "Enrôlement TOTP. La console `/admin` en dépend (mig. 131, exigence `aal2`).",
  mfa_totp_verify_enabled: 'Vérification TOTP, même dépendance.',
  external_google_enabled: 'Connexion Google. Sa disparition casserait un parcours entier.',
  disable_signup: "Inscriptions ouvertes. Une désactivation accidentelle est invisible depuis le produit — l'écran s'affiche.",
};

/** Appel GET sur l'API Management. */
async function api(chemin, { token, fetchImpl = fetch }) {
  const res = await fetchImpl(`https://api.supabase.com/v1${chemin}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GET ${chemin} → HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

/** Les advisors, réduits à `{ nom → { niveau, compte } }`. */
export function resumerAdvisors(reponse) {
  const out = {};
  for (const l of reponse?.lints ?? []) {
    out[l.name] = { niveau: l.level, compte: l.count ?? (l.findings?.length ?? 0) };
  }
  return out;
}

/** Compare deux résumés d'advisors. Rend la liste des écarts. */
export function comparerAdvisors(reference, mesure) {
  const ecarts = [];
  for (const [nom, m] of Object.entries(mesure)) {
    const r = reference[nom];
    if (!r) {
      ecarts.push(
        `advisor NOUVEAU : \`${nom}\` (${m.niveau}, ${m.compte} occurrence(s)). `
          + "Il n'existait pas à la dernière référence.",
      );
      continue;
    }
    if (m.compte > r.compte) {
      ecarts.push(
        `\`${nom}\` : ${m.compte} occurrence(s) contre ${r.compte} à la référence (+${m.compte - r.compte}).`,
      );
    }
    if (m.niveau !== r.niveau) {
      ecarts.push(`\`${nom}\` : niveau ${m.niveau} contre ${r.niveau} à la référence.`);
    }
  }
  // Une baisse n'est pas un échec — c'est une amélioration à enregistrer.
  const baisses = [];
  for (const [nom, r] of Object.entries(reference)) {
    const m = mesure[nom];
    if (!m) baisses.push(`\`${nom}\` a DISPARU (était ${r.compte}) — recaler la référence.`);
    else if (m.compte < r.compte) baisses.push(`\`${nom}\` : ${m.compte} contre ${r.compte} — recaler la référence.`);
  }
  return { ecarts, baisses };
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projet = process.env.SUPABASE_PROJECT_REF || PROJET_DEFAUT;

  // 🔴 Pas de repli. Sans jeton cette garde ne lit rien, et un run vert
  // affirmerait que la posture est inchangée sans l'avoir regardée.
  if (!token) {
    console.error(
      '✖ SUPABASE_ACCESS_TOKEN absent. Cette garde lit les advisors et les\n'
        + '  réglages d authentification du projet : sans jeton elle ne mesure rien.\n'
        + '  Le secret existe déjà au dépôt (il sert à `check:edge`).',
    );
    process.exit(1);
  }

  const securite = resumerAdvisors(await api(`/projects/${projet}/advisors/security`, { token }));
  const performance = resumerAdvisors(await api(`/projects/${projet}/advisors/performance`, { token }));
  const auth = await api(`/projects/${projet}/config/auth`, { token });

  const reglages = {};
  const introuvables = [];
  for (const cle of Object.keys(REGLAGES_SURVEILLES)) {
    if (cle in auth) reglages[cle] = auth[cle];
    else introuvables.push(cle);
  }

  if (process.argv.includes('--update')) {
    const contenu = {
      _comment: [
        'C-88 — référence de POSTURE Supabase : advisors de sécurité et réglages',
        "d'authentification. Écrite par `node scripts/check-supabase-posture.mjs --update`,",
        'jamais à la main.',
        '🔴 La garde juge sur un ÉCART à ces valeurs, pas sur un absolu : les 52',
        'fonctions SECURITY DEFINER exposées à `authenticated` sont un choix',
        "d'architecture (les helpers RLS en sont). Ce qui doit alerter est la 53e.",
        '❌ Ne jamais relever un compte ici pour faire passer la CI : répondre',
        "d'abord à la question « quel objet est apparu ? ».",
      ],
      pose_le: new Date().toISOString().slice(0, 10),
      securite,
      reglages_auth: reglages,
    };
    writeFileSync(REFERENCE, `${JSON.stringify(contenu, null, 2)}\n`, 'utf8');
    console.log(`✓ Référence recalée : ${Object.keys(securite).length} advisor(s), ${Object.keys(reglages).length} réglage(s).`);
    process.exit(0);
  }

  if (!existsSync(REFERENCE)) {
    console.error(
      `✖ ${REFERENCE} absent. Poser la référence une première fois :\n`
        + '    SUPABASE_ACCESS_TOKEN=… node scripts/check-supabase-posture.mjs --update\n'
        + '  puis la COMMITER. Sans référence commitée, il n y a rien à comparer.',
    );
    process.exit(1);
  }

  const reference = JSON.parse(readFileSync(REFERENCE, 'utf8'));
  const erreurs = [];

  // ── 1. Les advisors de SÉCURITÉ ─────────────────────────────────
  if (Object.keys(securite).length === 0) {
    erreurs.push(
      "L'API n'a rendu AUCUN advisor de sécurité. Zéro est une réponse possible, "
        + 'mais c est aussi ce que rend un point d accès renommé : le distinguer '
        + 'demande de regarder, et cette garde refuse de conclure dessus.',
    );
  }
  const { ecarts, baisses } = comparerAdvisors(reference.securite ?? {}, securite);
  erreurs.push(...ecarts);

  console.log('Posture Supabase · advisors de SÉCURITÉ');
  for (const [nom, m] of Object.entries(securite).sort()) {
    const r = reference.securite?.[nom];
    const delta = r ? m.compte - r.compte : null;
    console.log(
      `  ${m.niveau.padEnd(5)} ${nom.padEnd(52)} ${String(m.compte).padStart(3)}`
        + (delta === null ? '  (NOUVEAU)' : delta === 0 ? '' : `  (${delta > 0 ? '+' : ''}${delta})`),
    );
  }

  // ── 2. Les advisors de PERFORMANCE, imprimés ────────────────────
  console.log('\nPosture Supabase · advisors de PERFORMANCE (imprimés, non bloquants)');
  for (const [nom, m] of Object.entries(performance).sort()) {
    console.log(`  ${m.niveau.padEnd(5)} ${nom.padEnd(52)} ${String(m.compte).padStart(3)}`);
  }

  // ── 3. Les réglages d'authentification ──────────────────────────
  //
  // 🔴 `reglages_auth: null` = référence JAMAIS POSÉE. Un seul message, une
  // seule commande. La garde ÉCHOUE plutôt que de rendre un « ✓ » qui ne
  // couvrirait que les advisors : c'est exactement la garde à moitié aveugle
  // qu'`uptime.yml` a été jusqu'au 2026-09-02, et son vert signifiait « on
  // n'a rien su de l'autre moitié ».
  console.log('\nPosture Supabase · réglages d authentification');
  if (reference.reglages_auth === null || reference.reglages_auth === undefined) {
    for (const [cle, valeur] of Object.entries(reglages)) {
      console.log(`  ${cle.padEnd(52)} ${JSON.stringify(valeur)}`);
    }
    erreurs.push(
      'RÉFÉRENCE DES RÉGLAGES D AUTH NON POSÉE. Les valeurs lues ci-dessus ne sont\n'
        + '    comparées à rien, donc un changement fait hors du dépôt passerait.\n'
        + '    La poser UNE fois, puis committer le fichier :\n'
        + '      SUPABASE_ACCESS_TOKEN=… node scripts/check-supabase-posture.mjs --update',
    );
  }
  for (const [cle, valeur] of Object.entries(reference.reglages_auth ? reglages : {})) {
    const attendue = reference.reglages_auth?.[cle];
    const meme = JSON.stringify(valeur) === JSON.stringify(attendue);
    console.log(`  ${cle.padEnd(52)} ${JSON.stringify(valeur)}${meme ? '' : `  ← référence ${JSON.stringify(attendue)}`}`);
    if (!(cle in (reference.reglages_auth ?? {}))) {
      erreurs.push(`\`${cle}\` n'est pas dans la référence : la recaler par \`--update\`.`);
    } else if (!meme) {
      erreurs.push(
        `\`${cle}\` a changé HORS DU DÉPÔT : ${JSON.stringify(attendue)} → ${JSON.stringify(valeur)}.\n`
          + `    ${REGLAGES_SURVEILLES[cle]}\n`
          + '    Ce réglage se modifie en deux clics dans le Dashboard, sans commit et\n'
          + '    sans trace : cette ligne est la seule trace.',
      );
    }
  }
  if (introuvables.length > 0) {
    erreurs.push(
      `${introuvables.length} réglage(s) surveillé(s) ABSENT(S) de la réponse de l'API : `
        + `${introuvables.join(', ')}.\n`
        + '    Une garde qui compare une clé inexistante à une autre clé inexistante\n'
        + '    est toujours verte. Supabase a probablement renommé le champ.',
    );
  }

  if (baisses.length > 0) {
    console.log('\n🔎 Améliorations non enregistrées (la garde ne rougit pas dessus) :');
    for (const b of baisses) console.log(`  - ${b}`);
  }

  console.log(
    `\nRéférence posée le ${reference.pose_le}.`
      + '\n⚠️ La garde juge un ÉCART, pas un absolu. Un « 0 écart » ne veut pas dire'
      + '\n   « 0 problème » : il veut dire « rien de nouveau depuis la référence ».',
  );

  if (erreurs.length > 0) {
    console.error('\n✖ Posture Supabase :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Aucun écart à la référence.');
}
