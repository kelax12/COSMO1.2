import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────
// G-9 (faille.md) — garde d'invariant.
//
// L'analyse de risque de l'open redirect react-router conclut « exploitabilite
// nulle » sur un fait verifiable : AUCUNE destination de navigation n'est
// construite a partir d'un parametre d'URL. Ce n'est pas une propriete du
// framework, c'est une propriete de NOTRE code — donc elle peut se perdre
// silencieusement au prochain flux « retourne d'ou tu viens apres login ».
//
// Ce test la verrouille. Si tu tombes dessus en ajoutant une redirection :
// ne mets pas le fichier en liste blanche sans valider la destination contre
// une allowlist de chemins internes (cf. RESUMABLE_PAGES dans App.tsx).
//
// Detection sur DEUX axes, parce qu'une detection ligne-a-ligne ratait la
// forme la plus naturelle du bug (mesure : 1 cas sur 4 attrape) :
//   1. Teinte — on collecte les identifiants affectes depuis l'URL, puis on
//      signale toute cible de navigation qui les reference. C'est la forme
//      canonique : `const next = searchParams.get('next')` puis `navigate(next)`.
//   2. Fenetre glissante de 3 lignes — attrape les appels multi-lignes, ou
//      la lecture d'URL est passee directement en argument.
// ─────────────────────────────────────────────────────────────────────────

const SRC = join(__dirname, '..');

