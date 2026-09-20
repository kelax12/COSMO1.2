// ═══════════════════════════════════════════════════════════════════
// C-81 — LES TÉMOINS NE SONT JAMAIS REJOUÉS
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 LE DÉFAUT, ET IL EST STRUCTUREL. Ce dépôt compte 42 fichiers
// `*guard.test.*`. Chacun est arrivé avec la même phrase : « vu rouge sur N
// sabotages ». Ce sabotage a été joué UNE FOIS, à la main, le jour de
// l'écriture. Rien, ensuite, ne dit qu'un témoin détecte ENCORE.
//
// Un témoin qui ne détecte plus est pire qu'un témoin absent : il produit un
// vert, et ce vert est lu comme une preuve. C'est la thèse centrale de
// `scripts/CLAUDE.md` appliquée à l'étage du dessus — les gardes gardent le
// produit, et rien ne garde les gardes.
//
// ── CE QUE CE SCRIPT FAIT ───────────────────────────────────────────
//
// Pour chaque sabotage du catalogue ci-dessous :
//   1. il écrit la version FAUTIVE du fichier cible sur le disque ;
//   2. il lance le fichier de témoin correspondant, et lui SEUL ;
//   3. il exige que le témoin soit ROUGE ;
//   4. il restaure la cible, octet pour octet, et le vérifie.
//
// Si un témoin reste VERT sur son sabotage, il ne garde plus rien : le script
// échoue en le nommant.
//
// ── POURQUOI PAS STRYKER ────────────────────────────────────────────
//
// L'énoncé de C-81 laissait le choix entre « rejouer N sabotages connus » et
// « Stryker ». Le second a été écarté, et la raison s'écrit :
//
//   · Stryker mute le code SOURCE et regarde si les tests tombent. Or la
//     majorité des témoins de ce dépôt ne testent pas du code : ils lisent
//     des FICHIERS — `vercel.json`, une migration SQL, une Edge Function
//     Deno, un workflow YAML. Un mutateur JavaScript n'y touche pas ;
//   · il ajoute une dépendance lourde et un temps de run de plusieurs
//     dizaines de minutes pour couvrir la part la moins à risque ;
//   · surtout : un score de mutation est un POURCENTAGE, et l'expérience de
//     ce dépôt est qu'un pourcentage finit par être négocié. Un sabotage
//     nommé qui passe au vert ne se négocie pas.
//
// ── CE QUE ÇA NE PROUVE PAS ─────────────────────────────────────────
//
// ⚠️ Que les 42 témoins détectent. Le catalogue en couvre une partie, celle
// dont le sabotage est exprimable par un remplacement de texte sûr et
// réversible. Le nombre couvert est IMPRIMÉ à chaque run, à côté du total,
// pour que l'écart reste visible au lieu d'être oublié.
// ❌ Ne jamais écrire « les témoins sont vérifiés » : écrire combien.
//
// ── SÉCURITÉ ────────────────────────────────────────────────────────
//
// 🔴 CE SCRIPT ÉCRIT DANS L'ARBRE DE TRAVAIL. Plusieurs sessions travaillent
// sur cette machine (`CLAUDE.md` racine). Trois précautions, non négociables :
//   · refus de démarrer si l'une des cibles est déjà MODIFIÉE selon git —
//     on ne saurait pas quoi restaurer ;
//   · restauration dans un `finally`, ET sur `SIGINT`/`SIGTERM`/exception ;
//   · vérification finale octet pour octet, et échec bruyant sinon.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const RACINE = process.cwd();

/**
 * LE CATALOGUE.
 *
 * `cible`    : le fichier à saboter, relatif à la racine.
 * `temoin`   : le fichier de test qui DOIT rougir.
 * `chercher` / `remplacer` : le sabotage, un remplacement littéral unique.
 * `pourquoi` : ce que le témoin perdrait s'il cessait de voir ce défaut.
 *
 * ⚠️ `chercher` doit apparaître EXACTEMENT UNE FOIS dans la cible. Un motif
 * ambigu saboterait autre chose que prévu, ou rien du tout, et un sabotage qui
 * ne sabote rien laisse le témoin vert pour la bonne raison — c'est-à-dire
 * qu'il ment. Le script le vérifie avant d'écrire.
 */
