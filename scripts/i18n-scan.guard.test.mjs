// ═══════════════════════════════════════════════════════════════════
// i18n-scan.guard.test.mjs — un TEMOIN par angle mort du detecteur
//
// 🔴 POURQUOI CE FICHIER EXISTE
//
// `i18n:scan` est un cliquet bloquant a ZERO. Il a certifie « plus une seule
// chaine en dur » TROIS fois alors que le produit en affichait des dizaines :
// accents seuls (08-08), quatre formes aveugles (09-02), la forme ternaire et
// le vocabulaire ferme (09-03, mesures navigateur sur /en/login et /en/habits).
// A chaque fois la garde repondait — elle ne mesurait simplement pas ce
// qu'elle pretendait mesurer (cf. CLAUDE.md, § « une garde se verifie sur ce
// qu'elle REGARDE »).
//
// Chaque cas ci-dessous SOUMET au scanner reel une chaine qu'il doit voir, et
// echoue s'il ne la voit pas. C'est la seule facon de refermer un angle mort :
// relire le motif ne l'a jamais trouve, lui soumettre le cas si.
//
// Le script est execute TEL QUEL, dans un dossier temporaire pris pour cwd
// (`walk('src')` est relatif) — jamais re-implemente ici. Une garde qui
// reecrit la logique qu'elle teste ne teste que sa copie.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = resolve(process.cwd(), 'scripts/i18n-scan.mjs');

let dir;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'i18n-scan-guard-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Ecrit un fichier source factice et rend les chaines vues par le scanner. */
function scan(source, name = 'probe.tsx') {
  writeFileSync(join(dir, 'src', name), source, 'utf8');
  const r = spawnSync(process.execPath, [SCRIPT, '--list'], {
    cwd: dir,
    encoding: 'utf8',
  });
  // Le script sort en 1 des qu'il depasse le seuil : c'est le cas nominal ici.
  if (r.error) throw r.error;
  return (r.stdout + r.stderr)
    .split('\n')
    .filter((l) => l.trimStart().startsWith('·'))
    .map((l) => l.trim().replace(/^·\s*/, ''));
}

describe('i18n-scan : temoin de corpus', () => {
  // 🔴 SANS CE CAS, tous les autres pourraient passer sur un scanner casse qui
  // rendrait n'importe quoi. Il fixe le plancher : la mesure detecte, et elle
  // ne detecte pas tout.
  it('voit une phrase francaise evidente, et ignore ce qui n en est pas une', () => {
    const found = scan(`
      export const A = () => <p>Aucune tâche à afficher pour le moment</p>;
      export const KEY = t('tasks.emptyState.title');
      import { x } from '@/modules/tasks';
    `);
    expect(found).toContain('Aucune tâche à afficher pour le moment');
    expect(found).not.toContain('tasks.emptyState.title');
    expect(found).not.toContain('@/modules/tasks');
  });
});

describe('i18n-scan : angle mort 1 — la chaine n est pas le premier jeton', () => {
  // Mesure du 2026-09-03 : `/en/login` expose `button "Afficher le mot de
  // passe"`, ecrit exactement sous cette forme. Le motif (2) exigeait la chaine
  // immediatement apres `attribut=` ou `attribut={` : `cond ? ` n'est pas de
  // l'espace, donc la forme la plus courante du depot etait invisible.
  it('voit les DEUX branches d un ternaire dans un attribut', () => {
    const found = scan(`
      export const A = () => (
        <button aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} />
      );
    `);
    expect(found).toContain('Masquer le mot de passe');
    expect(found).toContain('Afficher le mot de passe');
  });

  it('voit les branches d un ternaire rendu comme enfant JSX', () => {
    const found = scan(`
      export const A = () => <span>{done ? 'Terminée' : 'Aucune échéance'}</span>;
    `);
    expect(found).toContain('Terminée');
    expect(found).toContain('Aucune échéance');
  });
});

