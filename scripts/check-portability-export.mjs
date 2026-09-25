// ═══════════════════════════════════════════════════════════════════
// C-94 — l'export de portabilité (art. 20) n'est comparé à AUCUN inventaire
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT. Une colonne ajoutée à une table exportée n'entre pas dans
// l'export, et rien ne le signale. Le symptôme est le pire des trois de cette
// famille : l'export marche, le fichier se télécharge, il s'ouvre dans un
// tableur — et il lui manque une colonne que la personne a saisie.
//
// CE QUE CETTE GARDE FAIT : elle DÉRIVE les colonnes de chaque table exportée
// depuis les migrations, et exige que chacune soit, au choix :
//   · EXPORTÉE, en nommant l'en-tête sous lequel elle sort ;
//   · EXCLUE, avec sa raison écrite.
// Une colonne neuve n'a aucune des deux, donc la garde rougit.
//
// ⚠️ LE MOT « EXCLUSION LÉGITIME » EST PRIS AU SÉRIEUX. L'énoncé de C-94 le
// dit : des exclusions légitimes existent. Trois familles ici, et aucune
// n'est « ça n'intéresse personne » :
//   · DONNÉES DE TIERS (`pending_invites`, `collaborator_validations`) —
//     l'article 20 couvre les données de la personne, pas celles des autres.
//     Les exporter livrerait les adresses de ses collègues ;
//   · MÉTADONNÉES TECHNIQUES (`updated_at`, identifiants de série) — pas
//     « fournies par la personne concernée » au sens de l'article ;
//   · ÉTAT D'INTERFACE (`review_dismissed_at`) — une case fermée n'est pas
//     une donnée.
//
// ── CE QUE CETTE GARDE A TROUVÉ À SA POSE, le 2026-09-20 ────────────
//
// 🔴 TROIS colonnes SAISIES et absentes de l'export, toutes depuis longtemps :
//   · `habits.icon`          — l'icône choisie pour chaque habitude ;
//   · `categories.parent_id` — l'ARBRE des catégories (mig. 143). Sans lui
//     l'export rendait une liste plate : l'organisation était perdue ;
//   · `key_results.estimated_time` et `weight` — la durée estimée, qui porte
//     tout le temps investi sur les OKR (C-77), et la pondération choisie.
// Les quatre sont entrées dans l'export le même jour. Aucune n'avait été vue
// par une relecture ; c'est la confrontation au schéma qui les a nommées.
//
// ❌ NE JAMAIS DÉCLARER UNE COLONNE EXCLUE POUR FAIRE PASSER LA CI. La
//    question à se poser est celle de l'article 20 : « la personne
//    l'a-t-elle fournie ? » Si oui, elle s'exporte.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();
const MIGRATIONS = join(RACINE, 'supabase', 'migration');
const EXPORT = join(RACINE, 'src', 'lib', 'csv-export.ts');

/**
 * Les tables exportées, et le sort de CHACUNE de leurs colonnes.
 *
 * `exporte`  : colonne SQL → en-tête de l'export (clé du catalogue `csv`).
 * `exclu`    : colonne SQL → raison écrite.
 */
