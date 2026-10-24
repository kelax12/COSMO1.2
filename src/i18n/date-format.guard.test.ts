// ═══════════════════════════════════════════════════════════════════
// GARDE — aucune date (ni nombre) formatée hors de la locale de l'app
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (AM-3 de docs/I18N.md, nommé le 2026-09-16, outillé ici).
//
// La locale de l'app (`localeStore`) n'est PAS celle du navigateur. Tout
// formatage qui ne passe pas par `@/i18n/format` (`formatDate`, `formatTime`,
// `formatNumber`, `getDateLocale`, `getIntlTag`) choisit sa langue tout seul :
//
//   - `toLocaleDateString()` sans argument   → langue du NAVIGATEUR ;
//   - `toLocaleDateString('fr-FR')`           → français pour tout le monde ;
//   - `{ locale: fr }` de `date-fns`          → idem ;
//   - `['Lundi', 'Mardi', …]` écrits à la main → idem, sans même passer par Intl.
//
// Aucune autre gate ne le voit : `i18n:scan` cherche des phrases françaises
// (un « Lundi » isolé n'en est pas une), `i18n:pages` mesure les pages
// PRÉRENDUES (l'app connectée n'en a aucune), et le rendu est correct pour
// quiconque a son navigateur dans la langue de l'app, soit l'auteur du code.
//
// 1ʳᵉ exécution (2026-10-22), quatre défauts : jours de la récurrence en
// français en dur (`RecurrenceDaysModal`), dates du bilan partagé en `fr-FR`
// par défaut (`recap-canvas`), nombre de l'infobulle des graphiques et mois du
// sélecteur de calendrier à la langue du navigateur (`ui/chart`, `ui/calendar`).
//
// ✅ HORS PÉRIMÈTRE, par construction des motifs et non par allowlist :
//   - `'en-CA'` : idiome `YYYY-MM-DD` en heure locale, PAS un formatage
//     anglais. Il a sa propre garde, `src/i18n/en-ca-guard.test.ts`.
//   - `Intl.DateTimeFormat().resolvedOptions()` : lit le FUSEAU, ne formate rien.
//   - `date-fns` `format(d, 'yyyy-MM-dd')` : motif numérique, sans langue.
//
// ❌ Ne JAMAIS ajouter une entrée d'allowlist pour faire passer. Une entrée =
//    UN cas, avec sa raison ; une entrée qui ne détecte plus rien est refusée.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = 'src';

/** Le seul module autorisé à toucher aux locales (c'est sa raison d'être). */
const EXEMPT_FILES = new Set(['src/i18n/format.ts']);

const isTestFile = (path: string): boolean =>
  /\.(test|spec)\.tsx?$/.test(path) || path.includes('/__test__/') || path.startsWith('src/test/');

function listSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listSources(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(relative('.', full).replace(/\\/g, '/'));
  }
  return out;
}

/**
 * Retire les commentaires : la documentation des pièges (celle de `format.ts`,
 * celle de ce fichier) ne doit pas déclencher la garde. Une ligne `//` en fin
 * de code est retirée aussi, sauf dans une URL (`https://`).
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const DAY_MONTH_NAMES = [
  // fr
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
  'janvier', 'février', 'fevrier', 'avril', 'juillet', 'août', 'aout',
  'septembre', 'octobre', 'novembre', 'décembre', 'decembre',
  // en
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'june', 'july', 'august', 'september',
  'october', 'november', 'december',
];
const NAME_LITERAL = new RegExp(`['"\`](${DAY_MONTH_NAMES.join('|')})['"\`]`, 'gi');

interface Detector {
  id: string;
  /** Ce que l'utilisateur voit quand le motif passe. */
  why: string;
  /** Renvoie un extrait par occurrence. */
  find: (code: string) => string[];
  /** Exemple que le détecteur DOIT attraper (témoin). */
  positive: string;
  /** Exemple légitime qu'il ne doit PAS attraper. */
  negative: string;
}

