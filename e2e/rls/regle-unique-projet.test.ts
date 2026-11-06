// ═══════════════════════════════════════════════════════════════════
// RLS · une seule règle « qui voit quel projet d'équipe » (ARC-02, mig. 243)
//
// POURQUOI CE FICHIER EXISTE
//
// Les listes du mode entreprise se lisent par des RPC `SECURITY DEFINER`
// (`get_my_team_*`, mig. 113 et suivantes), qui ne passent PAS par la RLS :
// leur périmètre vient de `my_team_project_ids()`. Les lectures directes
// (fiche, Realtime, tables filles) passent par les policies, donc par
// `can_access_team_project()`. Deux textes pour une règle : les mig. 164 et
// 190 les ont fait diverger une fois (réconciliées par la 194), et rien ne
// l'aurait vu, puisque chaque chemin, pris seul, isole correctement.
//
// La mig. 243 pose `can_access_team_project` sur `my_team_project_ids`. Ce
// fichier vérifie ce que ça doit garantir : pour chaque acteur type, la
// lecture DIRECTE sous RLS et la RPC rendent EXACTEMENT les mêmes lignes, sur
// toutes les lectures qui ont une RPC.
//
// LES ACTEURS (organisation O, plus O2 pour le tiers)
//   A   admin de O
//   M   manager de C, dans aucune équipe : voit par son sous-arbre
//   C   membre de l'équipe T1, porteuse de P1
//   PM  membre DIRECT du projet P2 (team_project_members), dans aucune équipe
//   TT  membre de l'équipe T2, ASSOCIÉE à P1 (team_project_teams) : transverse
//   L   membre de O sans aucun lien
//   F   ANCIEN membre : équipe T1 et projet P3, puis retiré de O
//   X   admin d'une autre organisation : tiers
//
// LE DÉCOR. P0 sans équipe (toute l'org), P1 équipe T1 + T2 associée,
// P2 et P3 équipe T3 (vide). Une tâche à la CORBEILLE dans P1, une dépendance
// vers elle, une dépendance de projet vers P3 (cloisonné pour tous sauf A) :
// ce sont les deux cellules où policies et RPC divergeaient avant la 243.
//
// LA MESURE. Lecture directe et RPC par le client de l'acteur (JWT + clé
// anon : la RLS réelle, `helpers.ts`). `service_role` ne sert qu'au décor.
// Un témoin par acteur fixe en plus l'ensemble ATTENDU des projets visibles :
// sans lui, deux chemins également faux (ou également vides) seraient égaux.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, createTestUser, deleteTestUsers, TestUser } from './helpers';

type Who = 'A' | 'M' | 'C' | 'PM' | 'TT' | 'L' | 'F' | 'X';
type Row = Record<string, unknown>;
const ACTEURS: Who[] = ['A', 'M', 'C', 'PM', 'TT', 'L', 'F', 'X'];
const uuid = () => crypto.randomUUID();

const ids = {
  O: uuid(), O2: uuid(),
  T1: uuid(), T2: uuid(), T3: uuid(),
  P0: uuid(), P1: uuid(), P2: uuid(), P3: uuid(),
  TK0: uuid(), TK1a: uuid(), TK1b: uuid(), TK1d: uuid(), TK2: uuid(), TK3: uuid(),
  OK: uuid(), KR: uuid(),
};
const nomProjet = new Map<string, string>([[ids.P0, 'P0'], [ids.P1, 'P1'], [ids.P2, 'P2'], [ids.P3, 'P3']]);

/** Ensemble attendu des projets de O visibles, par acteur (règle de la 194). */
const VISIBLES: Record<Who, string[]> = {
  A: ['P0', 'P1', 'P2', 'P3'],
  M: ['P0', 'P1'],
  C: ['P0', 'P1'],
  PM: ['P0', 'P2'],
  TT: ['P0', 'P1'],
  L: ['P0'],
  F: [],
  X: [],
};