const EXPORTS = {
  tasks: {
    fonction: 'exportTasksCSV',
    exporte: {
      id: 'id',
      name: 'name',
      description: 'description',
      category: 'category',
      priority: 'priority',
      deadline: 'deadline',
      estimated_time: 'durationMin',
      recurrence: 'recurrence',
      subtasks: 'subtasks',
      kr_id: 'linkedKr',
      completed: 'completed',
      completed_at: 'completedAt',
      bookmarked: 'bookmarked',
      created_at: 'createdAt',
    },
    exclu: {
      user_id: "Identifiant interne du compte, pas une donnée fournie. Le fichier `profil` porte l'identité.",
      updated_at: 'Métadonnée technique (dernière écriture), pas une donnée fournie par la personne.',
      is_collaborative: "Dérivée : vraie dès qu'il y a un collaborateur, donc redondante avec une information qu'on n'exporte pas.",
      // ⚠️ `collaborators` N'EST PLUS ICI : la mig. 028 l'a SUPPRIMÉE (elle
      // dupliquait `shared_tasks` et pouvait produire un « partage
      // invisible »). Elle avait pourtant été déclarée exclue à l'écriture de
      // ce fichier, de mémoire — et c'est le contrôle de déclaration périmée
      // qui l'a signalée le jour même. Une liste écrite de tête décrit le
      // schéma qu'on croit avoir.
      pending_invites: 'Adresses e-mail de TIERS invités. Les exporter livrerait les coordonnées de tiers.',
      collaborator_validations: 'Décisions de TIERS sur une tâche partagée.',
      recurrence_parent_id: "Identifiant technique de la série de récurrence. La règle elle-même, elle, est exportée (`recurrence`).",
    },
  },
  habits: {
    fonction: 'exportHabitsCSV',
    exporte: {
      id: 'id',
      name: 'name',
      description: 'description',
      frequency: 'frequency',
      estimated_time: 'durationMin',
      color: 'color',
      icon: 'icon',
      completions: 'completions',
      created_at: 'createdAt',
    },
    exclu: {
      user_id: 'Identifiant interne du compte.',
      updated_at: 'Métadonnée technique.',
    },
  },
  events: {
    fonction: 'exportEventsCSV',
    exporte: {
      id: 'id',
      title: 'title',
      start_time: 'start',
      end_time: 'end',
      color: 'color',
      description: 'description',
      notes: 'notes',
      recurrence: 'recurrence',
      recurrence_days: 'recurrenceDays',
      exceptions: 'removedOccurrences',
      task_id: 'linkedTask',
      is_private: 'private',
    },
    exclu: {
      user_id: 'Identifiant interne du compte.',
      created_at: "Métadonnée technique. L'export d'un agenda porte les créneaux, pas la date de saisie.",
      updated_at: 'Métadonnée technique.',
      created_by: "Auteur en mode entreprise. En compte personnel c'est le compte lui-même ; en équipe, c'est un TIERS.",
      review_dismissed_at: "État d'interface (un encart refermé), pas une donnée fournie.",
    },
  },
  okrs: {
    fonction: 'exportOKRsCSV',
    exporte: {
      id: 'okrId',
      title: 'okrTitle',
      description: 'okrDescription',
      category: 'okrCategory',
      progress: 'okrProgress',
      start_date: 'okrStart',
      end_date: 'okrEnd',
    },
    exclu: {
      user_id: 'Identifiant interne du compte.',
      created_at: 'Métadonnée technique.',
      updated_at: 'Métadonnée technique.',
      completed: "Dérivée de la progression, qui est exportée (`okrProgress`).",
      key_results: "Colonne JSON héritée. Les résultats clés sont exportés depuis la table `key_results`, une ligne chacun — c'est la forme exploitable en tableur.",
    },
  },
  key_results: {
    fonction: 'exportOKRsCSV',
    exporte: {
      title: 'krTitle',
      current_value: 'krCurrent',
      target_value: 'krTarget',
      unit: 'krUnit',
      completed: 'krCompleted',
      estimated_time: 'krDurationMin',
      weight: 'krWeight',
    },
    exclu: {
      id: "Identifiant technique du résultat clé. Son OKR parent, lui, est exporté (`okrId`), et c'est ce qui rattache la ligne.",
      okr_id: 'Redondant avec `okrId`, déjà dénormalisé sur chaque ligne.',
      user_id: 'Identifiant interne du compte.',
      created_at: 'Métadonnée technique.',
      updated_at: 'Métadonnée technique.',
      completed_at: "Non saisi : posé par le produit à la complétion. Le journal `kr_completions` en porte la trace, et il n'est pas exporté (cf. plus bas).",
    },
  },
  categories: {
    fonction: 'exportCategoriesCSV',
    exporte: { id: 'id', name: 'name', color: 'color', parent_id: 'parent' },
    exclu: {
      user_id: 'Identifiant interne du compte.',
      created_at: 'Métadonnée technique.',
    },
  },
  lists: {
    fonction: 'exportListsCSV',
    exporte: {
      id: 'id',
      name: 'name',
      color: 'color',
      type: 'type',
      task_ids: 'taskCount',
    },
    exclu: {
      user_id: 'Identifiant interne du compte.',
      created_at: 'Métadonnée technique.',
      updated_at: 'Métadonnée technique.',
    },
  },
};

/**
 * Les tables de données personnelles qu'on n'exporte PAS DU TOUT, et pourquoi.
 *
 * ⚠️ Cette liste est le pendant de la précédente : sans elle, la garde ne
 * dirait rien d'une table entière absente de l'export, qui est pourtant le
 * plus gros trou possible.
 */
