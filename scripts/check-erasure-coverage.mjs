// ═══════════════════════════════════════════════════════════════════
// C-92 — la garde d'effacement s'appuyait sur une LISTE EN DUR
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. `src/rgpd-erasure.guard.test.ts` vérifie que trois tables
// SYMÉTRIQUES sont purgées sur leurs deux colonnes. C'est juste, et c'est
// étroit : la liste est écrite à la main, et rien ne relie une table NEUVE
// portant `user_id` à `delete-account` ni au registre de l'article 30.
//
// Une migration peut donc créer une table de données personnelles sans
// qu'aucun job ne demande ce qu'il advient de ces lignes à la suppression du
// compte. Le symptôme est silencieux : la suppression réussit, l'utilisateur
// reçoit sa confirmation, et ses données restent.
//
// CE QUE CETTE GARDE FAIT : elle DÉRIVE le périmètre du schéma — les
// migrations du dépôt — au lieu de le recopier, et exige une décision écrite
// pour CHAQUE table portant `user_id`. Quatre décisions possibles, et une
// seule par table :
//
//   · `purge`      — la table est dans `USER_OWNED_TABLES` de
//                    `delete-account`, donc vidée explicitement ;
//   · `symetrique` — le compte peut y figurer dans DEUX colonnes, elle est
//                    purgée à part (c'est ce que garde `rgpd-erasure`) ;
//   · `cascade`    — `user_id` référence `auth.users(id) ON DELETE CASCADE`,
//                    donc Postgres s'en charge. 🔴 CETTE DÉCLARATION EST
//                    VÉRIFIÉE contre la migration : on ne croit personne sur
//                    parole. Une table déclarée `cascade` sans la clause
//                    fait échouer la garde ;
//   · `conserve`   — obligation légale de conservation, avec sa référence.
//                    🔴 Vérifiée AUSSI, et dans l'autre sens : une table
//                    déclarée conservée qui porte un `ON DELETE CASCADE` ne
//                    conserve rien du tout, et la déclaration serait un
//                    mensonge à un contrôleur.
//
// ── POURQUOI LES MIGRATIONS ET PAS `information_schema` ─────────────
//
// L'énoncé de C-92 demande de dériver du schéma. `information_schema` exige
// une connexion à la base, donc un secret, donc une garde qui ne peut pas
// tourner sur une PR — c'est-à-dire au moment où la table est créée. Les
// migrations du dépôt sont la seule description du schéma disponible AVANT
// l'application.
//
// ⚠️ Et elles ne suffisent pas toujours : le dépôt a déjà constaté que la
// base contient des objets qu'aucune migration ne crée (mémoire « migrations
// non auto-suffisantes » : table `subscriptions` et trois colonnes). Le
// recoupement avec la base reste donc un geste, et il est nommé comme tel
// plutôt que prétendu couvert.
//
// ❌ NE JAMAIS AJOUTER UNE TABLE À `DECISIONS` SANS AVOIR RÉPONDU À LA
//    QUESTION. Le but n'est pas que la garde passe, c'est qu'un humain ait
//    écrit, une fois, ce qu'il advient de ces lignes.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const MIGRATIONS = join(RACINE, 'supabase', 'migration');
const DELETE_ACCOUNT = join(RACINE, 'supabase', 'functions', 'delete-account', 'index.ts');

/**
 * La décision d'effacement, table par table.
 *
 * Mesuré le 2026-09-20 : 22 tables du dépôt portent une colonne `user_id`.
 * Vingt cascadent, deux sont conservées par obligation légale.
 */