// Lecture d'une destination depuis l'URL courante : query string, hash,
// searchParams. `window.location.href` en est volontairement ABSENT : en
// pratique il apparait toujours a gauche d'une affectation (`… = data.url`),
// donc l'inclure faisait s'auto-detecter les redirections Stripe legitimes,
// dont la cible vient de l'Edge Function et non de l'URL. Il reste couvert
// comme CIBLE via NAV_SINK, et comme SOURCE via ASSIGN_FROM_URL (qui exige
// un `const`/`let`/`var`, donc une vraie lecture).
const URL_INPUT =
  /searchParams|location\.search|location\.hash|URLSearchParams|\bparams\.get\s*\(/;

/** Usage d'une valeur comme cible de navigation. */
const NAV_SINK =
  /\bnavigate\s*\(|\bto=\{|\bredirectTo\b|\bwindow\.location\s*=|\blocation\.href\s*=|\blocation\.assign\s*\(|\blocation\.replace\s*\(|\bwindow\.open\s*\(/;

/** `const next = searchParams.get('next')` → capture `next` comme teinte. */
const ASSIGN_FROM_URL = new RegExp(
  String.raw`(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=[^=]*(?:` +
    String.raw`searchParams|location\.search|location\.hash|URLSearchParams|window\.location\.href|params\.get\s*\(` +
    String.raw`)`
);

/**
 * Le SEUL assainisseur reconnu : `src/lib/safe-redirect.ts`. Une valeur qui
 * passe par lui n'est plus une destination arbitraire, c'est un chemin interne
 * validé de forme (refus de `//evil`, `/\evil`, `/%2f…`, `/javascript:…`, des
 * caractères de contrôle et du double encodage), couvert par 21 tests dans
 * `safe-redirect.test.ts`.
 *
 * 🔴 Cette exemption est NOMINATIVE, et elle doit le rester. La consigne de
 * l'en-tête reste entière : on ne met JAMAIS un fichier en liste blanche. Ce
 * qu'on reconnaît ici, c'est un appel de fonction dont le contrat est testé, et
 * seulement sur la ligne où il apparaît. Ajouter un second nom à cette liste
 * revient à écrire un second assainisseur : il lui faut ses propres tests
 * d'attaque AVANT d'être cité ici.
 */
const SANITIZER = /\b(?:postAuthRoute|safeRedirectPath)\s*\(/;

const WINDOW = 3;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Reproduit la logique de detection sur un contenu deja decoupe en lignes. */
function detect(lines: string[]): { line: number; why: string }[] {
  const hits: { line: number; why: string }[] = [];

  const tainted = new Set<string>();
  for (const l of lines) {
    const m = ASSIGN_FROM_URL.exec(l);
    // Une lecture d'URL qui traverse l'assainisseur sur la MEME ligne ne teinte
    // pas : la valeur affectee est deja un chemin interne valide.
    if (m && !SANITIZER.test(l)) tainted.add(m[1]);
  }

  lines.forEach((line, i) => {
    if (!NAV_SINK.test(line)) return;

    if (URL_INPUT.test(line)) {
      if (SANITIZER.test(line)) return;
      hits.push({ line: i, why: 'url-inline' });
      return;
    }

    for (const name of tainted) {
      // \b…\b pour ne pas confondre `next` et `nextStep`.
      if (new RegExp(String.raw`\b${name}\b`).test(line)) {
        hits.push({ line: i, why: `teinte:${name}` });
        return;
      }
    }

    const from = Math.max(0, i - WINDOW);
    const to = Math.min(lines.length, i + WINDOW + 1);
    for (let j = from; j < to; j++) {
      // Une lecture d'URL voisine qui passe par l'assainisseur n'est pas un
      // indice : c'est deja un chemin interne valide. Sans cette exception, la
      // seule ligne SAINE du fichier accuserait ses trois voisines.
      if (SANITIZER.test(lines[j])) continue;
      if (j !== i && URL_INPUT.test(lines[j])) {
        hits.push({ line: i, why: `url-proche:L${j + 1}` });
        return;
      }
    }
  });

  return hits;
}

describe('G-9 — aucune navigation alimentee par un parametre d URL', () => {
  it('ne trouve aucune cible de navigation derivee de l URL', () => {
    const offenders = walk(SRC).flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      return detect(lines).map(
        ({ line, why }) => `${relative(SRC, file)}:${line + 1} [${why}] → ${lines[line].trim()}`
      );
    });

    expect(offenders).toEqual([]);
  });

  it('detecte bien les 4 formes realistes de reintroduction', () => {
    // Auto-test de la garde : sans lui, un affaiblissement des regex passerait
    // inapercu — le test principal resterait vert en ne detectant plus rien.
    const probes: Record<string, string> = {
      inline: `navigate(searchParams.get('next') ?? '/');`,
      'deux-lignes': `const next = searchParams.get('returnTo');\nnavigate(next ?? '/');`,
      'location-href': `window.location.href = params.get('next')!;`,
      'multi-lignes': `navigate(\n  searchParams.get('next') ?? '/'\n);`,
      // L'exemption d'assainisseur ne doit couvrir QUE la valeur qui le
      // traverse. Un fichier qui assainit une destination et pas l'autre reste
      // coupable pour la seconde : c'est la forme la plus probable de la
      // regression, puisqu'elle se copie-colle a partir de la ligne saine.
      'assaini-a-cote': `const safe = postAuthRoute(searchParams.get('redirect'));\nconst evil = searchParams.get('next');\nnavigate(evil ?? '/');`,
      // Citer l'assainisseur ailleurs dans le fichier n'assainit rien : seule
      // compte la ligne ou la valeur est lue.
      'assainisseur-decoratif': `const raw = searchParams.get('next');\nconst home = postAuthRoute(null);\nnavigate(raw ?? home);`,
    };

    const undetected = Object.entries(probes)
      .filter(([, code]) => detect(code.split('\n')).length === 0)
      .map(([name]) => name);

    expect(undetected).toEqual([]);
  });

  it("n'accuse pas une destination qui traverse l'assainisseur", () => {
    // Le pendant du test precedent : la garde doit rester silencieuse sur la
    // forme validee, sinon la seule issue serait de mettre le fichier en liste
    // blanche, ce que son en-tete interdit. `safe-redirect.ts` refuse `//evil`,
    // `/\evil`, `/%2f…`, `/javascript:…`, les caracteres de controle et le
    // double encodage, et 21 tests le prouvent dans `safe-redirect.test.ts`.
    const sain = [
      `const redirectTo = postAuthRoute(searchParams.get('redirect'));`,
      `const query = redirectTo === '/dashboard' ? '' : \`?redirect=\${encodeURIComponent(redirectTo)}\`;`,
      `navigate(redirectTo, { replace: true });`,
    ];

    expect(detect(sain)).toEqual([]);
  });
});
