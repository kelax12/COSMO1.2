// ═══════════════════════════════════════════════════════════════════
// Garde du tableau de conformité de docs/LEGAL.md
//
// POURQUOI CE SCRIPT EXISTE
//
// Le bloc de synthèse de ce tableau a été faux TROIS fois dans la même
// journée du 2026-08-26, toujours pour la même raison : additionner de tête au
// lieu de recompter la source. Une des trois fois, douze lignes étaient même
// devenues invisibles au rendu Markdown pour s'être collées à la ligne
// précédente, et le total n'en disait rien.
//
// Un tableau de conformité dont le total ne correspond pas à ses propres
// lignes se disqualifie tout seul : c'est exactement le document qu'on
// présente en contrôle pour montrer qu'on sait où on en est.
//
// Ce que le script vérifie :
//   1. chaque ligne est bien une ligne Markdown à part entière (pas de
//      collage), en refusant tout `|| <ID> |` ;
//   2. aucun identifiant n'apparaît deux fois ;
//   3. les quatre nombres du bloc de synthèse correspondent aux lignes ;
//   4. le total annoncé correspond au nombre de lignes.
//
// ═══ C-107 · CE QUI A ÉTÉ AJOUTÉ LE 2026-09-20 ═════════════════════
//
// 🔴 CE QUE LES QUATRE CONTRÔLES CI-DESSUS NE VOIENT PAS : ils vérifient
// l'ARITHMÉTIQUE, jamais la CONFORMITÉ. Une ligne marquée ✅ à tort laisse la
// garde verte, et c'est ce document qu'on présente en contrôle.
//
// La conformité elle-même reste HUMAINE — aucun script ne dira si une
// obligation est remplie. Mais deux choses sont outillables, et elles
// répondent au même problème par un autre bout :
//
//   5. UNE LIGNE ✅ DOIT PORTER UNE DATE. « ✅ » sans date décrit un instant
//      qu'on ne peut plus situer ; « ✅ vérifié le 2026-08-26 » se périme
//      visiblement. La règle a mordu à sa pose : `C10` était le seul ✅ sans
//      date, et sa relecture a trouvé une affirmation FAUSSE (« une purge doit
//      anonymiser `user_id` »), contredite depuis le 2026-09-02 par
//      `CLAUDE.md`. La date n'est pas de la bureaucratie : c'est ce qui force
//      la relecture.
//
//   6. UN CLIQUET SUR LE NOMBRE DE LIGNES DATÉES. Il ne peut que monter. Les
//      26 lignes sans date au 2026-09-20 sont presque toutes ❌ ou 🟡 — des
//      obligations non remplies, qu'il serait malhonnête de dater comme
//      « vérifiées ». Le cliquet dit la dette au lieu de l'inventer.
//
// ❌ NE JAMAIS DATER UNE LIGNE POUR FAIRE PASSER LA CI. Une date est une
//    affirmation : quelqu'un a regardé, ce jour-là. L'inventer transforme le
//    document en pièce qui ment à un contrôleur, ce qui est exactement le
//    risque que ce tableau existe pour écarter.
//
// ⚠️ Le troisième volet de C-107 — « une modification de fond de `legal.json`
// exige une entrée de journal » — vit dans `scripts/check-legal-journal.mjs` :
// il regarde d'autres fichiers, et mélanger les deux rendrait chacun moins
// lisible.
// ═══════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const FILE = 'docs/LEGAL.md';
const STATUSES = ['✅', '🟡', '❌', '⬜'];

/**
 * Le cliquet du nombre de lignes DATÉES, posé au mesuré le 2026-09-20.
 *
 * 21 sur 46. ❌ Ne baisser ce nombre sous aucun prétexte : une ligne qui perd
 * sa date est une vérification qu'on efface.
 */
const PLANCHER_DATEES = 21;

/** Une date ISO dans la dernière cellule : `2026-08-26`. */
const DATE = /20\d\d-\d\d-\d\d/;

const src = readFileSync(FILE, 'utf8');
const errors = [];

// 1. Collages — deux cellules de tableau accolées sans retour à la ligne.
const glued = [...src.matchAll(/\|\| ([A-F]\d+) \|/g)].map((m) => m[1]);
if (glued.length > 0) {
  errors.push(
    `${glued.length} ligne(s) collée(s) à la précédente, donc invisibles au rendu : ${glued.join(', ')}`,
  );
}