/** Une lecture qui a sa RPC : la forme directe, la forme RPC, les colonnes comparées. */
interface Lecture {
  nom: string;
  table: string;
  rpc: string;
  colonnes: string[];
}
const LECTURES: Lecture[] = [
  { nom: 'projets', table: 'team_projects', rpc: 'get_my_team_projects', colonnes: ['id'] },
  { nom: 'tâches', table: 'team_tasks', rpc: 'get_my_team_tasks', colonnes: ['id'] },
  { nom: 'dépendances de tâches', table: 'team_task_dependencies', rpc: 'get_my_team_task_dependencies', colonnes: ['task_id', 'depends_on_id'] },
  { nom: 'dépendances de projets', table: 'team_project_dependencies', rpc: 'get_my_team_project_dependencies', colonnes: ['project_id', 'depends_on_id'] },
  { nom: 'membres de projet', table: 'team_project_members', rpc: 'get_my_team_project_members', colonnes: ['project_id', 'user_id'] },
  { nom: 'liens KR ↔ projet', table: 'team_kr_projects', rpc: 'get_my_team_kr_projects', colonnes: ['kr_id', 'project_id'] },
];

let users: Record<Who, TestUser>;
const lignes = (data: Row[] | null, cols: string[]) =>
  (data ?? []).map((r) => cols.map((c) => String(r[c])).join('→')).sort();

async function direct(client: SupabaseClient, l: Lecture): Promise<string[]> {
  const { data, error } = await client.from(l.table).select(l.colonnes.join(',')).eq('org_id', ids.O);
  if (error) throw new Error(`${l.table} (lecture directe) : ${error.code} ${error.message}`);
  return lignes(data as unknown as Row[], l.colonnes);
}

async function parRpc(client: SupabaseClient, l: Lecture): Promise<string[]> {
  const { data, error } = await client.rpc(l.rpc, { p_org: ids.O }).select(l.colonnes.join(','));
  if (error) throw new Error(`${l.rpc} : ${error.code} ${error.message}`);
  return lignes(data as unknown as Row[], l.colonnes);
}

