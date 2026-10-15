// ═══════════════════════════════════════════════════════════════════
// dump-check.mjs · RELIRE LE DERNIER DUMP CHIFFRE, SANS RIEN RESTAURER
//
// Appele par le job `dump-check` de `.github/workflows/restore-drill.yml`
// (trimestriel, C-86), apres le `gh run download` de l'artefact `db-dump`.
//
// 🔴 POURQUOI UN MODULE NODE, ET PAS LE SHELL QUI LE PRECEDAIT
//
// Depuis BK-1 (2026-10-13) le dump est chiffre (gpg AES-256, secret
// `BACKUP_PASSPHRASE`). Le shell qui le relisait avait trois angles morts,
// trouves le 2026-10-15 en le relisant avant de reactiver le workflow, et
// mesures avec gpg 2.4 :
//   · `gpg -d` sort en 0 sur un fichier OpenPGP NON chiffre (paquet
//     litteral, `gpg --store`) : un dump en clair habille en `.gpg` etait
//     « dechiffre ». Son canal d'etat, lui, ne porte ni BEGIN_DECRYPTION ni
//     DECRYPTION_OKAY : c'est la qu'on juge ;
//   · un artefact portant un `.dump.gpg` ET un `.dump` en clair passait :
//     seul le premier fichier chiffre etait regarde ;
//   · sous `set -euo pipefail`, `X=$(ls absent | head -1)` tue le script
//     AVANT la ligne `::error::` qui suit : rouge, sans dire pourquoi.
// Aucun de ces cas n'avait de temoin : du YAML ne se teste pas.
//
// CE QUE CE MODULE EXIGE, dans l'ordre ; chaque refus est un exit 1 :
//   1. l'artefact contient UN `*.dump.gpg` et RIEN d'autre (vide, absent ou
//      porteur d'un fichier en clair = refus, et le clair n'est pas ouvert) ;
//   2. la phrase secrete est la (32 caracteres au moins, comme db-backup) ;
//   3. le premier paquet OpenPGP est un chiffrement symetrique (tag 3) ;
//   4. gpg sort en 0 ET son canal d'etat porte BEGIN_DECRYPTION puis
//      DECRYPTION_OKAY, sans DECRYPTION_FAILED ;
//   5. le dechiffre commence par `PGDMP` et pese plus de 100 ko ;
//   6. `pg_restore --list` le relit, et les tables attendues y sont.
// Le dechiffre est efface en sortie, reussite ou echec.
//
// ❌ NE PAS CROIRE QUE CE CONTROLE REMPLACE LE DRILL. `pg_restore --list` lit
//    une table des matieres, il ne rejoue pas une ligne.
// 🔴 PAS DE SHEBANG (cf. `ops-alert.mjs`) : le temoin importe ce module.
//    Temoin : `scripts/dump-check.guard.test.mjs`.
// ═══════════════════════════════════════════════════════════════════
import { readdirSync, statSync, openSync, readSync, closeSync, rmSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

/** Un `pg_dump` qui echoue a mi-parcours rend un fichier VALIDE et minuscule.
 *  100 ko est tres en dessous du reel : un detecteur de troncature, pas une cible. */
export const TAILLE_MIN = 100_000;

/** Les tables sans lesquelles un dump ne vaut rien. Elles portent les donnees
 *  du produit ET le journal fiscal inalterable (`payment_records`, mig. 125,
 *  CGI art. 286-I-3° bis) : un dump qui ne le contient pas ne restaure pas
 *  une obligation legale. */
export const ATTENDUES = ['profiles', 'tasks', 'habits', 'events', 'okrs', 'categories', 'payment_records'];

export class RefusDump extends Error {}

/** 1. Exactement un `*.dump.gpg`, et rien d'autre. Rend son nom. */
export function classerArtefact(noms) {
  if (noms.length === 0) {
    throw new RefusDump('Artefact db-dump vide ou absent : aucun fichier a relire.');
  }
  const autres = noms.filter((n) => !n.endsWith('.dump.gpg'));
  if (autres.length > 0) {
    throw new RefusDump(
      `Artefact db-dump : fichier(s) non chiffre(s) (${autres.join(', ')}). `
        + 'Le depot est public : un dump en clair en artefact est une violation (BK-1).',
    );
  }
  if (noms.length !== 1) {
    throw new RefusDump(`Artefact db-dump : ${noms.length} fichiers .dump.gpg, un seul attendu.`);
  }
  return noms[0];
}

/** Le type du premier paquet OpenPGP (RFC 9580 § 4.2), ou null si l'octet
 *  n'est pas un en-tete OpenPGP. Ancien format : 10TTTTLL ; nouveau : 11TTTTTT. */
export function typePremierPaquet(octets) {
  if (!octets || octets.length === 0) return null;
  const b = octets[0];
  if ((b & 0x80) === 0) return null;
  return (b & 0x40) ? (b & 0x3f) : ((b >> 2) & 0x0f);
}

/** 3. Le fichier est-il CHIFFRE avant meme d'appeler gpg ? */
export function verifierChiffre(octets) {
  if (!octets || octets.length === 0) throw new RefusDump('Fichier .dump.gpg vide.');
  if (Buffer.from(octets).subarray(0, 5).toString('latin1') === 'PGDMP') {
    throw new RefusDump('Le .dump.gpg est un dump pg_dump EN CLAIR renomme : il n est pas chiffre.');
  }
  const tag = typePremierPaquet(octets);
  if (tag !== 3) {
    throw new RefusDump(
      `Le .dump.gpg ne commence pas par un chiffrement symetrique (paquet OpenPGP ${tag ?? 'illisible'}, `
        + 'attendu 3). db-backup.yml chiffre avec `gpg --symmetric` : ce fichier n en sort pas.',
    );
  }
}

/** 4. On juge sur ce que gpg a FAIT (canal d'etat), pas sur son seul code. */
export function verdictGpg(code, statut, erreur, stderr = '') {
  if (erreur) throw new RefusDump(`gpg n a pas pu etre lance (${erreur.code ?? erreur.message}).`);
  const lignes = String(statut ?? '').split(/\r?\n/);
  const porte = (mot) => lignes.some((l) => l === `[GNUPG:] ${mot}` || l.startsWith(`[GNUPG:] ${mot} `));
  if (code !== 0 || porte('DECRYPTION_FAILED')) {
    // Les lignes `gpg:` de stderr ne portent jamais la phrase : elles disent
    // POURQUOI (mauvaise phrase, fichier altere, trousseau illisible).
    const gpgLignes = String(stderr ?? '').split(/\r?\n/).filter((l) => l.startsWith('gpg:'));
    const causes = gpgLignes.filter((l) => /fail|error|bad|no such|invalid|no valid/i.test(l));
    const pourquoi = (causes.length ? causes : gpgLignes).slice(0, 2).join(' | ');
    throw new RefusDump(
      `Dump INDECHIFFRABLE (gpg code ${code}${porte('DECRYPTION_FAILED') ? ', DECRYPTION_FAILED' : ''}) : `
        + 'BACKUP_PASSPHRASE ne correspond pas, ou le fichier est altere. Sans la bonne phrase, '
        + `aucune sauvegarde ne se restaure (geste M-71).${pourquoi ? ` ${pourquoi}` : ''}`,
    );
  }
  if (!porte('BEGIN_DECRYPTION') || !porte('DECRYPTION_OKAY')) {
    throw new RefusDump(
      'gpg a rendu un fichier SANS l avoir dechiffre (ni BEGIN_DECRYPTION ni DECRYPTION_OKAY) : '
        + 'le .dump.gpg n etait pas chiffre.',
    );
  }
}

/** 5. Le dechiffre est-il un dump complet ? */
export function verifierClair(taille, entete) {
  if (Buffer.from(entete).subarray(0, 5).toString('latin1') !== 'PGDMP') {
    throw new RefusDump('Le dechiffre n est pas un dump pg_dump au format custom (en-tete PGDMP absent).');
  }
  if (taille < TAILLE_MIN) {
    throw new RefusDump(`Dump de ${taille} octets : trop petit pour etre complet.`);
  }
}

/** 6. Les tables attendues absentes de la table des matieres. L'espace final
 *  du motif empeche `tasks_archive` de passer pour `tasks`. */
export function tablesManquantes(toc, attendues = ATTENDUES) {
  return attendues.filter((t) => !new RegExp(`TABLE (DATA )?public ${t} `).test(toc));
}

function listerFichiers(dossier) {
  if (!existsSync(dossier)) return [];
  const sortie = [];
  const parcourir = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else sortie.push(relative(dossier, p).split('\\').join('/'));
    }
  };
  parcourir(dossier);
  return sortie.sort();
}

