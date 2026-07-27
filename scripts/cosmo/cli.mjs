// Présentation uniquement : parsing d'arguments, rendu, codes de sortie.
// Aucune requête directe — tout passe par api.mjs.
import { createCosmoClient, requireSession } from './client.mjs';
import {
  listTasks, createTask, completeTask, reopenTask, updateTask, deleteTask,
  listHabitsToday, markHabitDone,
  listUpcomingEvents, listOkrs, listKeyResults,
  todayLocal,
} from './api.mjs';

const USAGE = `Usage : npm run cosmo -- <commande> [options]

Taches (lecture + ecriture complete)
  tasks list [--all] [--category <c>] [--before <YYYY-MM-DD>] [--limit <n>]
  tasks add <nom> [--priority <1-5>] [--category <c>] [--deadline <YYYY-MM-DD>] [--time <min>]
  tasks update <id> [--name <n>] [--priority <1-5>] [--category <c>]
                    [--deadline <YYYY-MM-DD>|""] [--time <min>] [--bookmark|--no-bookmark]
  tasks done <id>
  tasks reopen <id>
  tasks delete <id> --confirm      (irreversible)

Autres domaines
  habits today
  habits done <id>
  agenda [--days <n>]
  okr [--kr <okrId>]

Options globales
  --json      sortie JSON brute
  --dry-run   n'ecrit rien, affiche ce qui serait envoye

Priorites : 1 = tres basse ... 5 = critique.
`;

/** Commandes valides, verifiees AVANT toute authentification : une faute de
 *  frappe ne doit pas produire « session expiree ». */
const KNOWN = {
  tasks: ['list', 'add', 'update', 'done', 'reopen', 'delete', undefined],
  habits: ['today', 'done', undefined],
  agenda: [undefined],
  okr: [undefined],
};

/** Un drapeau numerique sans valeur (`--limit` seul) vaut `true`, que Number()
 *  convertit silencieusement en 1. On refuse explicitement. */
function numberFlag(flags, key) {
  const raw = flags[key];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (raw === true || Number.isNaN(value)) {
    throw new Error(`--${key} attend une valeur numerique (recu : ${raw === true ? 'rien' : raw}).`);
  }
  return value;
}

function stringFlag(flags, key) {
  const raw = flags[key];
  if (raw === undefined) return undefined;
  if (raw === true) throw new Error(`--${key} attend une valeur.`);
  return raw;
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function formatLine(item) {
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
  const deadline = item.deadline ? ` echeance ${item.deadline.slice(0, 10)}` : '';
  return `${mark} P${item.priority} ${item.name}${deadline}  (${item.id})`;
}

function output(value, flags) {
  // Un objet dry-run n'a aucun des champs que formatLine sait rendre : le
  // passer dans le formateur produisait « [ ] Pundefined undefined ».
  if (flags.json || value?.dryRun) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      console.log('(rien)');
      return;
    }
    for (const item of value) console.log(formatLine(item));
    return;
  }
  console.log(formatLine(value));
}