const TABLES_NON_EXPORTEES = {
  kr_completions: "Journal des complétions de résultats clés. Il alimente le temps investi (`workTimeCalculator`), qui est DÉRIVÉ et non fourni. ⚠️ Discutable : c'est la trace de QUAND le travail a été fait, et la même question s'était posée pour `completed_at` des tâches, ajoutée le 2026-09-02. À rouvrir si un export doit permettre de reconstituer l'historique.",
  task_dependencies: 'Liens entre tâches, saisis par la personne. ⚠️ Non exportés à ce jour : dette reconnue, pas une exclusion de principe (mig. 132, livrée le 2026-08-30).',
  friends: "Identifiants d'AUTRES personnes.",
  friend_requests: "Identifiants et adresses de TIERS.",
  subscriptions: "État d'abonnement, fourni par Stripe et non par la personne. Les pièces comptables relèvent de `payment_records`, conservé.",
  payment_records: "Journal fiscal inaltérable (CGI art. 286-I-3° bis). Les factures se réclament par le portail Stripe.",
  withdrawal_consents: 'Preuve du consentement (Conso. L221-28). Produite en litige, pas exportée en vrac.',
  user_activity_days: 'Compteur de présence agrégé, dérivé, jamais saisi.',
  admin_users: "Allowlist d'administration, pas une donnée de compte.",
  email_lookup_quota: 'Compteur anti-abus, technique.',
  org_member_permissions: "Droits accordés PAR l'organisation, pas fournis par la personne.",
  org_notifications: 'Notifications produites par le système.',
  org_team_members: "Appartenance décidée par l'organisation.",
  organization_join_requests: "Contient les identifiants de l'organisation, donc de tiers.",
  organization_members: "Appartenance décidée par l'organisation.",
  // Mig. 162 (branche gouvernance), déclarées le 2026-09-25 : la garde les voyait
  // sans décision depuis la fusion de cette branche.
  team_task_followers: "Abonnements aux notifications d'une tâche d'équipe : un réglage d'interface qui pointe vers des données de l'organisation, pas un contenu fourni par la personne. ⚠️ Discutable, comme `org_notification_settings` : à rouvrir si l'export doit restituer les préférences.",
  team_project_followers: "Abonnements aux notifications d'un projet d'équipe : même raison que `team_task_followers`.",
  org_notification_settings: "Préférences de notification par organisation (types coupés, e-mail, résumé) : réglage d'interface, pas une donnée fournie au sens de l'art. 20. ⚠️ Discutable : à rouvrir si l'export doit restituer les réglages.",
};

// ── Lecture du schéma ──────────────────────────────────────────────

/** table → Set de colonnes, dérivé des migrations. */
export function colonnesParTable(dossier = MIGRATIONS) {
  const out = new Map();
  const add = (t, c) => {
    if (!out.has(t)) out.set(t, new Set());
    out.get(t).add(c);
  };
  if (!existsSync(dossier)) return out;
  for (const f of readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(dossier, f), 'utf8');
    for (const m of sql.matchAll(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_0-9]+)\s*\(([\s\S]*?)\n\s*\);/gi,
    )) {
      for (const ligne of m[2].split('\n')) {
        const c = /^\s{2,}([a-z_][a-z_0-9]*)\s+[A-Za-z]/.exec(ligne);
        if (!c) continue;
        if (/^(primary|unique|constraint|foreign|check|exclude)$/i.test(c[1])) continue;
        add(m[1], c[1]);
      }
    }
    for (const m of sql.matchAll(
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_0-9]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z_0-9]*)/gi,
    )) {
      add(m[1], m[2]);
    }
    for (const m of sql.matchAll(
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z_0-9]+)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z_0-9]*)/gi,
    )) {
      out.get(m[1])?.delete(m[2]);
    }
  }
  return out;
}

