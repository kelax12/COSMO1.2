// Présentation uniquement : parsing d'arguments, rendu, codes de sortie.
// Aucune requête directe — tout passe par api.mjs.
import fs from 'node:fs';
import { createCosmoClient, requireSession } from './client.mjs';
import { formatLine, formatTaskDetail } from './format.mjs';
import {
  listTasks, getTask, createTask, completeTask, reopenTask, updateTask, deleteTask,
  listCategories,
  listHabitsToday, markHabitDone,
  listUpcomingEvents, listOkrs, listKeyResults,
  todayLocal,
} from './api.mjs';

const USAGE = `Usage : npm run cosmo -- <commande> [options]

Taches (lecture + ecriture complete)
  tasks list [--all] [--full] [--category <c>] [--before <YYYY-MM-DD>] [--limit <n>]
  tasks show <id>                  detail complet, description incluse
  tasks add <nom> [--priority <1-5>] [--category <c>] [--deadline <YYYY-MM-DD>] [--time <min>] [--description <texte>]
  tasks update <id> [--name <n>] [--priority <1-5>] [--category <c>]
                    [--deadline <YYYY-MM-DD>|""] [--time <min>] [--bookmark|--no-bookmark] [--description <texte>]
  tasks done <id>
  tasks reopen <id>
  tasks delete <id> --confirm      (irreversible)

Entree JSON (recommandee pour un agent — aucun risque de decoupage shell)
  tasks add    --input '{"name":"Ma tache","description":"Contexte detaille"}'
  tasks update <id> --input '{"description":"Nouveau contexte"}'
  --input -    lit le JSON sur stdin

ATTENTION : une valeur avec des espaces DOIT etre quotee. Sans guillemets, les
mots suivants sont rattaches au nom de la tache et la valeur est tronquee au
premier mot. Le CLI refuse desormais ce cas au lieu de l'accepter en silence.

Autres domaines
  categories                       liste les categories (nom + id)
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
  tasks: ['list', 'show', 'add', 'update', 'done', 'reopen', 'delete', undefined],
  categories: [undefined],
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
  // Mots libres apparaissant APRÈS un drapeau. Signature quasi certaine d'une
  // valeur en prose non quotée : `--description Contexte complet de la tache`
  // ne donne que « Contexte » au drapeau, et « complet de la tache » se
  // retrouve silencieusement collé au nom de la tâche. On les collecte pour
  // pouvoir refuser au lieu de corrompre deux champs sans prévenir.
  const stray = [];
  let seenFlag = false;
  let lastFlagKey = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      seenFlag = true;
      lastFlagKey = key;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else if (seenFlag) {
      stray.push(arg);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags, stray, lastFlagKey };
}

/**
 * Rend une valeur. `detail: true` bascule sur le rendu complet d'une tache
 * (description incluse) au lieu de la ligne compacte des listes.
 */
function output(value, flags, { detail = false } = {}) {
  // Un objet dry-run n'a aucun des champs que formatLine sait rendre : le
  // passer dans le formateur produisait « [ ] Pundefined undefined ».
  if (flags.json || value?.dryRun) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (detail && !Array.isArray(value)) {
    console.log(formatTaskDetail(value));
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

/**
 * Charge une charge utile JSON depuis `--input`. Chemin recommandé pour les
 * agents : un seul argument quoté, et une erreur de syntaxe est bruyante au
 * lieu d'être silencieusement découpée par le shell.
 */
function readJsonInput(raw) {
  const text = raw === '-' ? fs.readFileSync(0, 'utf8') : raw;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `--input n est pas du JSON valide (${err.message}). Exemple : ` +
        `--input '{"name":"Ma tache","description":"Contexte detaille"}'`
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--input attend un objet JSON, par exemple {"name":"...","description":"..."}.');
  }
  return parsed;
}

async function run(argv) {
  const { positional, flags, stray, lastFlagKey } = parseArgs(argv);
  const [domain, action, ...rest] = positional;

  // Prose non quotée : refuser plutôt que corrompre le nom ET tronquer la
  // valeur. C'est le mode d'échec principal quand une IA appelle ce CLI.
  if (stray.length > 0) {
    console.error(
      `Mots non rattaches apres --${lastFlagKey} : ${stray.map((s) => `« ${s} »`).join(', ')}`
    );
    console.error('');
    console.error('Une valeur contenant des espaces doit etre entre guillemets :');
    console.error(`  --${lastFlagKey} "${[flags[lastFlagKey], ...stray].join(' ')}"`);
    console.error('');
    console.error('Ou, plus sur pour un agent, passe tout en JSON :');
    console.error(`  npm run cosmo -- tasks add --input '{"name":"...","description":"..."}'`);
    process.exitCode = 1;
    return;
  }

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
      full: Boolean(flags.full),
    });
    output(tasks, flags);
    return;
  }

  if (domain === 'tasks' && action === 'show') {
    output(await getTask(client, rest[0]), flags, { detail: true });
    return;
  }

  if (domain === 'tasks' && action === 'add') {
    // `--input` prend le pas : c'est le chemin robuste pour un agent, sans
    // aucun risque de decoupage par le shell.
    const fromJson = flags.input !== undefined ? readJsonInput(stringFlag(flags, 'input')) : {};
    const name = rest.join(' ') || fromJson.name;
    const input = {
      name,
      priority: numberFlag(flags, 'priority') ?? fromJson.priority,
      category: stringFlag(flags, 'category') ?? fromJson.category,
      deadline: flags.deadline === '' ? '' : (stringFlag(flags, 'deadline') ?? fromJson.deadline),
      estimatedTime: numberFlag(flags, 'time') ?? fromJson.estimatedTime,
      description: stringFlag(flags, 'description') ?? fromJson.description,
      krId: fromJson.krId,
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
    const fromJson = flags.input !== undefined ? readJsonInput(stringFlag(flags, 'input')) : {};
    const patch = {
      name: (rest.length > 1 ? rest.slice(1).join(' ') : stringFlag(flags, 'name')) ?? fromJson.name,
      priority: numberFlag(flags, 'priority') ?? fromJson.priority,
      category: stringFlag(flags, 'category') ?? fromJson.category,
      // `--deadline ""` doit pouvoir effacer l'echeance : on distingue la
      // chaine vide (effacer) de l'absence de drapeau (ne pas toucher).
      deadline: flags.deadline === '' ? '' : (stringFlag(flags, 'deadline') ?? fromJson.deadline),
      estimatedTime: numberFlag(flags, 'time') ?? fromJson.estimatedTime,
      bookmarked: flags.bookmark ? true : flags['no-bookmark'] ? false : fromJson.bookmarked,
      description: stringFlag(flags, 'description') ?? fromJson.description,
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

  if (domain === 'categories') {
    output(await listCategories(client), flags);
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