describe('RLS · une seule règle de visibilité des projets d’équipe (mig. 243)', () => {
  beforeAll(async () => {
    const liste = await Promise.all(ACTEURS.map(() => createTestUser()));
    users = Object.fromEntries(ACTEURS.map((w, i) => [w, liste[i]])) as Record<Who, TestUser>;
    const { A, M, C, PM, TT, L, F, X } = users;
    const stamp = Date.now();

    const pose = async (table: string, rows: Row | Row[]) => {
      const { error } = await admin.from(table).insert(rows);
      if (error) throw new Error(`décor ${table} : ${error.message}`);
    };
    await pose('organizations', [
      { id: ids.O, name: 'Org règle unique', owner_id: A.id, join_code: `rls-regle-${stamp}` },
      { id: ids.O2, name: 'Org tierce', owner_id: X.id, join_code: `rls-regle2-${stamp}` },
    ]);
    await pose('organization_members', [
      { org_id: ids.O, user_id: A.id, role: 'admin' },
      { org_id: ids.O, user_id: M.id, role: 'member', manager_id: A.id },
      { org_id: ids.O, user_id: C.id, role: 'member', manager_id: M.id },
      { org_id: ids.O, user_id: PM.id, role: 'member', manager_id: A.id },
      { org_id: ids.O, user_id: TT.id, role: 'member', manager_id: A.id },
      { org_id: ids.O, user_id: L.id, role: 'member', manager_id: A.id },
      { org_id: ids.O, user_id: F.id, role: 'member', manager_id: A.id },
      { org_id: ids.O2, user_id: X.id, role: 'admin' },
    ]);
    await pose('org_teams', [
      { id: ids.T1, org_id: ids.O, name: 'Équipe porteuse', created_by: A.id },
      { id: ids.T2, org_id: ids.O, name: 'Équipe transverse', created_by: A.id },
      { id: ids.T3, org_id: ids.O, name: 'Équipe vide', created_by: A.id },
    ]);
    await pose('org_team_members', [
      { team_id: ids.T1, org_id: ids.O, user_id: C.id, is_lead: false },
      { team_id: ids.T1, org_id: ids.O, user_id: F.id, is_lead: false },
      { team_id: ids.T2, org_id: ids.O, user_id: TT.id, is_lead: false },
    ]);
    await pose('team_projects', [
      { id: ids.P0, org_id: ids.O, name: 'P0 sans équipe', created_by: A.id },
      { id: ids.P1, org_id: ids.O, name: 'P1 équipe T1', team_id: ids.T1, created_by: A.id },
      { id: ids.P2, org_id: ids.O, name: 'P2 équipe T3', team_id: ids.T3, created_by: A.id },
      { id: ids.P3, org_id: ids.O, name: 'P3 cloisonné', team_id: ids.T3, created_by: A.id },
    ]);
    await pose('team_project_teams', { project_id: ids.P1, team_id: ids.T2, org_id: ids.O });
    await pose('team_project_members', [
      { project_id: ids.P2, user_id: PM.id, org_id: ids.O, role: 'contributor' },
      { project_id: ids.P3, user_id: F.id, org_id: ids.O, role: 'contributor' },
    ]);
    await pose('team_tasks', [
      { id: ids.TK0, org_id: ids.O, project_id: ids.P0, name: 'TK0', created_by: A.id },
      { id: ids.TK1a, org_id: ids.O, project_id: ids.P1, name: 'TK1a', created_by: A.id },
      { id: ids.TK1b, org_id: ids.O, project_id: ids.P1, name: 'TK1b', created_by: A.id, completed: true },
      { id: ids.TK1d, org_id: ids.O, project_id: ids.P1, name: 'TK1d (corbeille)', created_by: A.id },
      { id: ids.TK2, org_id: ids.O, project_id: ids.P2, name: 'TK2', created_by: A.id },
      { id: ids.TK3, org_id: ids.O, project_id: ids.P3, name: 'TK3', created_by: A.id },
    ]);
    await pose('team_task_dependencies', [
      { task_id: ids.TK1a, depends_on_id: ids.TK1b, org_id: ids.O },
      { task_id: ids.TK1a, depends_on_id: ids.TK1d, org_id: ids.O },
    ]);
    await pose('team_project_dependencies', [
      { project_id: ids.P1, depends_on_id: ids.P0, org_id: ids.O },
      { project_id: ids.P1, depends_on_id: ids.P3, org_id: ids.O },
      { project_id: ids.P2, depends_on_id: ids.P0, org_id: ids.O },
    ]);
    await pose('team_okrs', { id: ids.OK, org_id: ids.O, title: 'OKR règle unique', created_by: A.id });
    await pose('team_key_results', { id: ids.KR, okr_id: ids.OK, org_id: ids.O, title: 'KR règle unique' });
    await pose('team_kr_projects', [
      { kr_id: ids.KR, project_id: ids.P1, org_id: ids.O },
      { kr_id: ids.KR, project_id: ids.P3, org_id: ids.O },
    ]);

    // Corbeille : posée APRÈS la dépendance, comme dans l'application.
    const { error: corbeille } = await admin.from('team_tasks')
      .update({ deleted_at: new Date().toISOString() }).eq('id', ids.TK1d);
    if (corbeille) throw new Error(`décor corbeille : ${corbeille.message}`);
    // Départ de F : la ligne d'appartenance part, ses traces d'équipe et de
    // projet suivent les triggers de départ (ou restent : les deux chemins
    // doivent alors s'accorder pour les ignorer).
    const { error: depart } = await admin.from('organization_members').delete()
      .eq('org_id', ids.O).eq('user_id', F.id);
    if (depart) throw new Error(`décor départ : ${depart.message}`);

    // ── Le décor est-il celui qu'on croit ? ────────────────────────
    const vrai = async (u: TestUser, fn: string, args: Row) => {
      const { data, error } = await u.client.rpc(fn, args);
      if (error) throw new Error(`${fn} : ${error.message}`);
      return data as boolean;
    };
    expect(await vrai(A, 'is_org_admin', { p_org: ids.O }), 'A doit être admin de O').toBe(true);
    expect(await vrai(M, 'is_org_manager', { p_org: ids.O }), 'M doit être manager (C est sous lui)').toBe(true);
    expect(await vrai(L, 'is_org_member', { p_org: ids.O }), 'L doit être membre de O').toBe(true);
    expect(await vrai(F, 'is_org_member', { p_org: ids.O }), 'F ne doit plus être membre de O').toBe(false);
    expect(await vrai(X, 'is_org_member', { p_org: ids.O }), 'X ne doit pas être membre de O').toBe(false);
  }, 120_000);

  afterAll(async () => {
    await admin.from('organizations').delete().in('id', [ids.O, ids.O2]);
    if (users) await deleteTestUsers(...Object.values(users));
  });

  for (const who of ACTEURS) {
    it(`${who} : la règle voit les projets attendus, et can_access_team_project dit la même chose`, async () => {
      const client = users[who].client;
      const { data, error } = await client.rpc('get_my_team_projects', { p_org: ids.O }).select('id');
      expect(error).toBeNull();
      const vus = ((data ?? []) as unknown as { id: string }[]).map((r) => nomProjet.get(r.id) ?? r.id).sort();
      expect(vus, `${who} : projets visibles par la RPC`).toEqual(VISIBLES[who]);

      const scalaire: string[] = [];
      for (const [id, nom] of nomProjet) {
        const { data: ok, error: e } = await client.rpc('can_access_team_project', { p_project: id });
        expect(e).toBeNull();
        if (ok === true) scalaire.push(nom);
      }
      expect(scalaire.sort(), `${who} : can_access_team_project, projet par projet`).toEqual(VISIBLES[who]);
    });

    it(`${who} : lecture directe sous RLS et RPC rendent les mêmes lignes`, async () => {
      const client = users[who].client;
      const ecarts: string[] = [];
      for (const l of LECTURES) {
        const [d, r] = [await direct(client, l), await parRpc(client, l)];
        if (JSON.stringify(d) !== JSON.stringify(r)) {
          ecarts.push(`${l.nom} : directe [${d.join(', ')}] ≠ RPC [${r.join(', ')}]`);
        }
      }
      // Avancement : agrégat de la RPC contre le même compte refait sur la
      // lecture directe des tâches.
      const { data: taches } = await client.from('team_tasks').select('project_id,completed').eq('org_id', ids.O);
      const attendu = new Map<string, { total: number; done: number }>();
      for (const t of (taches ?? []) as { project_id: string; completed: boolean }[]) {
        const c = attendu.get(t.project_id) ?? { total: 0, done: 0 };
        attendu.set(t.project_id, { total: c.total + 1, done: c.done + (t.completed ? 1 : 0) });
      }
      const { data: prog, error } = await client.rpc('get_my_team_project_progress', { p_org: ids.O });
      expect(error).toBeNull();
      const vu = ((prog ?? []) as { project_id: string; total: number; done: number }[])
        .map((p) => `${p.project_id}:${p.total}/${p.done}`).sort();
      const refait = [...attendu].map(([p, c]) => `${p}:${c.total}/${c.done}`).sort();
      if (JSON.stringify(vu) !== JSON.stringify(refait)) ecarts.push(`avancement : RPC [${vu}] ≠ directe [${refait}]`);

      console.log(`RLS-REGLE-UNIQUE ${who} ${ecarts.length ? 'ÉCART' : 'ok'}`);
      expect(ecarts, `${who} : les deux chemins de lecture divergent`).toEqual([]);
    });
  }

  // Les deux cellules qui divergeaient avant la 243, attendues nommément.
  it('C ne lit en direct ni la dépendance vers la tâche à la corbeille, ni l’arête vers le projet cloisonné', async () => {
    const client = users.C.client;
    const [deps, arretes] = [await direct(client, LECTURES[2]), await direct(client, LECTURES[3])];
    expect(deps).toEqual([`${ids.TK1a}→${ids.TK1b}`]);
    expect(arretes).toEqual([`${ids.P1}→${ids.P0}`]);
  });

  it('A (témoin positif) lit les deux liens KR et les trois arêtes de projet', async () => {
    const client = users.A.client;
    expect(await direct(client, LECTURES[5])).toEqual([`${ids.KR}→${ids.P1}`, `${ids.KR}→${ids.P3}`].sort());
    expect((await direct(client, LECTURES[3])).length).toBe(3);
  });
});
