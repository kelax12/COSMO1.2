// ═══════════════════════════════════════════════════════════════════
// migrations-fichiers.mjs · LA LISTE DES MIGRATIONS QUE LES GARDES STATIQUES LISENT (ROB-02, V8.2)
//
// Depuis le 2026-11-09, deux dossiers :
//   · `supabase/migration/`  : l'HISTORIQUE fige, `NNN_nom.sql`, tout ce que
//     la production a recu jusqu'a la baseline. Plus aucun fichier n'y entre.
//   · `supabase/migrations/` : le dossier de la CLI, `<14 chiffres>_nom.sql`.
//     Son premier fichier, `<ts>_baseline.sql`, est un dump du schema de
//     production ; les suivants sont les migrations posterieures.
//
// Les gardes statiques (`validate:migrations`, `check:rls`, effacement,
// portabilite) jugent du TEXTE ecrit a la main. Elles lisent donc l'historique
// puis les migrations posterieures, JAMAIS la baseline : c'est un pg_dump, son
// effet est celui de l'historique (prouve par `schema-prod.yml`), et le relire
// compterait chaque policy deux fois.
//
// `num` sert aux cliquets des gardes (« juger le code NOUVEAU ») : le prefixe
// `NNN` d'un fichier d'historique, le `NNN` repris dans le nom d'une migration
// posterieure (`<ts>_245_cron_journal.sql`), sinon `NUM_NOUVELLE` : toute
// migration nee dans le dossier de la CLI est au-dessus de tous les cliquets.
// ⚠️ Pas de shebang : importe par les gardes et leurs temoins.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const DOSSIER_HISTORIQUE = 'supabase/migration';
export const DOSSIER_CLI = 'supabase/migrations';
export const RE_HISTORIQUE = /^\d{3}_[a-z0-9_]+\.sql$/;
export const RE_CLI = /^\d{14}_[a-z0-9_]+\.sql$/;
export const RE_BASELINE = /^\d{14}_baseline\.sql$/;
export const NUM_NOUVELLE = 10000;

/** Le numero de cliquet d'un fichier (voir l'en-tete). */
export function numero(fichier) {
  if (RE_HISTORIQUE.test(fichier)) return Number.parseInt(fichier.slice(0, 3), 10);
  const m = fichier.match(/^\d{14}_(\d{3})_/);
  return m ? Number.parseInt(m[1], 10) : NUM_NOUVELLE;
}

/**
 * Les `.sql` que les gardes statiques lisent, dans l'ordre d'application :
 * `[{ dossier, fichier, chemin, num, valide }]`. `valide` dit si le nom suit
 * le format de SON dossier ; la baseline est exclue.
 */
export function listerMigrations(racine = process.cwd()) {
  const lire = (dossier) => {
    const abs = join(racine, dossier);
    return existsSync(abs) ? readdirSync(abs).filter((f) => f.endsWith('.sql')).sort() : [];
  };
  const historique = lire(DOSSIER_HISTORIQUE).map((fichier) => ({
    dossier: DOSSIER_HISTORIQUE,
    fichier,
    chemin: join(racine, DOSSIER_HISTORIQUE, fichier),
    num: RE_HISTORIQUE.test(fichier) ? numero(fichier) : Number.NaN,
    valide: RE_HISTORIQUE.test(fichier),
  }));
  const cli = lire(DOSSIER_CLI)
    .filter((fichier) => !RE_BASELINE.test(fichier))
    .map((fichier) => ({
      dossier: DOSSIER_CLI,
      fichier,
      chemin: join(racine, DOSSIER_CLI, fichier),
      num: numero(fichier),
      valide: RE_CLI.test(fichier),
    }));
  return [...historique, ...cli];
}