async function run(argv) {
  const { positional, flags } = parseArgs(argv);
  const [domain, action, ...rest] = positional;

  if (!domain || flags.help) {
    console.log(USAGE);
    return;
  }

  // Validation AVANT authentification : sinon une commande mal tapee remontait
  // « session expiree », message trompeur qui envoie chercher le probleme au
  // mauvais endroit.
  if (!KNOWN[domain] || !KNOWN[domain].includes(action)) {
    console.error(`Commande inconnue : ${positional.join(' ') || '(vide)'}\n`);
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  const client = createCosmoClient();
  const session = await requireSession(client);

  if (domain === 'tasks' && (action === 'list' || action === undefined)) {
    const tasks = await listTasks(client, {
      completed: flags.all ? undefined : false,
      category: stringFlag(flags, 'category'),
      deadlineBefore: stringFlag(flags, 'before'),
      limit: numberFlag(flags, 'limit'),
    });
    output(tasks, flags);
    return;
  }

  if (domain === 'tasks' && action === 'add') {
    const name = rest.join(' ');
    const input = {
      name,
      priority: numberFlag(flags, 'priority'),
      category: stringFlag(flags, 'category'),
      deadline: flags.deadline === '' ? '' : stringFlag(flags, 'deadline'),
      estimatedTime: numberFlag(flags, 'time'),
    };
    if (flags['dry-run']) {
      output({ dryRun: true, wouldCreate: { ...input, deadline: input.deadline ?? todayLocal() } }, flags);
      return;
    }
    const created = await createTask(client, input, { userId: session.user.id });
    // Ré-affiche la ligne telle que la base l'a renvoyée, pas la charge utile
    // envoyée : ça rend visibles les defaults et triggers serveur.
    output(created, flags);
    return;
  }

  if (domain === 'tasks' && action === 'update') {
    const id = rest[0];
    const patch = {
      name: rest.length > 1 ? rest.slice(1).join(' ') : stringFlag(flags, 'name'),
      priority: numberFlag(flags, 'priority'),
      category: stringFlag(flags, 'category'),
      // `--deadline ""` doit pouvoir effacer l'echeance : on distingue la
      // chaine vide (effacer) de l'absence de drapeau (ne pas toucher).
      deadline: flags.deadline === '' ? '' : stringFlag(flags, 'deadline'),
      estimatedTime: numberFlag(flags, 'time'),
      bookmarked: flags.bookmark ? true : flags['no-bookmark'] ? false : undefined,
    };
    if (flags['dry-run']) {
      output({ dryRun: true, wouldUpdate: id, patch }, flags);
      return;
    }
    output(await updateTask(client, id, patch), flags);
    return;
  }

  if (domain === 'tasks' && action === 'done') {
    const id = rest[0];
    if (flags['dry-run']) {
      output({ dryRun: true, wouldComplete: id }, flags);
      return;
    }
    output(await completeTask(client, id), flags);
    return;
  }

  if (domain === 'tasks' && action === 'reopen') {
    const id = rest[0];
    if (flags['dry-run']) {
      output({ dryRun: true, wouldReopen: id }, flags);
      return;
    }
    output(await reopenTask(client, id), flags);
    return;
  }

  if (domain === 'tasks' && action === 'delete') {
    const id = rest[0];
    if (flags['dry-run']) {
      output({ dryRun: true, wouldDelete: id }, flags);
      return;
    }
    // Suppression irreversible : on exige un geste explicite. Le reste du CLI
    // n'ecrit que du reversible, celle-ci est la seule sortie sans retour.
    if (!flags.confirm) {
      console.error(`Suppression IRREVERSIBLE de la tache ${id}.`);
      console.error('Relance avec --confirm pour l executer, ou --dry-run pour verifier la cible.');
      process.exitCode = 1;
      return;
    }
    const removed = await deleteTask(client, id);
    if (!flags.json) console.log('Supprimee :');
    output(removed, flags);
    return;
  }

  if (domain === 'habits' && (action === 'today' || action === undefined)) {
    output(await listHabitsToday(client), flags);
    return;
  }

  if (domain === 'habits' && action === 'done') {
    const id = rest[0];
    if (flags['dry-run']) {
      output({ dryRun: true, wouldMarkDone: id }, flags);
      return;
    }
    const result = await markHabitDone(client, id);
    if (result.alreadyDone && !flags.json) console.log('(deja faite aujourd hui, rien de change)');
    output(result, flags);
    return;
  }

  if (domain === 'agenda') {
    const events = await listUpcomingEvents(client, {
      userId: session.user.id,
      days: numberFlag(flags, 'days') ?? 7,
    });
    output(events, flags);
    return;
  }

  if (domain === 'okr') {
    const krId = stringFlag(flags, 'kr');
    output(krId ? await listKeyResults(client, krId) : await listOkrs(client), flags);
    return;
  }
}

run(process.argv.slice(2)).catch((err) => {
  console.error(`${err.name ?? 'Erreur'} : ${err.message}`);
  process.exitCode = 1;
});