describe('i18n-scan : angle mort 2 — le vocabulaire etait ferme', () => {
  // `aria-label="Masquer l'astuce"` (TaskTable) : attribut simple, capture par
  // le motif (2), REJETE par le vocabulaire. Ni accent, ni mot-outil.
  it('voit les verbes d interface sans accent', () => {
    const found = scan(`
      export const A = () => (
        <>
          <button aria-label="Masquer l'astuce" />
          <button aria-label="Epingler la note" />
          <button title="Sauvegarder" />
        </>
      );
    `);
    expect(found).toContain("Masquer l'astuce");
    expect(found).toContain('Epingler la note');
    expect(found).toContain('Sauvegarder');
  });
});

describe('i18n-scan : angle mort 3 — une chaine passee en argument', () => {
  // L'enonce disait que `CODE_QUOTING` classait « code » toute chaine passee en
  // argument de fonction. A la remesure c'etait faux du filtre (il s'applique
  // au CORPS capture, pas a l'instruction) mais vrai du produit : aucun motif
  // ne regardait un argument quelconque ni un element de tableau.
  it('voit un message passe a une fonction quelconque', () => {
    const found = scan(`
      export function e() {
        setError('Le nom est obligatoire');
      }
    `);
    expect(found).toContain('Le nom est obligatoire');
  });

  it('voit les elements francais d un tableau de libelles', () => {
    const found = scan(`
      const CSV_HEADERS = ['Nom du membre', 'Tâches terminées'];
    `);
    expect(found).toContain('Nom du membre');
    expect(found).toContain('Tâches terminées');
  });

  it('ne prend pas une CLE de traduction pour une phrase', () => {
    const found = scan(`
      export const A = () => <span>{t('taches.liste.vide')}</span>;
    `);
    expect(found).toHaveLength(0);
  });
});

describe('i18n-scan : angle mort 4 — la chaine est une VALEUR de propriete', () => {
  // 🔴 QUATRIEME fois que le cliquet certifie ZERO pendant que le produit parle
  // francais. Les motifs (4) et (5) ne regardent qu'une liste FERMEE de noms de
  // propriete (`label` `title` `name` `text` … `error` `message` `description`
  // `reason`) ; le motif (7) veut la chaine en PREMIER jeton de l'appel, donc
  // une accolade suffit a le perdre. Une propriete nommee autrement — ici
  // `general`, la cle d'erreur globale des formulaires de ce depot — n'etait
  // vue par AUCUN des huit motifs.
  //
  // Ce n'est pas theorique : les trois messages d'erreur de la modale de tache
  // (`save-task.ts` x2, `useTaskModal.ts`) etaient en dur sous cette forme,
  // affiches a l'ecran, pendant que `i18n:scan` rendait 0.
  it('voit une chaine posee en valeur de propriete dans un appel de fonction', () => {
    const found = scan(`
      export function submit() {
        setErrors({ general: 'Erreur lors de la suppression. Veuillez réessayer.' });
      }
    `);
    expect(found).toContain('Erreur lors de la suppression. Veuillez réessayer.');
  });

  // La meme forme, hors de tout appel : un objet de configuration pose a plat.
  it('voit une chaine posee en valeur de propriete dans un objet litteral', () => {
    const found = scan(`
      const STATE = { banner: 'Votre abonnement arrive à échéance' };
    `);
    expect(found).toContain('Votre abonnement arrive à échéance');
  });

  // 🔴 TEMOIN du temoin : elargir aux valeurs de propriete ne doit pas faire
  // entrer les CLES ni les valeurs techniques. Sans ce cas, on refermerait
  // l'angle mort en cassant le scanner pour tout le reste.
  it('ne prend pas une valeur technique de propriete pour une phrase', () => {
    const found = scan(`
      const CFG = {
        route: '/entreprise',
        ns: 'agenda',
        key: 'taches.liste.vide',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      };
    `);
    expect(found).toHaveLength(0);
  });
});
