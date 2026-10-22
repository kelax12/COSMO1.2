// ═══════════════════════════════════════════════════════════════════
// C-106 — AUCUNE garde ne compare la grille STRIPE au code
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 CE QUI EXISTE, ET POURQUOI ÇA NE SUFFIT PAS. `org-tiers.parity.test.ts`
// verrouille la grille du Deno sur celle du TypeScript. Deux copies du dépôt
// l'une contre l'autre : elles peuvent être d'accord et toutes les deux
// fausses. Rien ne confronte l'une ou l'autre aux prix réellement
// ENREGISTRÉS chez Stripe. Les 8 prix live ont été vérifiés UNE fois, le
// 2026-08-26.
//
// 🔴 ET LE MODE DE DÉFAILLANCE EST SILENCIEUX. La dérivation annuelle refuse
// de choisir entre deux candidates et rend `yearly_unavailable` : un DOUBLON
// de prix chez Stripe coupe donc l'encaissement annuel sans rien casser, sans
// rien logger, et sans qu'un client comprenne pourquoi le bouton ne marche
// pas. Un doublon se crée en trois clics dans le Dashboard.
//
// ── CE QUE CE SCRIPT VÉRIFIE ────────────────────────────────────────
//
//   1. chaque palier payant a EXACTEMENT UN prix mensuel actif et EXACTEMENT
//      UN prix annuel actif. Zéro, c'est un encaissement impossible ; deux,
//      c'est `yearly_unavailable` ;
//   2. le montant de chaque prix correspond au centime à la grille du code,
//      annuel compris (dérivé par `ENTERPRISE_YEARLY_DISCOUNT`) ;
//   3. la devise est l'euro et le `tax_behavior` est `inclusive` — décision
//      DÉFINITIVE du 2026-08-26 : tout client est un consommateur, donc les
//      prix sont TTC (`docs/LEGAL.md`, `docs/STRIPE-LIVE.md`).
//
// ── POURQUOI CE JOB N'EST PAS PLANIFIÉ AUJOURD'HUI ──────────────────
//
// ⚠️ Il exige `STRIPE_SECRET_KEY` en secret Actions, et l'énoncé de C-106 le
// dit : « à poser avec la bascule, pas avant ». Le planifier maintenant
// produirait un job rouge chaque jour sur un secret qu'on a décidé de ne pas
// poser — et un rouge permanent finit ignoré, ce qui vaut moins que pas de
// job du tout.
//
// 🔴 LE JOUR DE LA BASCULE, DEUX GESTES, PAS UN :
//   1. poser `STRIPE_SECRET_KEY` dans les secrets Actions ;
//   2. DÉCOMMENTER le `schedule:` de `.github/workflows/stripe-prices.yml`.
//   Le second est celui qu'on oublie. Il est écrit ici pour cette raison.
//
// ⚠️ La facturation entreprise est DÉSACTIVÉE (décision 2026-08-24, pas de
// micro-entreprise), et la prod tourne sur une clé Stripe de TEST. Ce script
// sait donc dire, au passage, LEQUEL des deux modes il a interrogé.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const RACINE = process.cwd();

/**
 * La grille du code, recopiée ? NON : LUE dans `premium-config.ts`.
 *
 * 🔴 Une garde qui compare Stripe à une COPIE de la grille compare Stripe à
 * elle-même le jour où la copie diverge. C'est exactement le reproche fait à
 * `org-tiers.parity.test.ts` — deux copies du dépôt l'une contre l'autre —,
 * et le reproduire ici viderait ce script de son objet.
 *
 * ⚠️ La source est LUE ET ANALYSÉE, pas importée : Node n'exécute pas un
 * `.ts`, et ajouter un chargeur TypeScript pour quatre lignes de littéral
 * coûterait plus que ce qu'il rend. L'analyse échoue bruyamment si le fichier
 * change de forme — c'est le contrôle `paliers.length` plus bas.
 *
 * ⚠️ `ENTERPRISE_YEARLY_DISCOUNT` et l'arrondi sont eux aussi lus à la
 * source : réécrire la dérivation annuelle ici en ferait une TROISIÈME copie,
 * et c'est la dérivation annuelle qui porte le défaut de C-106.
 */
