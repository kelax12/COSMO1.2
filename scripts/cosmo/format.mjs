import { deadlineDayKey } from './deadline.mjs';

// Rendu texte du CLI. Extrait de cli.mjs pour etre testable : cli.mjs lance
// `run(process.argv)` a l'import, donc l'importer depuis un test executerait
// la commande.

/** Ligne compacte, une par entite — utilisee par toutes les listes. */
export function formatLine(item) {
  // Categorie : {id, name, color} — pas de champ discriminant plus tardif, on
  // teste `color` qui n'existe que la.
  if (item.color !== undefined && item.name !== undefined && item.doneToday === undefined) {
    return `${item.name}  (${item.id})`;
  }
  if (item.doneToday !== undefined) {
    return `${item.doneToday ? '[x]' : '[ ]'} ${item.name}  (${item.id})`;
  }
  if (item.startTime !== undefined) {
    return `${item.startTime}  ${item.title}  (${item.id})`;
  }
  if (item.targetValue !== undefined) {
    return `${item.title} : ${item.currentValue}/${item.targetValue} ${item.unit ?? ''}  (${item.id})`;
  }
  if (item.progress !== undefined) {
    return `${item.completed ? '[x]' : '[ ]'} ${item.title} — ${item.progress}%  (${item.id})`;
  }
  const mark = item.completed ? '[x]' : '[ ]';
  const deadline = item.deadline ? ` echeance ${deadlineDayKey(item.deadline)}` : '';
  return `${mark} P${item.priority} ${item.name}${deadline}  (${item.id})`;
}

/** `2026-08-01T00:00:00+00:00` -> `2026-08-01`. Tolere les valeurs absentes. */
function dateOnly(value) {
  // Jour VECU, pas jour UTC : une echeance ecrite a minuit local ressort
  // 'YYYY-MM-(D-1)' si on la tronque a dix caracteres.
  return deadlineDayKey(value);
}

const LABEL_WIDTH = 12;

function field(label, value) {
  return `  ${label.padEnd(LABEL_WIDTH)}${value}`;
}

/**
 * Detail complet d'une tache, pour `tasks show`.
 *
 * ⚠️ Cette fonction existe parce que `show` rendait exactement la meme ligne
 * que `list` : la description etait bien lue en base (getTask fait
 * `select('*')`) mais jamais affichee. Un agent qui ecrivait une description
 * puis la relisait — ce que la doc lui dit de faire — concluait que son
 * ecriture avait echoue et la rejouait en boucle. D'ou deux regles :
 *   1. la description est TOUJOURS rendue ;
 *   2. une description vide est dite explicitement, jamais silencieuse —
 *      « rien a l'ecran » est precisement l'ambiguite qui causait la boucle.
 */
export function formatTaskDetail(task) {
  const lines = [];

  lines.push(formatLine(task));
  lines.push('');
  lines.push(field('id', task.id));
  lines.push(field('statut', task.completed ? 'terminee' : 'ouverte'));
  lines.push(field('priorite', `P${task.priority ?? '?'}`));
  lines.push(field('categorie', task.category || '(aucune)'));
  lines.push(field('echeance', dateOnly(task.deadline) || '(aucune)'));
  lines.push(
    field('duree', task.estimatedTime === undefined ? '(non definie)' : `${task.estimatedTime} min`)
  );
  lines.push(field('recurrence', task.recurrence ?? 'none'));
  lines.push(field('favori', task.bookmarked ? 'oui' : 'non'));
  if (task.krId) lines.push(field('kr', task.krId));
  lines.push(field('creee le', dateOnly(task.createdAt) || '(inconnue)'));
  if (task.completedAt) lines.push(field('terminee le', dateOnly(task.completedAt)));

  lines.push('');
  lines.push('Description');
  const description = task.description ?? '';
  if (description.trim() === '') {
    lines.push('  (aucune description)');
  } else {
    // Indentation ligne a ligne : une description multi-lignes doit rester
    // lisible sans perdre ses retours.
    for (const line of description.split('\n')) lines.push(`  ${line}`);
  }

  return lines.join('\n');
}
