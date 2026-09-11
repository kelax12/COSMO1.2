import { test, expect } from '@playwright/test';
import { gotoStubbed, installSupabaseStub } from '../supabase-stub';

/**
 * ═══════════════════════════════════════════════════════════════════
 * Chauffer le serveur `e2e-stub` — un préalable, pas un test
 * ═══════════════════════════════════════════════════════════════════
 *
 * 🔴 POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N'ASSERTE (PRESQUE) RIEN.
 *
 * Le serveur du mode `e2e-stub` a son propre cache de dépendances
 * (`node_modules/.vite-e2e-stub`, cf. `vite.config.ts`) : il ne profite plus de
 * celui que le serveur du port 3000 a déjà chauffé, et en CI il démarre de
 * toute façon toujours à froid. Le `vite optimize` du webServer pré-empaquette
 * les dépendances ; il reste la compilation des SOURCES, à la demande, écran
 * par écran.
 *
 * Ce coût-là tombait entièrement sur le premier cas exécuté. Mesuré le
 * 2026-09-08, cache vide : ce cas — et jamais aucun autre — échouait, tantôt
 * sur une page restée vide plus de trois minutes, tantôt sur deux mutations
 * arrivées dans le désordre parce que la machine était saturée. Onze cas verts,
 * un rouge, toujours le premier : ce n'était pas ce cas-là qui était fragile,
 * c'était la place qu'il occupait.
 *
 * ❌ La mauvaise réponse aurait été de gonfler les tolérances du premier test
 *    jusqu'à ce qu'il passe : ça déplace le seuil sans nommer la cause, et ça
 *    rend le détecteur muet le jour où l'écran est VRAIMENT lent.
 * ✅ La bonne réponse est de payer ce coût ici, une fois, sous un nom qui le
 *    dit, avant que le moindre parcours ne commence.
 *
 * Ce fichier est le `dependencies` du project `supabase-stub` : s'il échoue,
 * les douze parcours ne sont pas joués — et c'est voulu. Un serveur qui ne sert
 * pas les deux écrans de base n'a rien à mesurer.
 */
test.describe('Préalable — chauffer le serveur du mode e2e-stub', () => {
  // Ce préalable a le droit d'être long : c'est précisément son objet. Il
  // reste borné, pour qu'un serveur réellement cassé échoue au lieu de pendre.
  test.describe.configure({ timeout: 900_000 });

  test('les deux écrans du harnais compilent et s’affichent', async ({ page }) => {
    const stub = await installSupabaseStub(page);
    stub.reply('rpc/get_my_tasks', []);

    // `/dashboard` : le plus gros des deux (tableau de bord, graphiques).
    // Cinq tentatives, et pas deux : chaque re-empaquetage de Vite recharge la
    // page, ce qui ANNULE la navigation en cours. Ce n'est pas une attente plus
    // longue qu'il faut, c'est une nouvelle tentative — mesure du 2026-09-08,
    // une seule navigation pouvait ne jamais aboutir en 10 minutes pendant que
    // le serveur, lui, repondait.
    await gotoStubbed(page, '/dashboard', page.getByRole('heading', { level: 1 }), 5);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    // `/entreprise` : la page, ses onglets paresseux et l'onglet Abonnement.
    // Sans organisation, elle redirige vers le tableau de bord — ça suffit à
    // faire compiler la route, ce qui est tout ce qu'on veut ici.
    await gotoStubbed(page, '/entreprise?tab=billing', page.getByRole('heading', { level: 1 }), 5);
  });
});
