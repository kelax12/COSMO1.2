// Les quatre modules de COSMO, décrits UNE fois.
//
// POURQUOI CE FICHIER. Depuis la refonte du hero (2026-09-22, DA centrée), deux
// composants racontent la même chose et doivent rester d'accord : `HeroAppIcon`
// — la tuile produit qui tourne au-dessus du titre, à la manière d'une icône
// d'application — et `HeroModuleDock` — les quatre puces qui flottent de part
// et d'autre du titre. Si la tuile affiche « Agenda » pendant que la puce
// allumée dit « OKR », le hero se contredit tout seul ; c'est exactement le
// défaut que la barre d'adresse de `AppWindowShowcase` avait déjà produit.
//
// ⚠️ L'ORDRE EST LE SENS. Tâches → Habitudes → Agenda → OKR suit le continuum
// bleu → cyan → violet → fuchsia de la DA perso, et c'est aussi l'ordre de
// rotation de la tuile. Ne pas le réordonner pour des raisons de mise en page :
// la position à l'écran se règle par `cote` / `place`, pas en déplaçant une
// ligne de ce tableau.
import { CalendarDays, ListChecks, Repeat, Target, type LucideIcon } from 'lucide-react';

export interface ModuleHero {
  cle: 'tasks' | 'habits' | 'agenda' | 'okr';
  Icone: LucideIcon;
  /** D'où la puce arrive, en disposition « rangée ». Quatre directions = « éparpillés ». */
  from: { tx: string; ty: string };
  /** Teinte de la puce, sur le continuum bleu → fuchsia de la DA perso. */
  teinte: string;
  /** Dégradé de la tuile produit (fond plein, icône blanche). */
  tuile: string;
  /** Retard d'entrée, en ms. */
  delai: number;
  /**
   * Côté du titre en disposition « flottante » (≥ xl). Il décide aussi du sens
   * du filet d'encre qui relie la puce au centre : une puce de gauche tire son
   * trait vers la droite, et réciproquement.
   */
  cote: 'gauche' | 'droite';
  /** Position absolue en disposition « flottante » (classes Tailwind `xl:`). */
  place: string;
}

export const MODULES_HERO: ModuleHero[] = [
  {
    cle: 'tasks',
    Icone: ListChecks,
    from: { tx: '-120px', ty: '-70px' },
    teinte: 'text-blue-700 ring-blue-500/30 bg-blue-500/10',
    tuile: 'from-blue-500 to-blue-700',
    delai: 260,
    cote: 'gauche',
    place: 'xl:left-[1%] xl:top-[14%]',
  },
  {
    cle: 'habits',
    Icone: Repeat,
    from: { tx: '-40px', ty: '-110px' },
    teinte: 'text-cyan-700 ring-cyan-500/30 bg-cyan-500/10',
    tuile: 'from-cyan-500 to-cyan-700',
    delai: 350,
    cote: 'gauche',
    place: 'xl:left-[5%] xl:top-[63%]',
  },
  {
    cle: 'agenda',
    Icone: CalendarDays,
    from: { tx: '40px', ty: '-110px' },
    teinte: 'text-violet-700 ring-violet-500/30 bg-violet-500/10',
    tuile: 'from-violet-500 to-violet-700',
    delai: 440,
    cote: 'droite',
    place: 'xl:right-[1%] xl:top-[9%]',
  },
  {
    cle: 'okr',
    Icone: Target,
    from: { tx: '120px', ty: '-70px' },
    teinte: 'text-fuchsia-700 ring-fuchsia-500/30 bg-fuchsia-500/10',
    tuile: 'from-fuchsia-500 to-fuchsia-700',
    delai: 530,
    cote: 'droite',
    place: 'xl:right-[4%] xl:top-[56%]',
  },
];

/** Retard après lequel les quatre se sont posées : le filet ponctue l'arrivée. */
export const DELAI_ARRIMAGE_MS = 530;
