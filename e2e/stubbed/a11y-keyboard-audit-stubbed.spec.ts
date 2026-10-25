// ═══════════════════════════════════════════════════════════════════
// AM-2 (2026-10-23) · les surfaces modales qui n'existent QUE hors démo
//
// `FirstRunSetup` (garde `!isDemo`) et `ShareInviteClaimer` (garde `isDemo`
// inverse, plus un jeton d'invitation en attente) sont inatteignables dans le
// mode démo où tourne `e2e/a11y-keyboard-audit-surfaces.spec.ts`. Elles sont donc
// mesurées ici, sur le serveur `e2e-stub`, avec les MÊMES trois détecteurs (entrée
// du focus, piège, Échap) et le même contrôle du rôle que toutes les autres.
//
// Avant ce fichier, `first-run.spec.ts` mesurait le piège de Tab seul (25 Tab) et
// `ShareInviteClaimer` n'avait aucun parcours.
// ═══════════════════════════════════════════════════════════════════
import { test, expect } from '@playwright/test';
import { gotoStubbed, installSupabaseStub } from '../supabase-stub';
import { measureFocus, assertModalTrapsFocus } from '../keyboard-audit-helpers';

test.describe('AM-2 · surfaces modales hors démo, mesurées au clavier', () => {
  test('MESURE · FirstRunSetup (accueil du premier compte)', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    // Compte vide : c'est la condition même de l'accueil.
    stub.reply('rpc/get_my_tasks', []);
    await gotoStubbed(page, '/dashboard', page.getByRole('heading', { level: 1 }));

    const dialog = page.getByRole('dialog', { name: /bienvenue dans cosmo/i });
    await expect(dialog).toBeVisible({ timeout: 45_000 });
    // Pas de déclencheur : la surface s'ouvre d'elle-même, il n'y a pas de focus d'origine à rendre.
    const report = await measureFocus(page, dialog, false);
    console.log('[a11y-kbd] FirstRunSetup', JSON.stringify(report));
    assertModalTrapsFocus('FirstRunSetup', report);
  });

  test('MESURE · ShareInviteClaimer (invitation à une tâche partagée)', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_tasks', []);
    // La page d'invitation dépose le jeton ; ici on le dépose à sa place, avant le premier chargement.
    await page.addInitScript(() => {
      try {
        localStorage.setItem('cosmo_pending_share_invite', '3f2a9c1e-5b7d-4e8a-9c3b-1a2b3c4d5e6f');
        // L'accueil du premier compte passerait avant : il est déjà vu.
        localStorage.setItem('cosmo_first_run_done', '1');
      } catch { /* ignore */ }
    });
    stub.reply('rpc/claim_share_link', {
      task_id: '00000000-0000-4000-8000-00000000aa01',
      task_name: 'Préparer la revue',
      owner_name: 'Marie Dupont',
      owner_avatar: null,
      already_accepted: false,
    });
    await gotoStubbed(page, '/dashboard', page.getByRole('heading', { level: 1 }));

    const dialog = page.locator('[role="dialog"][aria-labelledby="share-invite-title"]');
    await expect(dialog).toBeVisible({ timeout: 45_000 });
    const report = await measureFocus(page, dialog, false);
    console.log('[a11y-kbd] ShareInviteClaimer', JSON.stringify(report));
    assertModalTrapsFocus('ShareInviteClaimer', report);
  });
});