function lireDebut(chemin, n) {
  const fd = openSync(chemin, 'r');
  try {
    const b = Buffer.alloc(n);
    const lus = readSync(fd, b, 0, n, 0);
    return b.subarray(0, lus);
  } finally {
    closeSync(fd);
  }
}

/**
 * Le controle complet. Rend `{ exit, lines, resume }` plutot que de sortir
 * lui-meme, pour que le temoin l'execute sans tuer le process de test.
 * `executer` est `spawnSync` en production, un faux dans le temoin.
 * ⚠️ `lines` ne contient JAMAIS la phrase secrete : elle passe par stdin.
 */
export function relireDump({ dossier, phrase, attendues = ATTENDUES, executer = spawnSync }) {
  const lines = [];
  let clair = null;
  const resume = { fichier: null, taille: null, objets: null, manquantes: null, verdict: null };
  try {
    const nom = classerArtefact(listerFichiers(dossier));
    const chiffre = join(dossier, nom);
    resume.fichier = basename(nom);
    if (!phrase || phrase.length < 32) {
      throw new RefusDump('Secret BACKUP_PASSPHRASE absent ou trop court : le dump ne se dechiffre pas.');
    }
    verifierChiffre(lireDebut(chiffre, 16));

    clair = chiffre.slice(0, -'.gpg'.length);
    const g = executer(
      'gpg',
      ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0',
        '--status-fd', '1', '-o', clair, '-d', chiffre],
      { input: phrase, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 600_000 },
    );
    verdictGpg(g.status, g.stdout, g.error, g.stderr);
    if (!existsSync(clair)) throw new RefusDump('gpg n a produit aucun fichier dechiffre.');

    const taille = statSync(clair).size;
    resume.taille = taille;
    verifierClair(taille, lireDebut(clair, 5));

    const t = executer('pg_restore', ['--list', clair], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600_000,
    });
    if (t.error || t.status !== 0) {
      throw new RefusDump(
        `pg_restore --list a echoue (code ${t.status ?? t.error?.code}) : dump corrompu. `
          + String(t.stderr ?? '').trim().split('\n').slice(0, 3).join(' | '),
      );
    }
    const toc = String(t.stdout ?? '');
    resume.objets = toc.split('\n').filter((l) => l.trim() !== '').length;
    resume.manquantes = tablesManquantes(toc, attendues);
    if (resume.manquantes.length > 0) {
      throw new RefusDump(`Tables absentes du dump : ${resume.manquantes.join(' ')}`);
    }
    resume.verdict = 'ok';
    lines.push(
      `::notice title=dump-check::Dump chiffre dechiffre et relisible : ${resume.fichier}, `
        + `${taille} octets en clair, ${resume.objets} objets, toutes les tables attendues presentes.`,
    );
    return { exit: 0, lines, resume };
  } catch (e) {
    if (!(e instanceof RefusDump)) throw e;
    resume.verdict = e.message;
    lines.push(`::error title=dump-check::${e.message}`);
    return { exit: 1, lines, resume };
  } finally {
    // Le clair ne survit pas au controle, quelle que soit l'issue.
    if (clair) rmSync(clair, { force: true });
  }
}

