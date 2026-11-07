// ═══════════════════════════════════════════════════════════════════
// KR-COMPLETIONS MODULE - Données de démonstration (seed)
// ═══════════════════════════════════════════════════════════════════
//
// Jeu de données seul : aucune lecture ni écriture de stockage ici. Le dépôt de
// démo (`local.repository.ts`) l'ensemence au premier accès.

import { KRCompletion } from './types';
import { isEnglishSeed } from '@/lib/seed-i18n';
import { demoOkrTitlesEn } from '@/modules/okrs/local.seed';

// ═══════════════════════════════════════════════════════════════════
// DEMO DATA — Seeds matching the completed KRs in OKR demo data
// ═══════════════════════════════════════════════════════════════════

const getDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
};

/**
 * Factory function — called each time demo data is seeded.
 * Dates are computed fresh relative to today.
 */
export function createDemoCompletions(): KRCompletion[] {
  return localizeCompletions([
    // ── KRs complétés récemment (aujourd'hui / cette semaine) ──────────
    { id: 'krc-1', krId: 'kr-1', okrId: 'okr-1', userId: 'demo-user', completedAt: getDate(0),   krTitle: 'Compléter 90 tâches',                                 okrTitle: 'Améliorer ma productivité Q2 2026' },
    { id: 'krc-2', krId: 'kr-7', okrId: 'okr-3', userId: 'demo-user', completedAt: getDate(-1),  krTitle: 'Sport 4x par semaine',                                okrTitle: 'Santé et bien-être 2026' },
    { id: 'krc-3', krId: 'kr-9', okrId: 'okr-3', userId: 'demo-user', completedAt: getDate(-3),  krTitle: '5 fruits/légumes par jour',                            okrTitle: 'Santé et bien-être 2026' },

    // ── KRs complétés ce mois ──────────────────────────────────────────
    { id: 'krc-4', krId: 'kr-5', okrId: 'okr-2', userId: 'demo-user', completedAt: getDate(-10), krTitle: 'Livrer les 8 fonctionnalités clés du MVP',            okrTitle: 'Lancer mon projet' },
    { id: 'krc-5', krId: 'kr-4', okrId: 'okr-2', userId: 'demo-user', completedAt: getDate(-30), krTitle: 'Recueillir 10 retours utilisateurs sur le concept',   okrTitle: 'Lancer mon projet' },

    // ── KRs complétés il y a longtemps ─────────────────────────────────
    { id: 'krc-6', krId: 'kr-22', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-160), krTitle: 'Sport 3x par semaine pendant 6 mois', okrTitle: 'Bien-être et santé H1 2025' },
    { id: 'krc-7', krId: 'kr-23', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-165), krTitle: '5000 pages lues en 6 mois',           okrTitle: 'Bien-être et santé H1 2025' },
    { id: 'krc-8', krId: 'kr-24', okrId: 'okr-8', userId: 'demo-user', completedAt: getDate(-170), krTitle: 'Méditation quotidienne — streak 90j', okrTitle: 'Bien-être et santé H1 2025' },
  ]);
}

/**
 * Overlay anglais du journal de démo — cf. `src/lib/seed-i18n.ts`.
 *
 * Ces onze titres s'affichaient en FRANÇAIS dans le graphique « KR réalisés »
 * du tableau de bord d'un visiteur anglophone : ce module était le seul seed de
 * démo à n'être branché sur aucun overlay. Trouvé le 2026-09-12 par le motif
 * (9) d'`i18n:scan`, qui regarde enfin les valeurs de propriété.
 *
 * Les titres ne sont pas réécrits ici : ils sont REPRIS de `DEMO_OKRS_EN` par
 * (okrId, krId), pour qu'un libellé n'ait jamais deux traductions.
 */
function localizeCompletions(items: KRCompletion[]): KRCompletion[] {
  if (!isEnglishSeed()) return items;
  return items.map((c) => {
    const en = demoOkrTitlesEn(c.okrId, c.krId);
    return en ? { ...c, krTitle: en.krTitle, okrTitle: en.okrTitle } : c;
  });
}
