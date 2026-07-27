// Présentation uniquement : parsing d'arguments, rendu, codes de sortie.
// Aucune requête directe — tout passe par api.mjs.
import { createCosmoClient, requireSession } from './client.mjs';
import {
  listTasks, createTask, completeTask,
  listHabitsToday, markHabitDone,
  listUpcomingEvents, listOkrs, listKeyResults,
  todayLocal,
} from './api.mjs';

const USAGE = `Usage : npm run cosmo -- <commande> [options]

Commandes
  tasks list [--all] [--category <c>] [--before <YYYY-MM-DD>] [--limit <n>]
  tasks add <nom> [--priority <1-5>] [--category <c>] [--deadline <YYYY-MM-DD>] [--time <min>]
  tasks done <id>
  habits today
  habits done <id>
  agenda [--days <n>]
  okr [--kr <okrId>]

Options globales
  --json      sortie JSON brute
  --dry-run   n'ecrit rien, affiche ce qui serait envoye
`;

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

  const client = createCosmoClient();
  const session = await requireSession(client);

  if (domain === 'tasks' && (action === 'list' || action === undefined)) {
    const tasks = await listTasks(client, {
      completed: flags.all ? undefined : false,
      category: typeof flags.category === 'string' ? flags.category : undefined,
      deadlineBefore: typeof flags.before === 'string' ? flags.before : undefined,
      limit: flags.limit ? Number(flags.limit) : undefined,
    });
    output(tasks, flags);
    return;
  }

  if (domain === 'tasks' && action === 'add') {
    const name = rest.join(' ');
    const input = {
      name,
      priority: flags.priority ? Number(flags.priority) : undefined,
      category: typeof flags.category === 'string' ? flags.category : undefined,
      deadline: typeof flags.deadline === 'string' ? flags.deadline : undefined,
      estimatedTime: flags.time ? Number(flags.time) : undefined,
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

  if (domain === 'tasks' && action === 'done') {
    const id = rest[0];
    if (flags['dry-run']) {
      output({ dryRun: true, wouldComplete: id }, flags);
      return;
    }
    output(await completeTask(client, id), flags);
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
      days: flags.days ? Number(flags.days) : 7,
    });
    output(events, flags);
    return;
  }

  if (domain === 'okr') {
    if (typeof flags.kr === 'string') {
      output(await listKeyResults(client, flags.kr), flags);
      return;
    }
    output(await listOkrs(client), flags);
    return;
  }

  console.error(`Commande inconnue : ${positional.join(' ')}\n`);
  console.log(USAGE);
  process.exitCode = 1;
}

run(process.argv.slice(2)).catch((err) => {
  console.error(`${err.name ?? 'Erreur'} : ${err.message}`);
  process.exitCode = 1;
});