export function grilleDuCode(source) {
  const src = source
    ?? readFileSync(join(RACINE, 'src', 'modules', 'billing', 'premium-config.ts'), 'utf8');

  const bloc = /const ENTERPRISE_PRICING_TIERS = \[([\s\S]*?)\] as const;/.exec(src);
  if (!bloc) {
    throw new Error(
      "`ENTERPRISE_PRICING_TIERS` introuvable dans premium-config.ts : la grille a "
        + 'changé de forme, et ce script ne sait plus la lire.',
    );
  }
  const paliers = [...bloc[1].matchAll(
    /\{\s*key:\s*'([a-z0-9]+)'[^}]*?priceEurPerMonth:\s*([\d.]+)\s*\}/g,
  )].map((m) => ({ key: m[1], priceEurPerMonth: Number(m[2]) }));

  const remise = /const ENTERPRISE_YEARLY_DISCOUNT = ([\d.]+);/.exec(src);
  if (!remise) throw new Error('`ENTERPRISE_YEARLY_DISCOUNT` introuvable dans premium-config.ts.');
  const remiseAnnuelle = Number(remise[1]);

  // La même dérivation que le produit : équivalent mensuel ARRONDI, puis ×12.
  // L'ordre compte — dériver du brut donnerait un centime d'écart avec « 12 ×
  // le prix affiché », et un client a raison de se fier à sa multiplication.
  const arrondi = (n) => Math.round(n * 100) / 100;
  const totalAnnuelEur = (mensuel) => arrondi(arrondi(mensuel * (1 - remiseAnnuelle)) * 12);

  return { paliers, remiseAnnuelle, totalAnnuelEur };
}

/** Liste tous les prix ACTIFS de Stripe (pagination comprise). */
export async function prixStripe({ cle, fetchImpl = fetch }) {
  const out = [];
  let apres = null;
  for (let page = 0; page < 20; page += 1) {
    const url = new URL('https://api.stripe.com/v1/prices');
    url.searchParams.set('limit', '100');
    url.searchParams.set('active', 'true');
    url.searchParams.set('expand[]', 'data.product');
    if (apres) url.searchParams.set('starting_after', apres);
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${cle}` } });
    if (!res.ok) throw new Error(`API Stripe : HTTP ${res.status} ${await res.text()}`);
    const j = await res.json();
    out.push(...j.data);
    if (!j.has_more) return out;
    apres = j.data[j.data.length - 1].id;
  }
  throw new Error('Plus de 2000 prix actifs : pagination interrompue par sécurité.');
}

/**
 * Le palier auquel un prix appartient, DÉRIVÉ de ses `metadata`.
 *
 * ⚠️ `metadata.cosmo_tier` et pas le nom du produit : un nom se change sans
 * conséquence apparente, et la mémoire du dépôt est formelle — « le palier se
 * redérive du price ID, jamais des metadata ». Ici c'est l'inverse qui est
 * vrai et il faut le dire : on ne CHOISIT pas un prix d'après ses metadata
 * (ça, c'est le rôle du serveur, qui le fait par identifiant), on VÉRIFIE
 * qu'un prix enregistré chez Stripe correspond bien au palier qu'il annonce.
 * La distinction est celle entre décider et contrôler.
 */
export function palierDe(prix) {
  return prix.metadata?.cosmo_tier ?? prix.product?.metadata?.cosmo_tier ?? null;
}

/** Le rapprochement grille du code ↔ prix Stripe. */
export function rapprocher({ paliers, totalAnnuelEur }, prix) {
  const erreurs = [];
  const tableau = [];
  const payants = paliers.filter((p) => p.priceEurPerMonth > 0);

  for (const palier of payants) {
    for (const [intervalle, attenduEur] of [
      ['month', palier.priceEurPerMonth],
      ['year', totalAnnuelEur(palier.priceEurPerMonth)],
    ]) {
      const candidats = prix.filter(
        (p) => palierDe(p) === palier.key && p.recurring?.interval === intervalle,
      );
      const attenduCts = Math.round(attenduEur * 100);
      tableau.push({ palier: palier.key, intervalle, attenduCts, trouves: candidats.length });

      if (candidats.length === 0) {
        erreurs.push(
          `\`${palier.key}\` / ${intervalle} : AUCUN prix actif chez Stripe.\n`
            + "    L'encaissement de ce palier est impossible.",
        );
        continue;
      }
      if (candidats.length > 1) {
        erreurs.push(
          `\`${palier.key}\` / ${intervalle} : ${candidats.length} prix actifs `
            + `(${candidats.map((c) => c.id).join(', ')}).\n`
            + "    🔴 C'est le mode de défaillance SILENCIEUX de C-106 : la dérivation\n"
            + '    refuse de choisir et rend `yearly_unavailable`. Le bouton ne marche\n'
            + '    plus, rien ne casse, personne n est prévenu. Archiver le doublon.',
        );
        continue;
      }
      const p = candidats[0];
      if (p.unit_amount !== attenduCts) {
        erreurs.push(
          `\`${palier.key}\` / ${intervalle} : Stripe annonce ${p.unit_amount} centimes, `
            + `la grille du code ${attenduCts}.\n`
            + '    Un client verrait un montant et en paierait un autre.',
        );
      }
      if (p.currency !== 'eur') {
        erreurs.push(`\`${palier.key}\` / ${intervalle} : devise \`${p.currency}\`, attendu \`eur\`.`);
      }
      if (p.tax_behavior !== 'inclusive') {
        erreurs.push(
          `\`${palier.key}\` / ${intervalle} : \`tax_behavior\` vaut \`${p.tax_behavior}\`, `
            + 'attendu `inclusive`.\n'
            + '    Décision DÉFINITIVE du 2026-08-26 : tout client est un consommateur,\n'
            + '    donc les prix affichés sont TTC (Conso. art. L112-1). Un prix `exclusive`\n'
            + '    ferait payer la TVA en plus à un particulier.',
        );
      }
    }
  }
  return { erreurs, tableau };
}

