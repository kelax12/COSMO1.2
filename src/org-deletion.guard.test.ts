// ═══════════════════════════════════════════════════════════════════
// GARDE — supprimer une entreprise, et ce que ça ne doit PAS emporter
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (findings C-30 et C-39).
//
// Deux chemins menaient à la destruction des preuves légales d'une
// organisation, et le second n'avait été vu qu'après le premier :
//
//   C-30 — `delete-account` laisse volontairement la cascade agir quand le
//          propriétaire est le seul membre. `renewal_notices` (avis de
//          reconduction, Conso. art. L215-1) et `withdrawal_consents`
//          (renonciation au droit de rétractation, art. L221-28, 13°)
//          référençaient `organizations(id)` en ON DELETE CASCADE.
//   C-39 — un bouton rouge dans `/entreprise`, monté sur `isAdmin` et non sur
//          le propriétaire. Chemin bien plus court : aucune suppression de
//          compte n'était nécessaire.
//
// Scénario d'échec : une entreprise a deux admins. Le second, qui ne paie
// rien, supprime l'organisation. Le propriétaire continue d'être débité
// (l'abonnement Stripe court toujours), n'a plus d'organisation, et la preuve
// de sa renonciation a disparu avec.
//
// FORME : garde TEXTUELLE, comme `rgpd-erasure.guard.test.ts`. Elle ne prouve
// pas que la base se comporte ainsi — elle prouve qu'on n'a pas
// SILENCIEUSEMENT réintroduit une cascade ou relâché la garde de propriété.
// La vérification en base se fait acteur par acteur, dans une transaction
// annulée, à l'application de la mig. 138.
//
// ── LE TÉMOIN ────────────────────────────────────────────────────────
//
// Chaque détecteur est soumis à un échantillon qu'il DOIT voir. Sans ça, une
// regex cassée rendrait la garde verte pour toujours — la classe de défaut que
// `CLAUDE.md` documente sous « une garde se vérifie sur ce qu'elle REGARDE ».

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase/migration');

/** Les migrations, dans l'ordre d'application. */
const migrationFiles = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();

/**
 * La migration 138, ou une chaîne VIDE si elle a disparu.
 *
 * ⚠️ Lue ainsi, et pas à la racine du module, exprès : un `readFileSync` qui
 * lève au chargement fait échouer le FICHIER DE TEST ENTIER, sur une erreur
 * `ENOENT` qui ne dit rien du défaut. Avec ce repli, retirer la migration rend
 * chaque assertion rouge avec SON message — c'est-à-dire la liste exacte de ce
 * qui redevient cassé.
 */
function readMig138(): string {
  try {
    return readFileSync(join(MIGRATIONS, '138_evidence_survives_org_deletion.sql'), 'utf-8');
  } catch {
    return '';
  }
}

const mig138 = readMig138();

/** Une FK vers `organizations(id)` en CASCADE, sur la même ligne. */
const cascadeToOrg =
  /REFERENCES\s+public\.organizations\s*\(\s*id\s*\)\s+ON\s+DELETE\s+CASCADE/i;