// 2. Les lignes du tableau.
// ⚠️ La QUATRIÈME cellule est désormais capturée : c'est elle qui porte la
// date de vérification. Sans `(.*)$`, la règle 5 ne pourrait rien lire.
const rows = [...src.matchAll(/^\| ([A-F]\d+) \| (.+?) \| (✅|🟡|❌|⬜) \|(.*)$/gm)].map((m) => ({
  id: m[1],
  status: m[3],
  detail: m[4],
}));

if (rows.length === 0) {
  errors.push('aucune ligne de tableau reconnue — le format a changé, ce script est à revoir');
}

const seen = new Set();
for (const { id } of rows) {
  if (seen.has(id)) errors.push(`identifiant en double : ${id}`);
  seen.add(id);
}

// ── 5. Une ligne ✅ porte une date (C-107) ────────────────────────
const vertesSansDate = rows.filter((r) => r.status === '✅' && !DATE.test(r.detail));
if (vertesSansDate.length > 0) {
  errors.push(
    `${vertesSansDate.length} ligne(s) ✅ SANS date de vérification : `
      + `${vertesSansDate.map((r) => r.id).join(', ')}.\n`
      + "    Un ✅ daté décrit un instant ; un ✅ sans date ne décrit rien, et il\n"
      + "    n'appelle jamais de relecture. ❌ Ne pas inventer la date : relire la\n"
      + '    ligne, et écrire le jour où on l\'a fait.',
  );
}

// ── 6. Cliquet sur les lignes datées (C-107) ──────────────────────
const datees = rows.filter((r) => DATE.test(r.detail)).length;
if (datees < PLANCHER_DATEES) {
  errors.push(
    `${datees} ligne(s) datée(s), plancher ${PLANCHER_DATEES} (posé le 2026-09-20).\n`
      + '    Une ligne qui perd sa date est une vérification qu on efface.',
  );
}

// 3. et 4. Le bloc de synthèse.
const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
for (const { status } of rows) counts[status] += 1;

// Les libellés sont des FRAGMENTS D'EXPRESSION RÉGULIÈRE, pas du texte brut :
// l'apostrophe peut être droite ou typographique selon l'éditeur qui a touché
// le document, et une garde qui échoue sur ce détail crie au loup.
const LABELS = {
  '✅': 'Bon',
  '🟡': 'Partiellement bon',
  '❌': 'À faire',
  '⬜': "Sans objet aujourd['’]hui",
};

for (const status of STATUSES) {
  const label = LABELS[status];
  const re = new RegExp(`\\| ${status} ${label} \\| \\*\\*(\\d+)\\*\\* \\|`);
  const m = src.match(re);
  if (!m) {
    errors.push(`ligne de synthèse introuvable pour le statut ${status}`);
    continue;
  }
  const declared = Number(m[1]);
  if (declared !== counts[status]) {
    errors.push(
      `synthèse « ${label} » annonce ${declared}, le tableau en contient ${counts[status]}`,
    );
  }
}

const totalMatch = src.match(/\| \*\*Total\*\* \| \*\*(\d+)\*\* \|/);
if (!totalMatch) {
  errors.push('ligne de total introuvable dans la synthèse');
} else if (Number(totalMatch[1]) !== rows.length) {
  errors.push(`total annoncé ${totalMatch[1]}, ${rows.length} ligne(s) réellement présentes`);
}

const summary = STATUSES.map((s) => `${s} ${counts[s]}`).join(' · ');

if (errors.length > 0) {
  console.error(`\n✖ ${FILE} — tableau de conformité incohérent\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n  Décompte réel : ${summary} · total ${rows.length}\n`);
  process.exit(1);
}

console.log(`\nTableau de conformité cohérent : ${summary} · total ${rows.length}`);
console.log(`Lignes datées : ${datees} / ${rows.length} (plancher ${PLANCHER_DATEES})`);
console.log(
  '⚠️ Cette garde vérifie l ARITHMÉTIQUE et la DATATION, jamais la CONFORMITÉ.'
    + '\n   Une ligne ✅ à tort et datée reste verte ici. La conformité se vérifie'
    + '\n   à la main (a-faire-manuel.md).\n',
);