const DECISIONS = {
  // ── Purgées explicitement par `delete-account` ──────────────────
  // Elles cascadent AUSSI (toutes portent la clause), mais la purge
  // explicite reste : `auth.admin.deleteUser` peut échouer après que les
  // lignes applicatives ont été supprimées, et l'ordre inverse laisserait
  // des données derrière un compte déjà parti.
  kr_completions: { decision: 'purge' },
  key_results: { decision: 'purge' },
  okrs: { decision: 'purge' },
  tasks: { decision: 'purge' },
  habits: { decision: 'purge' },
  events: { decision: 'purge' },
  categories: { decision: 'purge' },
  lists: { decision: 'purge' },
  subscriptions: { decision: 'purge' },

  // ── Symétriques : le compte y figure dans DEUX colonnes ─────────
  friends: { decision: 'symetrique' },
  friend_requests: { decision: 'symetrique' },

  // ── Effacées par Postgres, clause vérifiée ci-dessous ───────────
  admin_users: { decision: 'cascade' },
  email_lookup_quota: { decision: 'cascade' },
  org_member_permissions: { decision: 'cascade' },
  org_notifications: { decision: 'cascade' },
  org_team_members: { decision: 'cascade' },
  organization_join_requests: { decision: 'cascade' },
  organization_members: { decision: 'cascade' },
  task_dependencies: { decision: 'cascade' },
  user_activity_days: { decision: 'cascade' },

  // ── Conservées, par obligation légale ───────────────────────────
  payment_records: {
    decision: 'conserve',
    raison:
      "Journal d'encaissement inaltérable (mig. 125, CGI art. 286-I-3° bis). Le "
      + "droit à l'effacement cède devant l'obligation de conservation "
      + '(RGPD art. 17.3.b). 🔴 La ligne n\'est NI supprimée NI anonymisée : '
      + '`row_hash` scelle `user_id` dans le chaînage et `verify_payment_chain()` '
      + 'recalcule chaque hash depuis les colonnes, donc écrire NULL casserait la '
      + "chaîne et produirait le signal de falsification qu'on montre à un "
      + "contrôleur. Ce qui rend la conservation acceptable est ailleurs : "
      + "`user_id` cesse d'identifier quiconque dès que la ligne `auth.users` "
      + 'disparaît. `delete-account` ne touche donc PAS cette table.',
  },
  withdrawal_consents: {
    decision: 'conserve',
    raison:
      "Preuve du consentement à l'exécution immédiate et de la renonciation au "
      + 'droit de rétractation (Conso. art. L221-28). C\'est la pièce qu\'on produit '
      + 'si un client conteste. Table append-only, protégée par trigger (mig. 138).',
  },
};

// ── Lecture du schéma ──────────────────────────────────────────────

/**
 * Les tables portant `user_id`, dérivées des migrations.
 *
 * Rend `nom → { fichier, ligne }` où `ligne` est la définition de colonne,
 * qui porte (ou non) la clause `ON DELETE CASCADE`.
 */
export function tablesAvecUserId(dossier = MIGRATIONS) {
  const out = new Map();
  if (!existsSync(dossier)) return out;
  for (const f of readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dossier, f), 'utf8');
    for (const m of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\s*\);/gi,
    )) {
      const [, nom, corps] = m;
      const ligne = corps.split('\n').find((l) => /^\s*user_id\b/i.test(l));
      if (ligne) out.set(nom, { fichier: f, ligne: ligne.trim() });
    }
    for (const m of sql.matchAll(
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_0-9]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?(user_id\b[^;]*)/gi,
    )) {
      if (!out.has(m[1])) out.set(m[1], { fichier: f, ligne: m[2].trim() });
    }
  }
  return out;
}

/** La clause de cascade est-elle présente sur cette définition de colonne ? */
export function cascadeProuvee(ligne) {
  return /REFERENCES\s+auth\.users\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i.test(ligne);
}