describe('garde — les preuves survivent a la suppression d une org (C-30)', () => {
  it('TEMOIN : le detecteur voit une cascade vers organizations', () => {
    expect(
      cascadeToOrg.test(
        '  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,',
      ),
    ).toBe(true);
    expect(
      cascadeToOrg.test(
        '  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,',
      ),
    ).toBe(false);
  });

  for (const table of ['renewal_notices', 'withdrawal_consents']) {
    it(`${table} finit en ON DELETE SET NULL`, () => {
      // La derniere definition qui gagne est celle de la 138. On verifie
      // qu'elle existe ET qu'elle vise bien cette table.
      const re = new RegExp(
        String.raw`ALTER TABLE public\.${table}[\s\S]{0,400}?REFERENCES public\.organizations\(id\) ON DELETE SET NULL`,
      );
      expect(re.test(mig138), `${table} doit passer en SET NULL dans la mig. 138`).toBe(true);
    });

    it(`${table} n'est jamais purgee par delete-account`, () => {
      // Ces deux tables sont des PIECES A PRODUIRE, jamais un cache.
      const edge = readFileSync(
        join(process.cwd(), 'supabase/functions/delete-account/index.ts'),
        'utf-8',
      );
      const code = edge
        .split(String.fromCharCode(10))
        .map((line) => {
          const at = line.indexOf('//');
          return at === -1 ? line : line.slice(0, at);
        })
        .join(String.fromCharCode(10))
        .replace(/[/][*][^]*?[*][/]/g, ' ');
      expect(code).not.toContain(table);
    });
  }

  it('la mig. 138 conserve l immuabilite : SEUL le detachement est permis', () => {
    // ❌ Ne jamais elargir a « les UPDATE qui ne touchent que org_id » sans
    //    exiger NULL en cible : reaffecter une preuve a une AUTRE organisation
    //    serait une falsification, pas un detachement.
    expect(mig138).toContain('NEW.org_id IS NULL');
    expect(mig138).toContain('OLD.org_id IS NOT NULL');
    expect(mig138).toMatch(/RAISE EXCEPTION\s*\n?\s*'withdrawal_consents est une preuve append-only/);
  });

  it('la mig. 138 pose une contrainte UNIQUE, pas un simple index', () => {
    // C'est elle que vise l'`ON CONFLICT` implicite du `insert()` de
    // `renewal-notice` : un index seul laisserait passer un second avis pour
    // le meme terme.
    expect(mig138).toContain('ADD CONSTRAINT renewal_notices_org_period_key UNIQUE (org_id, period_end)');
  });

  it('aucune table de preuve ne finit en CASCADE depuis organizations', () => {
    // `payment_records` portait deja le bon motif ; les trois doivent le
    // partager. Une table de preuve ajoutee plus tard avec une cascade doit
    // echouer ici.
    //
    // 🔴 LA PREMIERE VERSION DE CE TEST REPONDAIT SANS MESURER. Elle cherchait
    // « la derniere occurrence de <table> suivie de org_id » dans tout le
    // depot concatene — mais cette occurrence n'est pas une DEFINITION de
    // colonne : c'est le `n.org_id` d'un corps de fonction de la mig. 126, qui
    // ne porte evidemment aucun `ON DELETE`. Le test etait donc VERT avant le
    // correctif, sur la cascade meme qu'il pretendait interdire. C'est
    // exactement le defaut que `CLAUDE.md` documente sous « une garde se
    // verifie sur ce qu'elle REGARDE ».
    //
    // On raisonne desormais par NUMERO DE MIGRATION : la derniere migration
    // qui declare la FK gagne, et elle doit la declarer en SET NULL.
    const evidenceTables = ['renewal_notices', 'withdrawal_consents', 'payment_records'];

    /** Numero de la derniere migration ou `table` declare sa FK vers org, par mode. */
    const lastDeclaring = (table: string, mode: 'CASCADE' | 'SET NULL'): number => {
      let best = -1;
      for (const file of migrationFiles) {
        const source = readFileSync(join(MIGRATIONS, file), 'utf-8');
        if (!source.includes(table)) continue;
        const re = new RegExp(
          String.raw`REFERENCES\s+public\.organizations\s*\(\s*id\s*\)\s+ON\s+DELETE\s+${mode}`,
          'i',
        );
        // La declaration doit etre dans le voisinage du nom de la table :
        // une migration peut en toucher plusieurs.
        const near = [...source.matchAll(new RegExp(String.raw`${table}[\s\S]{0,800}?`, 'g'))]
          .map((m) => source.slice(m.index ?? 0, (m.index ?? 0) + 800))
          .some((chunk) => re.test(chunk));
        if (near) best = Math.max(best, Number(file.slice(0, 3)));
      }
      return best;
    };

    const offenders = evidenceTables.filter(
      (table) => lastDeclaring(table, 'CASCADE') > lastDeclaring(table, 'SET NULL'),
    );

    expect(
      offenders,
      'Une piece a produire ne disparait pas avec son organisation : ON DELETE SET NULL.',
    ).toEqual([]);
  });

  it('TEMOIN : le detecteur de cascade voit une vraie cascade', () => {
    // Sans cette sonde, le test ci-dessus pourrait redevenir vert en ne
    // regardant plus rien — ce qu'il a DEJA fait une fois.
    const cascadeStillInRepo = migrationFiles
      .map((f) => readFileSync(join(MIGRATIONS, f), 'utf-8'))
      .some((source) => cascadeToOrg.test(source));
    expect(
      cascadeStillInRepo,
      'Plus AUCUNE cascade vers organizations dans le depot : soit le motif a '
        + 'change, soit le detecteur ne detecte plus rien. Verifier avant de '
        + 'supprimer ce temoin.',
    ).toBe(true);
  });
});

describe('garde — supprimer une entreprise est un geste de PROPRIETAIRE (C-39)', () => {
  it('la RPC exige le proprietaire, plus seulement un admin', () => {
    expect(mig138).toContain("RAISE EXCEPTION 'not_org_owner'");
    expect(mig138).toMatch(/v_owner IS NULL OR v_owner <> auth\.uid\(\)/);
  });

  it('les deux refus convergent : pas d oracle d existence', () => {
    // Organisation inexistante et organisation d'autrui doivent rendre le MEME
    // refus. Les distinguer revelerait qu'un UUID donne designe une vraie
    // organisation — la classe refermee par les mig. 100 et 109.
    const owner = mig138.slice(mig138.indexOf('FUNCTION public.delete_organization'));
    expect((owner.match(/not_org_owner/g) ?? []).length).toBe(1);
  });

  it('la RPC refuse tant qu un abonnement court', () => {
    // Sans cette garde, on supprime la ligne que le webhook Stripe vient
    // mettre a jour, et le client continue d'etre debite.
    expect(mig138).toContain("RAISE EXCEPTION 'org_has_active_subscription'");
    expect(mig138).toContain('FROM public.org_subscriptions');
  });

  it('les trois refus sont catalogues, en fr ET en en', () => {
    // Un identifiant non catalogue retombe sur le message generique : le refus
    // existerait sans que personne ne sache pourquoi.
    for (const locale of ['fr', 'en']) {
      const cat = JSON.parse(
        readFileSync(join(process.cwd(), `src/locales/${locale}/errors.json`), 'utf-8'),
      ) as { api: Record<string, string> };
      for (const code of ['not_org_owner', 'org_has_active_subscription', 'not_org_admin']) {
        expect(cat.api[code], `${locale}/errors.json → api.${code}`).toBeTruthy();
      }
    }
  });

  it('l ecran monte la zone rouge sur le PROPRIETAIRE, pas sur isAdmin', () => {
    // Ce n'est que l'affichage — la regle vit dans la RPC — mais un ecran qui
    // propose un geste que le serveur refusera est une impasse.
    const page = readFileSync(
      join(process.cwd(), 'src/pages/OrganizationPage.tsx'),
      'utf-8',
    );
    expect(page).toContain('{isOwner ? (');
  });

  it('le dialogue dit ce qu il advient de l abonnement et des preuves', () => {
    const dialog = readFileSync(
      join(process.cwd(), 'src/components/organization/DeleteOrganizationDialog.tsx'),
      'utf-8',
    );
    expect(dialog).toContain('deleteOrg.subscriptionFirst');
    expect(dialog).toContain('deleteOrg.evidenceKept');
  });
});