const CATALOGUE = [
  {
    id: 'csp-wss',
    cible: 'vercel.json',
    temoin: 'src/csp.guard.test.ts',
    chercher: ' wss://*.supabase.co',
    remplacer: '',
    pourquoi:
      'Sans `wss:` dans connect-src, le navigateur bloque TOUTES les connexions '
      + 'Realtime en production, en silence. Trois canaux d`App.tsx` coupés, et '
      + 'ils avaient remplacé huit sondages : une tâche partagée n`arrive jamais.',
  },
  {
    id: 'csp-unsafe-eval',
    cible: 'vercel.json',
    temoin: 'src/csp.guard.test.ts',
    chercher: "script-src 'self'",
    remplacer: "script-src 'self' 'unsafe-eval'",
    pourquoi:
      "`'unsafe-eval'` rouvre l'exécution de chaînes arbitraires : la CSP cesse "
      + "d'être une défense contre le XSS et devient une décoration.",
  },
  {
    id: 'rate-limit-borne',
    cible: 'supabase/migration/139_rate_limits.sql',
    temoin: 'src/rate-limit.guard.test.ts',
    chercher: 'rl.hits > p_limit',
    remplacer: 'rl.hits >= p_limit',
    pourquoi:
      'Avec `>=` et un plafond de 3, le 4ᵉ appel est ACCEPTÉ : le plafond de '
      + "débit de `report-bug` n'a jamais rien refusé, tout en ayant l'air "
      + "d'exister. C'est le défaut exact qui a failli partir.",
  },
  {
    id: 'stripe-checkout-cors',
    cible: 'supabase/functions/stripe-create-checkout/index.ts',
    temoin: 'src/stripe-create-checkout.guard.test.ts',
    chercher: "if (allow) headers['Access-Control-Allow-Origin'] = allow",
    remplacer: "headers['Access-Control-Allow-Origin'] = '*'",
    pourquoi:
      "Le joker CORS amplifie la portée d'un JWT qui fuit : rejeu depuis "
      + "n'importe quelle origine (faille N7).",
  },
  {
    id: 'stripe-checkout-upsert',
    cible: 'supabase/functions/stripe-create-checkout/index.ts',
    temoin: 'src/stripe-create-checkout.guard.test.ts',
    chercher: '.upsert(',
    remplacer: '.update(',
    pourquoi:
      "Un `UPDATE` seul ne matche aucune ligne tant que `subscriptions` n'existe "
      + "pas : l'identifiant du client Stripe est perdu en silence et chaque "
      + 'reprise crée un client orphelin de plus (faille U1).',
  },
  {
    id: 'rgpd-friends-symetrie',
    cible: 'supabase/functions/delete-account/index.ts',
    temoin: 'src/rgpd-erasure.guard.test.ts',
    chercher: 'friend_user_id.eq.',
    remplacer: 'user_id.eq.',
    pourquoi:
      "`friends` est symétrique : un compte y apparaît aussi en "
      + '`friend_user_id`. Purger une seule colonne laisse des lignes portant '
      + 'les données personnelles du compte supprimé (RGPD art. 17).',
  },
  {
    id: 'cron-garde-conditionnelle',
    cible: 'supabase/functions/renewal-notice/index.ts',
    temoin: 'src/edge-mail-functions.guard.test.ts',
    chercher: "  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {",
    remplacer: "  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {",
    pourquoi:
      "C'est LE motif « on ne se protège que quand on est déjà protégé » : "
      + 'tant que le secret n\'est pas posé, la garde laisse passer tout le monde. '
      + 'Introduit puis corrigé le 2026-08-26 dans cette fonction même.',
  },
  {
    id: 'org-deletion-preuve-append-only',
    cible: 'supabase/migration/138_evidence_survives_org_deletion.sql',
    temoin: 'src/org-deletion.guard.test.ts',
    chercher: 'NEW.org_id IS NULL',
    remplacer: 'NEW.org_id IS NOT NULL',
    pourquoi:
      '`withdrawal_consents` est une preuve append-only (Conso. L221-28). '
      + 'Inverser ce test rend le trigger inopérant : la suppression d\'une '
      + 'organisation emporte les preuves qu\'on produit en litige.',
  },
  {
    id: 'sentry-filets-precoces',
    cible: 'src/main.tsx',
    temoin: 'src/monitoring.guard.test.ts',
    // Le motif est l'INSTRUCTION entière, `;` compris : `installEarlyHandlers()`
    // seul apparaît trois fois dans ce fichier (import, commentaire, appel) et
    // le sabotage serait alors ambigu — le script le refuse.
    chercher: '\ninstallEarlyHandlers();',
    remplacer: '\n// installEarlyHandlers();',
    pourquoi:
      'Les filets doivent être posés AVANT `mount()` : sans eux, les erreurs '
      + 'des premières millisecondes — celles qui empêchent l\'application de '
      + "monter du tout — ne remontent nulle part.",
  },
  {
    id: 'polling-permanent',
    cible: 'src/modules/organizations/hooks.ts',
    temoin: 'src/modules/polling.guard.test.ts',
    chercher: '...(options?.live ? { refetchInterval: 20_000 } : {}),',
    remplacer: 'refetchInterval: 20_000,',
    pourquoi:
      'Un `refetchInterval` littéral est un sondage PERMANENT. Huit d\'entre eux '
      + 'faisaient ~30 requêtes par minute et par onglet, et 91,5 % du trafic '
      + 'Supabase venait de deux onglets jamais rechargés.',
  },
  {
    id: 'toast-import-statique',
    cible: 'src/App.tsx',
    temoin: 'src/lib/toast.guard.test.ts',
    chercher: "import React",
    remplacer: "import { toast as _sabotage } from 'sonner';\nimport React",
    pourquoi:
      'Un seul import statique de `sonner` dans tout `src/` suffit à faire '
      + "replacer le module dans le chunk d'ENTRÉE par Rollup : les 10,1 ko "
      + 'gzip sortis du chemin critique par C-14 y reviennent en silence.',
  },
];