/** Les tables vidées explicitement par `delete-account`. */
export function tablesPurgees(chemin = DELETE_ACCOUNT) {
  const src = readFileSync(chemin, 'utf8');
  const bloc = /const USER_OWNED_TABLES = \[([\s\S]*?)\] as const/.exec(src);
  if (!bloc) return null;
  return new Set([...bloc[1].matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]));
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const tables = tablesAvecUserId();
  const purgees = tablesPurgees();
  const erreurs = [];

  // 🔴 Le contrôle anti-« garde qui répond sans mesurer ». Si l'extraction
  // rend zéro table, ou si le bloc `USER_OWNED_TABLES` n'est plus trouvé,
  // toutes les comparaisons ci-dessous seraient vides et la garde verte.
  if (tables.size < 15) {
    erreurs.push(
      `Seulement ${tables.size} table(s) portant \`user_id\` extraite(s) des migrations : `
        + "l'extraction est cassée, et ce contrôle ne compare rien.",
    );
  }
  if (purgees === null) {
    erreurs.push(
      'Bloc `USER_OWNED_TABLES` introuvable dans delete-account : la fonction a été '
        + 'restructurée, et cette garde ne sait plus lire ce qu\'elle purge.',
    );
  }

  for (const [table, { fichier, ligne }] of [...tables].sort()) {
    const d = DECISIONS[table];
    if (!d) {
      erreurs.push(
        `\`${table}\` porte une colonne \`user_id\` (${fichier}) et AUCUNE décision\n`
          + "    d'effacement n'est écrite.\n"
          + "    Que devient une ligne de cette table quand le compte est supprimé ?\n"
          + '    Répondre dans DECISIONS : `purge`, `symetrique`, `cascade` ou\n'
          + '    `conserve` (avec sa référence légale). RGPD art. 17.',
      );
      continue;
    }
    if (d.decision === 'cascade' && !cascadeProuvee(ligne)) {
      erreurs.push(
        `\`${table}\` est déclarée \`cascade\` mais sa colonne ne porte PAS\n`
          + `    \`REFERENCES auth.users(id) ON DELETE CASCADE\` (${fichier}) :\n`
          + `      ${ligne}\n`
          + "    La déclaration affirme que Postgres efface ces lignes. Il ne le fait pas.",
      );
    }
    if (d.decision === 'conserve') {
      if (!d.raison) {
        erreurs.push(`\`${table}\` est déclarée \`conserve\` sans référence légale écrite.`);
      }
      if (cascadeProuvee(ligne)) {
        erreurs.push(
          `\`${table}\` est déclarée CONSERVÉE et porte pourtant\n`
            + '    `ON DELETE CASCADE` : la ligne disparaît avec le compte, donc la\n'
            + "    conservation annoncée n'existe pas. Les deux ne peuvent pas être vraies,\n"
            + "    et c'est celle-ci qu'on produirait en contrôle.",
        );
      }
    }
    if (d.decision === 'purge' && purgees && !purgees.has(table)) {
      erreurs.push(
        `\`${table}\` est déclarée \`purge\` mais n'est pas dans \`USER_OWNED_TABLES\`\n`
          + '    de delete-account : la décision écrite et le code ne disent pas la même chose.',
      );
    }
  }

  // Une décision pour une table qui n'existe plus décrit un état périmé.
  for (const table of Object.keys(DECISIONS)) {
    if (!tables.has(table)) {
      erreurs.push(
        `\`${table}\` a une décision d'effacement mais aucune migration ne lui donne de\n`
          + '    colonne `user_id` : retirer l\'entrée, ou vérifier qu\'elle n\'a pas été renommée.',
      );
    }
  }

  // Le code purge-t-il une table qu'aucune décision ne couvre ?
  if (purgees) {
    for (const table of purgees) {
      if (!DECISIONS[table]) {
        erreurs.push(
          `delete-account purge \`${table}\`, qui n'a aucune décision écrite ici.`,
        );
      }
    }
  }

  const parDecision = {};
  for (const t of tables.keys()) {
    const d = DECISIONS[t]?.decision ?? 'AUCUNE';
    parDecision[d] = (parDecision[d] ?? 0) + 1;
  }
  console.log('Effacement de compte · périmètre DÉRIVÉ des migrations (RGPD art. 17)');
  console.log(`  tables portant \`user_id\` : ${tables.size}`);
  for (const [d, n] of Object.entries(parDecision).sort()) console.log(`    ${d.padEnd(12)} ${n}`);
  console.log(`  purgées explicitement par delete-account : ${purgees ? purgees.size : '—'}`);
  console.log(
    '⚠️ Dérivé des MIGRATIONS, pas de la base. Le dépôt a déjà constaté des objets\n'
      + '   en base qu\'aucune migration ne crée : le recoupement reste un geste.',
  );

  if (erreurs.length > 0) {
    console.error('\n✖ Effacement de compte :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Chaque table portant `user_id` a une décision d effacement écrite et vérifiée.');
}
