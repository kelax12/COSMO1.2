// ═══════════════════════════════════════════════════════════════════
// DÉPÔTS DE DÉMONSTRATION DU MODE ENTREPRISE — chargés à la demande
// ═══════════════════════════════════════════════════════════════════
//
// ── POURQUOI CE FICHIER EXISTE ─────────────────────────────────────
//
// Mesuré le 2026-09-02 : le chunk d'ENTRÉE portait **123,9 ko bruts** de dépôts
// de démonstration, soit un quart de son poids. Chaque visiteur les
// téléchargeait — y compris celui qui arrive sur la landing, ne se connecte
// jamais et ne verra jamais une donnée de démo.
//
// La cause tenait en une ligne : `repository.factory.ts` importait
// STATIQUEMENT les deux implémentations de chaque module, la locale et la
// Supabase, pour n'en instancier qu'une. Un `import` statique est retenu même
// quand la branche qui l'utilise est morte à l'exécution.
//
// Ce fichier regroupe les quatre plus gros — ceux du mode entreprise, **52 ko
// bruts** — dans un module chargé par `import()`. Rollup en fait un chunk
// séparé, qui n'est ni dans l'entrée ni préchargé : il n'arrive que si
// quelqu'un ouvre réellement le mode entreprise en démo.
//
// ── POURQUOI CES QUATRE-LÀ, ET PAS LES QUINZE ──────────────────────
//
// Ils vivent dans des fichiers `local.repository.ts` DÉDIÉS. Les autres
// (`events`, `okrs`, `friends`, `lists`, `categories`, `kr-completions`)
// mélangent l'interface et l'implémentation locale dans un même
// `repository.ts` : les sortir demande d'abord de séparer les deux, ce qui est
// un autre travail. La coupe s'arrête donc là où elle reste sûre.
//
// ── CE QUI REND CETTE COUPE SANS RISQUE ────────────────────────────
//
// 🔴 Les quatre interfaces n'exposent QUE des méthodes asynchrones — vérifié
// avant d'écrire une ligne, et c'est la condition qui rend le reste possible.
// Le factory peut donc rendre un mandataire synchrone dont chaque méthode
// attend le module au premier appel. Aucun appelant ne change, aucune séquence
// de démarrage n'est touchée, et `loginDemo()` garde exactement l'ordre
// documenté dans CLAUDE.md.
//
// ⚠️ Si l'une de ces interfaces gagne un jour un membre SYNCHRONE (une
// propriété, un getter), le mandataire cessera d'être transparent pour lui.
// Ajouter alors ce membre à la garde de `repository.factory.ts`, ou renoncer
// au chargement différé pour ce module.
// ═══════════════════════════════════════════════════════════════════

import { LocalStorageOrganizationsRepository } from '@/modules/organizations/local.repository';
import { LocalStorageTeamProjectsRepository } from '@/modules/team-projects/local.repository';
import { LocalStorageTeamOKRsRepository } from '@/modules/team-okrs/local.repository';
import { LocalStorageOrgTeamsRepository } from '@/modules/org-teams/local.repository';

import type { IOrganizationsRepository } from '@/modules/organizations/repository';
import type { ITeamProjectsRepository } from '@/modules/team-projects/repository';
import type { ITeamOKRsRepository } from '@/modules/team-okrs/repository';
import type { IOrgTeamsRepository } from '@/modules/org-teams/repository';

export const createDemoOrganizationsRepository = (): IOrganizationsRepository =>
  new LocalStorageOrganizationsRepository();

export const createDemoTeamProjectsRepository = (): ITeamProjectsRepository =>
  new LocalStorageTeamProjectsRepository();

export const createDemoTeamOKRsRepository = (): ITeamOKRsRepository =>
  new LocalStorageTeamOKRsRepository();

export const createDemoOrgTeamsRepository = (): IOrgTeamsRepository =>
  new LocalStorageOrgTeamsRepository();
