// Lecture du code source du prérendu (`prerender/`), pour les gardes qui le
// lisent comme du TEXTE : l'importer exécuterait le build statique.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DOSSIER = join(__dirname, '..', '..', 'prerender');

/** Les fichiers `.ts` du prérendu, chemins POSIX relatifs à `prerender/`, triés (hors instantanés). */
function fichiers(rep = DOSSIER): string[] {
  return readdirSync(rep, { withFileTypes: true })
    .flatMap((e) => {
      const chemin = join(rep, e.name);
      if (e.isDirectory()) return e.name === 'instantanes' ? [] : fichiers(chemin);
      return e.name.endsWith('.ts') ? [relative(DOSSIER, chemin).split(sep).join('/')] : [];
    })
    .sort();
}

/** Le texte d'un fichier du prérendu, par exemple `lirePrerender('copies.ts')`. */
export const lirePrerender = (fichier: string): string => readFileSync(join(DOSSIER, fichier), 'utf8');

/** Tout le code du prérendu, concaténé : pour une garde qui cherche dans l'ensemble. */
export const lireToutLePrerender = (): string => fichiers().map(lirePrerender).join('\n');