const matchAll = (re: RegExp) => (code: string) => [...code.matchAll(re)].map((m) => m[0]);

const DETECTORS: Detector[] = [
  {
    id: 'toLocale-sans-locale',
    why: 'sans argument, toLocale*String() prend la langue du NAVIGATEUR, pas celle de l’app',
    find: matchAll(/\.toLocale(?:Date|Time)?String\(\s*\)/g),
    positive: 'const s = d.toLocaleDateString();',
    negative: "const s = d.toLocaleDateString('en-CA');",
  },
  {
    id: 'toLocale-locale-en-dur',
    why: 'une étiquette écrite en dur fige la langue pour tous les utilisateurs',
    find: matchAll(/\.toLocale(?:Date|Time)?String\(\s*['"`](?!en-CA['"`])[^'"`]*['"`]/g),
    positive: "const s = d.toLocaleDateString('fr-FR', { day: 'numeric' });",
    negative: 'const s = d.toLocaleDateString(getIntlTag(), { day: "numeric" });',
  },
  {
    id: 'Intl-locale-en-dur',
    why: 'Intl.*Format avec une étiquette en dur fige la langue pour tous',
    find: matchAll(
      /\bIntl\.(?:DateTimeFormat|RelativeTimeFormat|NumberFormat|ListFormat|PluralRules|DisplayNames)\(\s*['"`](?!en-CA['"`])[^'"`]*['"`]/g
    ),
    positive: "new Intl.DateTimeFormat('fr', { month: 'long' })",
    negative: "new Intl.DateTimeFormat('en-CA', { year: 'numeric' })",
  },
  {
    id: 'Intl-sans-locale',
    why: 'Intl.*Format() sans étiquette prend la langue du NAVIGATEUR',
    find: matchAll(
      /\bIntl\.(?:DateTimeFormat|RelativeTimeFormat|NumberFormat|ListFormat)\(\s*(?:\)|undefined\b)(?!\s*\.resolvedOptions\(\))/g
    ),
    positive: 'new Intl.NumberFormat().format(n)',
    negative: 'Intl.DateTimeFormat().resolvedOptions().timeZone',
  },
  {
    id: 'date-fns-locale-importee',
    why: 'la locale date-fns se prend par getDateLocale(), jamais importée',
    find: matchAll(/from\s+['"]date-fns\/locale(?:\/[^'"]*)?['"]/g),
    positive: "import { fr } from 'date-fns/locale';",
    negative: "import { format } from 'date-fns';",
  },
  {
    id: 'date-fns-locale-en-dur',
    why: '{ locale: fr } fige la langue de date-fns',
    find: matchAll(/\blocale\s*:\s*(?:fr|enUS|enGB|es|de|it)\b(?!\s*[.(])/g),
    positive: "format(d, 'PPP', { locale: fr })",
    negative: "format(d, 'PPP', { locale: getDateLocale() })",
  },
  {
    id: 'locale-par-defaut-en-dur',
    why: 'un paramètre `locale = \'fr-FR\'` rend le français à tout appelant qui l’omet',
    find: matchAll(/\blocale\??\s*(?::\s*string\s*)?=(?!=)\s*['"`][a-z]{2}(?:-[A-Z]{2})?['"`]/g),
    positive: "function f(day: string, locale = 'fr-FR') {}",
    negative: "if (locale === 'fr') {}",
  },
  {
    id: 'date-fns-format-textuel-sans-locale',
    why: "format(d, 'EEEE') sans { locale } rend de l’ANGLAIS pour tout le monde (défaut date-fns)",
    // Appel nu (pas `rtf.format(…)`), motif littéral, parenthèse fermée juste
    // après : aucune option, donc aucune locale. Seuls les motifs qui
    // produisent du TEXTE comptent (jour, mois en lettres, AM/PM, P/p…) :
    // `yyyy-MM-dd` ou `HH:mm` n'ont pas de langue.
    find: (code) =>
      [...code.matchAll(/(?<![.\w])format\(\s*[^,()]+(?:\([^()]*\))?\s*,\s*(['"`])([^'"`]*)\1\s*\)/g)]
        .filter((m) => /E|MMM|LLL|ccc|eee|P|p|a|b|B|QQQ|G|do/.test(m[2].replace(/'[^']*'/g, '')))
        .map((m) => m[0]),
    positive: "const s = format(parseISO(iso), 'EEEE d MMMM');",
    negative: "const s = format(d, 'yyyy-MM-dd'); rtf.format(-2, 'day');",
  },
  {
    id: 'noms-jours-mois-a-la-main',
    why: 'des noms de jours ou de mois écrits à la main ne suivent aucune locale',
    find: (code) => {
      const names = new Set([...code.matchAll(NAME_LITERAL)].map((m) => m[1].toLowerCase()));
      return names.size >= 3 ? [[...names].sort().join(', ')] : [];
    },
    positive: "const DAYS = ['Lundi', 'Mardi', 'Mercredi'];",
    negative: "const label = 'Lundi matin';",
  },
];

/**
 * UNE ENTRÉE PAR CAS LÉGITIME, avec sa raison. Clé : `fichier::détecteur`.
 * Une entrée qui ne détecte plus rien est refusée (test plus bas) : elle
 * masquerait un futur vrai défaut dans le même fichier.
 */
const ALLOWLIST: Record<string, string> = {
  'src/lib/task-import/dates.ts::noms-jours-mois-a-la-main':
    'vocabulaire LU dans un fichier importé (« 3 mars », « March 3 ») pour le convertir en date ; rien n’est affiché',
  'src/modules/lists/repository.ts::noms-jours-mois-a-la-main':
    'noms des listes de la démo (« Lundi », « Mardi ») : des TITRES de seed, traduits par l’overlay `en` du même fichier (mécanisme seed-i18n)',
};

interface Hit {
  file: string;
  detector: string;
  excerpt: string;
}

function scan(files: string[]): Hit[] {
  const hits: Hit[] = [];
  for (const file of files) {
    const code = stripComments(readFileSync(file, 'utf8'));
    for (const d of DETECTORS) {
      for (const excerpt of d.find(code)) hits.push({ file, detector: d.id, excerpt });
    }
  }
  return hits;
}

const FILES = listSources(ROOT).filter((f) => !isTestFile(f) && !EXEMPT_FILES.has(f));
const HITS = scan(FILES);

describe('formats de date et de nombre — locale de l’app uniquement (AM-3)', () => {
  it('balaie réellement src/ (témoin : un chemin cassé rendrait la garde verte à vide)', () => {
    expect(FILES.length).toBeGreaterThan(500);
    expect(FILES).toContain('src/components/event-modal/RecurrenceDaysModal.tsx');
  });

  it.each(DETECTORS)('témoin $id : attrape son exemple positif, laisse passer le négatif', (d) => {
    expect(d.find(d.positive), `${d.id} ne détecte plus rien`).not.toEqual([]);
    expect(d.find(d.negative), `${d.id} attrape un cas légitime`).toEqual([]);
  });

  it('aucun formatage hors de @/i18n/format, hors allowlist', () => {
    const offenders = HITS.filter((h) => !(`${h.file}::${h.detector}` in ALLOWLIST)).map((h) => {
      const why = DETECTORS.find((d) => d.id === h.detector)?.why;
      return `${h.file} [${h.detector}] ${h.excerpt}\n    → ${why}`;
    });
    expect(
      offenders,
      'Passer par @/i18n/format (formatDate, formatTime, formatNumber, getDateLocale, getIntlTag).\n' +
        offenders.join('\n')
    ).toEqual([]);
  });

  it.each(Object.entries(ALLOWLIST))('allowlist %s : toujours justifiée et toujours vivante', (key, reason) => {
    expect(reason.trim().length).toBeGreaterThan(20);
    const live = HITS.some((h) => `${h.file}::${h.detector}` === key);
    expect(live, `${key} ne détecte plus rien : retirer l'entrée`).toBe(true);
  });
});