// ── Exécution ──────────────────────────────────────────────────────

const estLanceDirectement =
  process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].split(sep).join('/')}`).href;

if (estLanceDirectement) {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle) {
    console.error(
      '✖ STRIPE_SECRET_KEY absente. Ce script interroge la grille RÉELLEMENT\n'
        + '  enregistrée chez Stripe : sans clé il ne compare rien, et un run vert\n'
        + '  répéterait ce que `org-tiers.parity.test.ts` dit déjà — deux copies du\n'
        + '  dépôt l une contre l autre.\n'
        + '\n'
        + '  ⚠️ C est ATTENDU aujourd hui : la facturation entreprise est désactivée\n'
        + '  (décision 2026-08-24) et le secret se pose AVEC la bascule live.',
    );
    process.exit(1);
  }

  const mode = cle.startsWith('sk_live_') ? 'LIVE' : cle.startsWith('sk_test_') ? 'TEST' : 'INCONNU';
  console.log(`Grille Stripe · mode ${mode}`);
  if (mode === 'TEST') {
    console.log(
      '⚠️ Clé de TEST. Ce run ne dit RIEN de la grille live — et la production\n'
        + '   COSMO tourne justement sur une clé de test depuis le début.',
    );
  }

  const grille = grilleDuCode();
  const prix = await prixStripe({ cle });
  console.log(`  ${prix.length} prix actif(s) chez Stripe, ${grille.paliers.length} palier(s) au code.`);

  const { erreurs, tableau } = rapprocher(grille, prix);
  for (const l of tableau) {
    console.log(
      `  ${l.palier.padEnd(6)} ${l.intervalle.padEnd(6)} attendu ${String(l.attenduCts).padStart(7)} cts  `
        + `${l.trouves} prix actif(s)`,
    );
  }

  if (erreurs.length > 0) {
    console.error('\n✖ Grille Stripe :');
    for (const e of erreurs) console.error(`  - ${e}\n`);
    process.exit(1);
  }
  console.log('\n✓ La grille Stripe correspond au code, au centime, sans doublon.');
}