// ── Utilitaires ────────────────────────────────────────────────────

/** Le fichier est-il propre selon git ? On ne sabote que ce qu'on sait rendre. */
function estPropre(chemin) {
  const r = spawnSync('git', ['status', '--porcelain', '--', chemin], {
    cwd: RACINE,
    encoding: 'utf8',
  });
  if (r.status !== 0) return null; // git indisponible : on ne peut pas juger
  return r.stdout.trim() === '';
}

/**
 * Lance UN fichier de témoin. Rend `{ vert, casEnEchec }`.
 *
 * 🔴 `casEnEchec` est LU dans la ligne de résumé de vitest (`Tests  2 failed |
 * 8 passed`), et pas deviné à partir de marqueurs de mise en forme. La
 * première écriture de ce script cherchait `FAIL` ou `×` dans la sortie du
 * reporter `dot` : ce reporter ne les émet pas sous cette forme, donc les SEPT
 * sabotages étaient déclarés « rouges pour la mauvaise raison » alors que les
 * sept témoins faisaient exactement leur travail. Une garde qui interprète un
 * AFFICHAGE au lieu de lire un CHIFFRE rend un verdict sur la mise en forme.
 *
 * La distinction vaut la peine d'être faite : un témoin qui PLANTE à l'import
 * (module absent, erreur de parse) sort aussi en non-zéro sans avoir exécuté
 * un seul cas. Ce rouge-là ne prouve rien, et c'est le faux positif qu'on
 * veut écarter.
 */