/** Les en-têtes réellement passés à `cols(...)` dans l'export. */
export function entetesDeclarees(chemin = EXPORT) {
  // 🔴 LES COMMENTAIRES SONT RETIRÉS D'ABORD, et ce n'est pas cosmétique :
  // l'expression ci-dessous s'arrête à la première parenthèse fermante, et un
  // commentaire à l'intérieur d'un `cols(...)` en contient (« (C-94) »,
  // « (min) »). Sans ce nettoyage, la lecture s'arrêtait au milieu du bloc et
  // les deux dernières colonnes de l'export OKR étaient déclarées « absentes
  // de csv-export.ts » alors qu'elles venaient d'y être ajoutées. Le
  // détecteur accusait le code de ce dont il était lui-même coupable.
  const src = readFileSync(chemin, 'utf8')
    .replace(/[/][*][^]*?[*][/]/g, ' ')
    .split(String.fromCharCode(10))
    .map((l) => {
      const at = l.indexOf('//');
      return at === -1 ? l : l.slice(0, at);
    })
    .join(String.fromCharCode(10));
  const out = new Set();
  for (const m of src.matchAll(/cols\(([\s\S]*?)\)/g)) {
    for (const k of m[1].matchAll(/'([A-Za-z][A-Za-z0-9]*)'/g)) out.add(k[1]);
  }
  return out;
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const schema = colonnesParTable();
  const entetes = entetesDeclarees();
  const erreurs = [];

  // 🔴 Anti-« garde qui répond sans mesurer ».
  if (schema.size < 15) {
    erreurs.push(`Seulement ${schema.size} table(s) extraite(s) des migrations : l'extraction est cassée.`);
  }
  if (entetes.size < 20) {
    erreurs.push(`Seulement ${entetes.size} en-tête(s) lue(s) dans csv-export.ts : la lecture est cassée.`);
  }

  let exportees = 0;
  let exclues = 0;

  for (const [table, { fonction, exporte, exclu }] of Object.entries(EXPORTS)) {
    const colonnes = schema.get(table);
    if (!colonnes) {
      erreurs.push(`\`${table}\` est déclarée exportée mais aucune migration ne la crée.`);
      continue;
    }
    for (const colonne of [...colonnes].sort()) {
      if (colonne in exporte) {
        exportees += 1;
        const entete = exporte[colonne];
        if (!entetes.has(entete)) {
          erreurs.push(
            `\`${table}.${colonne}\` est déclarée exportée sous l'en-tête \`${entete}\`,\n`
              + `    qui n'apparaît dans AUCUN \`cols(...)\` de csv-export.ts. La déclaration\n`
              + `    et le code ne disent pas la même chose (${fonction}).`,
          );
        }
        continue;
      }
      if (colonne in exclu) {
        exclues += 1;
        if (!exclu[colonne] || exclu[colonne].length < 20) {
          erreurs.push(`\`${table}.${colonne}\` est exclue sans raison écrite.`);
        }
        continue;
      }
      erreurs.push(
        `\`${table}.${colonne}\` n'est NI exportée NI déclarée exclue.\n`
          + "    La question de l'article 20 : la personne l'a-t-elle fournie ?\n"
          + `    Si oui, elle doit rejoindre ${fonction}. Sinon, l'exclure ICI avec sa raison.`,
      );
    }
    // Une déclaration qui ne correspond plus à une colonne réelle.
    for (const colonne of [...Object.keys(exporte), ...Object.keys(exclu)]) {
      if (!colonnes.has(colonne)) {
        erreurs.push(
          `\`${table}.${colonne}\` est déclarée ici mais n'existe pas dans le schéma : `
            + 'colonne supprimée ou renommée.',
        );
      }
    }
  }

  // Une table de données personnelles ni exportée ni déclarée non exportée.
  for (const [table, colonnes] of schema) {
    if (table in EXPORTS) continue;
    if (table in TABLES_NON_EXPORTEES) continue;
    if (!colonnes.has('user_id')) continue;
    erreurs.push(
      `La table \`${table}\` porte \`user_id\` et n'est NI exportée NI déclarée\n`
        + '    non exportée. Une table entière absente de l\'export est le plus gros\n'
        + '    trou possible de l\'article 20 : le déclarer, avec sa raison.',
    );
  }
  for (const table of Object.keys(TABLES_NON_EXPORTEES)) {
    if (!schema.has(table)) {
      erreurs.push(`\`${table}\` est déclarée non exportée mais n'existe plus dans le schéma.`);
    }
  }

  console.log('Export de portabilité (RGPD art. 20) · confronté au schéma');
  console.log(`  tables exportées      : ${Object.keys(EXPORTS).length}`);
  console.log(`  colonnes exportées    : ${exportees}`);
  console.log(`  colonnes exclues      : ${exclues}, chacune avec sa raison`);
  console.log(`  tables non exportées  : ${Object.keys(TABLES_NON_EXPORTEES).length}, déclarées`);
  console.log(
    "⚠️ Cette garde vérifie la COUVERTURE, pas la justesse des valeurs. Un export\n"
      + '   complet mais faux resterait vert ici.',
  );

  if (erreurs.length > 0) {
    console.error('\n✖ Export de portabilité :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ Chaque colonne des tables exportées est exportée ou déclarée exclue.');
}