/** Le resume de job, en Markdown. */
export function resumeMarkdown(resume, runId) {
  return [
    '### Relecture du dump chiffre (trimestriel, sans restauration)',
    '',
    '```',
    `run db-backup : ${runId ?? '?'}`,
    `fichier       : ${resume.fichier ?? '?'}`,
    `en clair      : ${resume.taille ?? '?'} octets (efface apres controle)`,
    `objets        : ${resume.objets ?? '?'}`,
    `tables        : ${resume.manquantes == null ? '?' : resume.manquantes.length ? `MANQUANTES -> ${resume.manquantes.join(' ')}` : 'toutes presentes'}`,
    `verdict       : ${resume.verdict}`,
    '```',
    '',
    'Ceci ne remplace PAS le drill : un dump relisible n est pas un dump restaure.',
    '',
  ].join('\n');
}

// Entree CLI. `import.meta.main` n'existe pas en Node 20 : on compare argv.
if (process.argv[1] && process.argv[1].endsWith('dump-check.mjs')) {
  const { appendFileSync } = await import('node:fs');
  const { exit, lines, resume } = relireDump({
    dossier: process.argv[2] ?? 'dump',
    phrase: process.env.BACKUP_PASSPHRASE,
  });
  for (const l of lines) console.log(l);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumeMarkdown(resume, process.env.RUN_ID));
  }
  process.exit(exit);
}