function jouerTemoin(temoin) {
  // 🔴 `node node_modules/vitest/vitest.mjs`, JAMAIS `npx`. Sur Windows,
  // `spawnSync('npx.cmd', …)` échoue en `EINVAL` sans rien lancer : `status`
  // vaut `null`, donc `status === 0` est faux, donc CHAQUE témoin passait pour
  // « rouge ». Le script annonçait sept sabotages détectés en n'ayant pas
  // exécuté une seule suite. C'est la garde qui répond sans mesurer, écrite
  // dans le script dont le métier est d'attraper ça — et c'est le contrôle
  // « rouge mais zéro cas en échec » qui l'a révélé, pas la lecture.
  // ⚠️ `shell: true` serait l'autre réponse, et c'est la mauvaise : elle
  // passerait un chemin de fichier à un interpréteur de commandes.
  const VITEST = join(RACINE, 'node_modules', 'vitest', 'vitest.mjs');
  if (!existsSync(VITEST)) {
    throw new Error(
      `vitest introuvable à ${VITEST}. Lancer \`npm ci\` avant de rejouer les sabotages.`,
    );
  }
  const r = spawnSync(
    process.execPath,
    [VITEST, 'run', temoin],
    { cwd: RACINE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  // ⚠️ Les SÉQUENCES ANSI sont retirées avant de lire le chiffre. Vitest
  // colore son résumé, donc « Tests » et « 2 failed » sont séparés par des
  // codes d'échappement : une expression écrite sur le texte brut ne matche
  // jamais, et le script déclarait alors les sept témoins « rouges pour la
  // mauvaise raison ». Deuxième fois, dans le même fichier, qu'une lecture
  // d'AFFICHAGE tient lieu de mesure.
  const brut = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  // eslint-disable-next-line no-control-regex
  const sortie = brut.replace(/\[[0-9;]*m/g, '');
  const resume = /Tests\s+(\d+)\s+failed/.exec(sortie);
  return { vert: r.status === 0, casEnEchec: resume ? Number(resume[1]) : 0 };
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

export { CATALOGUE };

if (estLanceDirectement) {
  const seulement = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
  const catalogue = seulement
    ? CATALOGUE.filter((s) => s.id === seulement)
    : CATALOGUE;

  if (catalogue.length === 0) {
    console.error(`✖ Aucun sabotage nommé « ${seulement} » dans le catalogue.`);
    process.exit(1);
  }

  // ── Garde 1 : toutes les cibles existent et sont PROPRES ─────────
  const cibles = [...new Set(catalogue.map((s) => s.cible))];
  const problemes = [];
  for (const c of cibles) {
    if (!existsSync(join(RACINE, c))) {
      problemes.push(`${c} : fichier absent. Le catalogue décrit un état périmé.`);
      continue;
    }
    const propre = estPropre(c);
    if (propre === false) {
      problemes.push(
        `${c} : MODIFIÉ dans l'arbre de travail. Ce script écrit dans les fichiers `
          + 'et les restaure ensuite ; sur un fichier déjà modifié, il détruirait un '
          + 'travail en cours. Committer ou remiser d\'abord.',
      );
    }
  }
  if (problemes.length > 0) {
    console.error('✖ Refus de démarrer :');
    for (const p of problemes) console.error(`  - ${p}`);
    process.exit(1);
  }

  // ── Garde 2 : la restauration survit à tout ──────────────────────
  const originaux = new Map(cibles.map((c) => [c, readFileSync(join(RACINE, c))]));
  let restaure = false;
  const toutRestaurer = () => {
    if (restaure) return;
    restaure = true;
    for (const [c, octets] of originaux) writeFileSync(join(RACINE, c), octets);
  };
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      toutRestaurer();
      console.error(`\n⚠️ Interrompu (${signal}) — les ${cibles.length} cibles ont été restaurées.`);
      process.exit(130);
    });
  }
  process.on('uncaughtException', (e) => {
    toutRestaurer();
    console.error('\n✖ Exception — cibles restaurées.', e);
    process.exit(1);
  });

  const survivants = [];
  const joues = [];

  try {
    for (const s of catalogue) {
      const chemin = join(RACINE, s.cible);
      const original = originaux.get(s.cible).toString('utf8');

      const occurrences = original.split(s.chercher).length - 1;
      if (occurrences !== 1) {
        survivants.push(
          `${s.id} : le motif « ${s.chercher} » apparaît ${occurrences} fois dans `
            + `${s.cible} (attendu : exactement 1). Un sabotage ambigu ne sabote pas `
            + 'ce qu\'il croit, et un sabotage qui ne sabote rien laisse le témoin vert '
            + 'pour la mauvaise raison.',
        );
        continue;
      }

      process.stdout.write(`  ${s.id.padEnd(26)} → ${s.temoin} … `);
      writeFileSync(chemin, original.replace(s.chercher, s.remplacer), 'utf8');
      const { vert, casEnEchec } = jouerTemoin(s.temoin);
      writeFileSync(chemin, originaux.get(s.cible));

      joues.push(s.id);
      if (vert) {
        process.stdout.write('VERT ✖\n');
        survivants.push(
          `${s.id} : le témoin ${s.temoin} reste VERT alors que ${s.cible} porte le `
            + `défaut.\n      Ce que le témoin ne voit plus : ${s.pourquoi}\n`
            + '      Il ne garde donc plus rien, et son vert est lu comme une preuve.',
        );
      } else if (casEnEchec === 0) {
        // Un témoin qui sort en erreur SANS cas en échec (crash à l'import,
        // module absent) est rouge pour une raison qui n'est pas la nôtre.
        process.stdout.write('rouge, mais 0 cas en echec ✖\n');
        survivants.push(
          `${s.id} : ${s.temoin} est rouge mais AUCUN cas n'a échoué — le fichier a `
            + "probablement planté à l'import. Ce rouge ne prouve pas que le témoin "
            + 'détecte.',
        );
      } else {
        process.stdout.write(`rouge ✓ (${casEnEchec} cas)\n`);
      }
    }
  } finally {
    toutRestaurer();
  }

  // ── Garde 3 : tout est revenu, octet pour octet ──────────────────
  const abimes = [];
  for (const [c, octets] of originaux) {
    if (!readFileSync(join(RACINE, c)).equals(octets)) abimes.push(c);
  }
  if (abimes.length > 0) {
    console.error(
      `\n🔴 RESTAURATION INCOMPLÈTE : ${abimes.join(', ')}.\n`
        + `  Restaurer à la main :  git checkout -- ${abimes.join(' ')}`,
    );
    process.exit(1);
  }

  const totalTemoins = compterTemoins();
  console.log(
    `\n${joues.length} sabotage(s) rejoué(s), sur ${new Set(catalogue.map((s) => s.temoin)).size} `
      + `témoin(s) — le dépôt en compte ${totalTemoins}.`,
  );
  console.log(
    '⚠️ Les autres témoins ne sont PAS vérifiés par ce script. Écrire « les témoins',
    "\n   sont vérifiés » serait faux : écrire combien.",
  );

  if (survivants.length > 0) {
    console.error('\n✖ Des témoins ne détectent plus :');
    for (const s of survivants) console.error(`  - ${s}`);
    process.exit(1);
  }
  console.log('\n✓ Chaque sabotage du catalogue a été VU par son témoin.');
}

/** Le nombre de témoins du dépôt, pour afficher l'écart plutôt que le taire. */
function compterTemoins() {
  try {
    const suivis = execFileSync('git', ['ls-files'], { cwd: RACINE, encoding: 'utf8' });
    return suivis.split('\n').filter((f) => /[.-]guard\.(test|spec)\.(ts|tsx|mjs)$/.test(f.trim()))
      .length;
  } catch {
    return -1;
  }
}
