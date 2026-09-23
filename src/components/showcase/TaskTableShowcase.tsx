// ═══════════════════════════════════════════════════════════════════
// Vitrine « tableau des tâches » (desktop) — refaite le 2026-09-23
// ═══════════════════════════════════════════════════════════════════
//
// POURQUOI UNE REFONTE. L'ancienne vitrine était STATIQUE, et elle ne
// ressemblait plus au produit : colonne « Créé » disparue, cinq icônes d'action
// remplacées par un menu « … » unique, et surtout une échelle de priorités
// INVERSÉE (elle peignait la 5 en rouge ; dans l'app la 1 est la plus urgente).
// Archive intégrale : `docs/archive/LANDING-TASKTABLE-SHOWCASE-2026-09-23.md`.
//
// CE QU'ELLE REPRODUIT, et d'où : les colonnes et leurs libellés de
// `task-table/TaskTableDesktop`, la ligne de `task-table/list` (`TaskRow`),
// les pastilles `task-priority-N` de `index.css`, les filtres rapides de
// `TaskQuickFilters`, le bandeau de `OverdueBanner`, les échéances et durées
// formatées par les MÊMES fonctions que l'app (`task-table/helpers`).
//
// CE QU'ELLE RACONTE, en treize secondes, avec les gestes réels de l'app :
// cocher une tâche (la coche se dessine, le nom se barre), ouvrir le menu « … »
// et la mettre en favori, replanifier la tâche en retard depuis le bandeau,
// puis trier par priorité.
//
// 🔴 LA GÉOMÉTRIE EST CALCULÉE, JAMAIS MESURÉE. La maquette est dessinée à une
// largeur fixe (`W`) puis mise à l'échelle par un `transform`. Les animations
// de mise en page de Framer (`layout`) mesurent l'écran et se trompent d'un
// facteur d'échelle sous un parent transformé : les lignes, le curseur et les
// menus sont donc placés par des constantes, et le tri anime un `y` calculé.
//
// ⚠️ ELLE DOIT POUVOIR S'ARRÊTER (C-69, WCAG 2.2.2, niveau A) : trois états
// `auto` / `pause` / `lecture` (`rotation-state.ts`), suspension au survol et
// au focus, arrêt hors écran, et AUCUN démarrage automatique sous
// `prefers-reduced-motion`. Le bouton fait 44 × 44 px RÉELS : il vit HORS de la
// maquette mise à l'échelle, sinon il rétrécirait avec elle.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle, Bookmark, Calendar, CheckCircle2, CheckSquare, Copy, Hourglass,
  ListChecks, ListPlus, MoreHorizontal, Pause, Pencil, Play, Trash2, UserPlus, Users,
} from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDeadlineSmart, formatDuration } from '@/components/task-table/helpers';
import { useShowcaseTheme, type ShowcaseTheme } from './showcase-theme';
import { etatApresAppui, rotationDemandee, type EtatRotation } from './rotation-state';

// ─── Géométrie (espace de dessin, en px) ──────────────────────────
const W = 720;
const H = 504;
const BARRE_H = 56; // filtres rapides
const BANDEAU_H = 56; // bandeau de retard + son écart
const ENTETE_H = 40;
const LIGNE_H = 56;
const TABLE_X = 16;
// Largeurs de colonnes, dans l'ordre de `TaskTableDesktop` (somme : 688).
const COLS = [36, 36, 212, 112, 72, 100, 60, 60] as const;
const colX = (i: number) => TABLE_X + COLS.slice(0, i).reduce((a, b) => a + b, 0);
const GRILLE = COLS.map((c) => `${c}px`).join(' ');

// ─── Données ─────────────────────────────────────────────────────
const CATEGORIES = {
  travail: { nom: 'Travail', couleur: '#8B5CF6' },
  sante: { nom: 'Santé', couleur: '#10B981' },
  finance: { nom: 'Finance', couleur: '#F59E0B' },
  perso: { nom: 'Personnel', couleur: '#3B82F6' },
  clients: { nom: 'Clients', couleur: '#EF4444' },
} as const;

type Priorite = 1 | 2 | 3 | 4 | 5;
interface Ligne {
  id: string;
  nom: string;
  cat: keyof typeof CATEGORIES;
  priorite: Priorite;
  /** Échéance en jours depuis aujourd'hui (négatif = en retard). */
  echeance: number;
  duree: number;
  favori?: boolean;
  sousTaches?: [number, number];
  collaborateur?: string;
}

const LIGNES: Ligne[] = [
  { id: 'rapport', nom: 'Finaliser le rapport', cat: 'travail', priorite: 2, echeance: 1, duree: 120, favori: true, sousTaches: [3, 5] },
  { id: 'sport', nom: 'Séance de sport (HIIT)', cat: 'sante', priorite: 3, echeance: 0, duree: 45 },
  { id: 'banque', nom: 'Appeler la banque', cat: 'finance', priorite: 1, echeance: -1, duree: 20 },
  { id: 'roadmap', nom: 'Préparer la roadmap Q2', cat: 'travail', priorite: 4, echeance: 3, duree: 180 },
  { id: 'lecture', nom: 'Lecture : Atomic Habits', cat: 'perso', priorite: 5, echeance: 5, duree: 30 },
  { id: 'client', nom: 'Proposition client', cat: 'clients', priorite: 1, echeance: 2, duree: 60, collaborateur: 'Léa' },
];
const ORDRE_INITIAL = LIGNES.map((l) => l.id);
// Tri stable par priorité croissante : la 1 est la plus urgente, comme dans l'app.
const ORDRE_TRIE = [...LIGNES].sort((a, b) => a.priorite - b.priorite).map((l) => l.id);

// Les acteurs du scénario.
const A_COCHER = 'sport';
const A_FAVORISER = 'lecture';
const EN_RETARD = 'banque';

/** Clé de jour locale (`AAAA-MM-JJ`) décalée de `n` jours : le format que
 *  `formatDeadlineSmart` sait lire sans conversion de fuseau. */
const jour = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Scénario ────────────────────────────────────────────────────
const SCENARIO = [
  { phase: 'entree', ms: 1100 },
  { phase: 'versCase', ms: 900 },
  { phase: 'valide', ms: 1000 },
  { phase: 'versMenu', ms: 900 },
  { phase: 'menu', ms: 1300 },
  { phase: 'favori', ms: 900 },
  { phase: 'versBandeau', ms: 900 },
  { phase: 'report', ms: 1200 },
  { phase: 'reporte', ms: 1100 },
  { phase: 'versTri', ms: 900 },
  { phase: 'trie', ms: 2100 },
  { phase: 'fin', ms: 1300 },
] as const;
type Phase = (typeof SCENARIO)[number]['phase'];
const rang = (p: Phase) => SCENARIO.findIndex((s) => s.phase === p);

// Menu de ligne, dans l'ordre de `TaskRow` (une tâche non terminée, pas en retard).
const MENU_LIGNE = [
  { Icone: Pencil, label: 'Modifier' },
  { Icone: Bookmark, label: 'Favori' },
  { Icone: ListPlus, label: 'Ajouter à une liste' },
  { Icone: Calendar, label: 'Planifier' },
  { Icone: UserPlus, label: 'Collaborateur' },
  { Icone: Copy, label: 'Dupliquer la tâche' },
] as const;
const ITEM_H = 32;
const MENU_L = 212;
const MENU_HAUTEUR = 8 + (MENU_LIGNE.length + 1) * ITEM_H + 9; // + « Supprimer » + séparateur
const REPORTS = ['Demain', 'Ce week-end', 'Semaine prochaine'] as const;

// ─── Jetons de couleur, relevés sur les thèmes réels de l'app ────
interface Pastille { fond: string; texte: string; bord: string }
interface Jetons {
  cadre: string; cadreBord: string; ombre: string;
  entete: string; enteteTexte: string; filet: string;
  encre: string; encre2: string; muet: string;
  puce: string; puceTexte: string; accent: string;
  caseBord: string; survol: string;
  menu: string; menuBord: string; menuOmbre: string;
  retardFond: string; retardBord: string; retardTexte: string; retardIcone: string; echeanceRetard: string;
  favoriFond: string;
  curseur: string; curseurBord: string;
  priorites: Record<Priorite, Pastille>;
}

const JETONS: Record<ShowcaseTheme, Jetons> = {
  // Thème sombre de l'app (`.dark`) : `--table-*`, `--color-*`, et les
  // variantes `.dark .task-priority-N`.
  dark: {
    cadre: 'rgb(30, 41, 59)', cadreBord: 'rgb(71, 85, 105)', ombre: '0 30px 60px -24px rgba(0,0,0,0.65)',
    entete: 'rgb(15, 23, 42)', enteteTexte: 'rgb(203, 213, 225)', filet: 'rgba(71, 85, 105, 0.6)',
    encre: 'rgb(248, 250, 252)', encre2: 'rgb(203, 213, 225)', muet: 'rgb(148, 163, 184)',
    puce: 'rgb(51, 65, 85)', puceTexte: 'rgb(203, 213, 225)', accent: 'rgb(52, 114, 216)',
    caseBord: 'rgb(100, 116, 139)', survol: 'rgba(51, 65, 85, 0.55)',
    menu: 'rgb(30, 41, 59)', menuBord: 'rgb(71, 85, 105)', menuOmbre: '0 18px 40px -10px rgba(0,0,0,0.6)',
    retardFond: 'rgba(239,68,68,0.1)', retardBord: 'rgba(239,68,68,0.3)', retardTexte: '#FCA5A5', retardIcone: '#EF4444', echeanceRetard: '#EF4444',
    favoriFond: 'rgba(234,179,8,0.2)',
    curseur: '#F8FAFC', curseurBord: '#0F172A',
    priorites: {
      1: { fond: 'rgba(220,38,38,0.3)', texte: '#F87171', bord: '#B91C1C' },
      2: { fond: 'rgba(234,88,12,0.3)', texte: '#FDBA74', bord: '#C2410C' },
      3: { fond: 'rgba(113,63,18,0.2)', texte: '#FDE047', bord: '#854D0E' },
      4: { fond: 'rgba(30,58,138,0.2)', texte: '#93C5FD', bord: '#1E40AF' },
      5: { fond: '#1E293B', texte: '#CBD5E1', bord: '#334155' },
    },
  },
  // Thème clair de l'app (`:root`) et les `.task-priority-N` claires.
  light: {
    cadre: '#FFFFFF', cadreBord: 'rgb(226, 232, 240)', ombre: '0 24px 50px -24px rgba(15,23,42,0.35)',
    entete: 'rgb(248, 250, 252)', enteteTexte: 'rgb(71, 85, 105)', filet: 'rgb(226, 232, 240)',
    encre: 'rgb(15, 23, 42)', encre2: 'rgb(71, 85, 105)', muet: 'rgb(105, 116, 131)',
    puce: 'rgb(241, 245, 249)', puceTexte: 'rgb(71, 85, 105)', accent: '#2563EB',
    caseBord: 'rgb(148, 163, 184)', survol: 'rgb(248, 250, 252)',
    menu: '#FFFFFF', menuBord: 'rgb(226, 232, 240)', menuOmbre: '0 18px 40px -12px rgba(15,23,42,0.22)',
    // red-600 et pas red-500 pour l'échéance : 4,5:1 sur blanc.
    retardFond: '#FEF2F2', retardBord: '#FECACA', retardTexte: '#B91C1C', retardIcone: '#EF4444', echeanceRetard: '#DC2626',
    favoriFond: 'rgba(234,179,8,0.2)',
    curseur: '#0F172A', curseurBord: '#FFFFFF',
    priorites: {
      1: { fond: '#FEF2F2', texte: '#B91C1C', bord: '#FECACA' },
      2: { fond: '#FFF7ED', texte: '#C2410C', bord: '#FED7AA' },
      3: { fond: '#FEFCE8', texte: '#A16207', bord: '#FEF08A' },
      4: { fond: '#EFF6FF', texte: '#1D4ED8', bord: '#BFDBFE' },
      5: { fond: '#F8FAFC', texte: '#334155', bord: '#E2E8F0' },
    },
  },
};

const RESSORT = { type: 'spring', stiffness: 260, damping: 30 } as const;
const GLISSE = { duration: 0.7, ease: [0.4, 0, 0.2, 1] } as const;

interface Point { x: number; y: number }

// ═══════════════════════════════════════════════════════════════════
const TaskTableShowcase: React.FC = () => {
  const J = JETONS[useShowcaseTheme()];
  const { t } = useT('common');

  // ── Mise à l'échelle ──
  // La largeur disponible vit dans un ÉTAT, jamais lue sur la ref pendant le
  // rendu : un rendu qui dépend d'une ref ne se refait pas quand elle change.
  const extRef = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(W);
  useLayoutEffect(() => {
    const el = extRef.current;
    if (!el) return;
    const mesurer = () => setLargeur(el.clientWidth || W);
    mesurer();
    const ro = new ResizeObserver(mesurer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const echelle = Math.min(1, largeur / W);
  // Plus large que la maquette (`/guide`) : on centre au lieu d'agrandir.
  const decalageX = Math.max(0, (largeur - W * echelle) / 2);

  // ── Lecture : mêmes trois états que la vitrine du hero ──
  const mouvementReduit = !!useReducedMotion();
  const inView = useInView(extRef, { amount: 0.3 });
  const [etat, setEtat] = useState<EtatRotation>('auto');
  const [suspendu, setSuspendu] = useState(false);
  const demandee = rotationDemandee(etat, mouvementReduit);
  const enMarche = demandee && inView && !suspendu;

  const [etape, setEtape] = useState(0);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (!enMarche) return;
    const id = setTimeout(() => {
      if (etape === SCENARIO.length - 1) {
        setEtape(0);
        setCycle((c) => c + 1);
      } else {
        setEtape(etape + 1);
      }
    }, SCENARIO[etape].ms);
    return () => clearTimeout(id);
  }, [enMarche, etape]);

  const phase = SCENARIO[etape].phase;
  const des = (p: Phase) => etape >= rang(p);

  // ── État dérivé du scénario ──
  const coche = des('valide');
  const favori = des('favori');
  const reporte = des('reporte');
  const trie = des('trie');
  const menuOuvert = phase === 'menu';
  const reportOuvert = phase === 'report';
  const toast = phase === 'reporte' || phase === 'versTri';

  const ordre = trie ? ORDRE_TRIE : ORDRE_INITIAL;
  const tableY = BARRE_H + (reporte ? 0 : BANDEAU_H);
  const ligneY = (id: string) => tableY + ENTETE_H + ordre.indexOf(id) * LIGNE_H;

  // ── Cibles du curseur (pointe de la flèche) ──
  const caseDe = (id: string): Point => ({ x: TABLE_X + COLS[0] / 2, y: ligneY(id) + LIGNE_H / 2 });
  const pointsDe = (id: string): Point => ({ x: colX(7) + COLS[7] / 2, y: ligneY(id) + LIGNE_H / 2 });
  const menuHaut = ligneY(A_FAVORISER) + 10 - MENU_HAUTEUR; // s'ouvre VERS LE HAUT, faute de place dessous
  const menuX = colX(7) + COLS[7] - 4 - MENU_L;
  const itemFavori: Point = { x: menuX + 64, y: menuHaut + 4 + ITEM_H * 1.5 };
  const boutonBandeau: Point = { x: W - 16 - 12 - 56, y: BARRE_H + 22 };
  const reportHaut = BARRE_H + 48;
  const reportX = W - 16 - 12 - 200;
  const itemDemain: Point = { x: reportX + 52, y: reportHaut + 4 + ITEM_H / 2 };
  const entetePriorite: Point = { x: colX(4) + COLS[4] / 2, y: BARRE_H + ENTETE_H / 2 };
  const horsChamp: Point = { x: W + 30, y: H - 60 };

  const cible: Record<Phase, Point> = {
    entree: horsChamp,
    versCase: caseDe(A_COCHER),
    valide: caseDe(A_COCHER),
    versMenu: pointsDe(A_FAVORISER),
    menu: itemFavori,
    favori: itemFavori,
    versBandeau: boutonBandeau,
    report: itemDemain,
    reporte: itemDemain,
    versTri: entetePriorite,
    trie: entetePriorite,
    fin: horsChamp,
  };
  // Où tombe le clic qui OUVRE chaque phase — avant que le curseur reparte.
  const clic: Partial<Record<Phase, Point>> = {
    valide: caseDe(A_COCHER),
    menu: pointsDe(A_FAVORISER),
    favori: itemFavori,
    report: boutonBandeau,
    reporte: itemDemain,
    trie: entetePriorite,
  };
  const pointClic = clic[phase];
  // Dans les phases qui s'ouvrent par un clic et repartent ailleurs, le
  // curseur attend que le clic se voie.
  const departDiffere = phase === 'menu' || phase === 'report';

  // Ligne survolée : celle sous le curseur, le temps qu'il y reste.
  const survolee =
    phase === 'versCase' || phase === 'valide' ? A_COCHER
      : phase === 'versMenu' || phase === 'menu' ? A_FAVORISER
        : null;

  return (
    <div
      ref={extRef}
      className="relative w-full select-none"
      style={{ height: H * echelle }}
      // Le survol et le focus SUSPENDENT, sans changer l'état demandé.
      onPointerEnter={() => setSuspendu(true)}
      onPointerLeave={() => setSuspendu(false)}
      onFocusCapture={() => setSuspendu(true)}
      onBlurCapture={() => setSuspendu(false)}
    >
      {/* La maquette : décorative, donc retirée de l'arbre d'accessibilité.
          Le bouton de pause, lui, reste en dehors et reste annoncé. */}
      <div
        aria-hidden="true"
        className="absolute top-0 origin-top-left overflow-hidden rounded-xl text-left"
        style={{
          left: decalageX,
          width: W,
          height: H,
          transform: `scale(${echelle})`,
          backgroundColor: J.cadre,
          border: `1px solid ${J.cadreBord}`,
          boxShadow: J.ombre,
          fontSize: 14,
        }}
      >
        {/* ── Filtres rapides (TaskQuickFilters) ── */}
        <div className="absolute left-4 top-3 flex items-center gap-2">
          {[
            { Icone: Bookmark, label: 'Favoris' },
            { Icone: CheckCircle2, label: 'Terminées' },
            { Icone: AlertTriangle, label: 'Retard' },
            { Icone: Users, label: 'Collaboration' },
            { Icone: CheckSquare, label: 'Sélectionner' },
          ].map(({ Icone, label }) => (
            <span
              key={label}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium"
              style={{ backgroundColor: J.puce, color: J.puceTexte }}
            >
              <Icone size={15} />
              {label}
            </span>
          ))}
        </div>

        {/* ── Bandeau « en retard » (OverdueBanner) ── */}
        <AnimatePresence>
          {!reporte && (
            <motion.div
              key={`bandeau-${cycle}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, scaleY: 0.85 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="absolute flex items-center gap-3 rounded-xl px-4"
              style={{
                left: TABLE_X,
                top: BARRE_H,
                width: W - 2 * TABLE_X,
                height: 44,
                backgroundColor: J.retardFond,
                border: `1px solid ${J.retardBord}`,
                transformOrigin: 'top',
              }}
            >
              <AlertTriangle size={18} style={{ color: J.retardIcone }} />
              <span className="flex-1 text-sm font-medium" style={{ color: J.retardTexte }}>
                1 tâche en retard
              </span>
              <motion.span
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                animate={{
                  backgroundColor: phase === 'versBandeau' || reportOuvert ? '#B91C1C' : '#DC2626',
                  scale: reportOuvert ? [1, 0.94, 1] : 1,
                }}
                transition={{ duration: 0.3, delay: phase === 'versBandeau' ? 0.6 : 0 }}
              >
                Tout replanifier
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Le tableau (TaskTableDesktop) : en-tête + lignes, qui remontent
            d'un bloc quand le bandeau s'efface ── */}
        <motion.div
          className="absolute overflow-hidden rounded-xl"
          style={{
            left: TABLE_X,
            top: 0,
            width: W - 2 * TABLE_X,
            height: ENTETE_H + LIGNES.length * LIGNE_H,
            border: `1px solid ${J.cadreBord}`,
          }}
          initial={false}
          animate={{ y: tableY }}
          transition={RESSORT}
        >
          <div
            className="grid items-center whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide"
            style={{ gridTemplateColumns: GRILLE, height: ENTETE_H, backgroundColor: J.entete, color: J.enteteTexte, borderBottom: `1px solid ${J.filet}` }}
          >
            <span />
            <span />
            <span className="px-2">Nom de la tâche</span>
            <span className="px-2">Catégorie</span>
            <motion.span
              className="px-1 text-center"
              animate={{ color: phase === 'versTri' || phase === 'trie' ? J.encre : J.enteteTexte }}
              transition={{ duration: 0.25, delay: phase === 'versTri' ? 0.6 : 0 }}
            >
              Priorité
              <AnimatePresence>
                {trie && (
                  <motion.span
                    key="fleche"
                    className="ml-1 inline-block"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ↑
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.span>
            <span className="px-2">Dead line</span>
            <span className="px-1 text-center">Durée</span>
            <span className="text-center">Actions</span>
          </div>

          {LIGNES.map((l) => {
            const k = ordre.indexOf(l.id);
            const fait = l.id === A_COCHER && coche;
            const estFavori = !!l.favori || (l.id === A_FAVORISER && favori);
            const retard = l.id === EN_RETARD && !reporte;
            const echeance = l.id === EN_RETARD && reporte ? 1 : l.echeance;
            const cat = CATEGORIES[l.cat];
            const p = J.priorites[l.priorite];
            const fond = estFavori ? J.favoriFond : survolee === l.id ? J.survol : 'rgba(0,0,0,0)';
            return (
              <motion.div
                key={`${cycle}-${l.id}`}
                className="absolute inset-x-0"
                style={{ height: LIGNE_H, top: ENTETE_H }}
                initial={{ y: k * LIGNE_H, opacity: 0 }}
                animate={{ y: k * LIGNE_H, opacity: fait ? 0.75 : 1 }}
                transition={{ y: RESSORT, opacity: { duration: 0.35, delay: phase === 'entree' ? 0.12 + k * 0.07 : 0.15 } }}
              >
                <motion.div
                  className="relative grid h-full items-center"
                  style={{ gridTemplateColumns: GRILLE, borderBottom: `1px solid ${J.filet}` }}
                  initial={{ y: 10, backgroundColor: fond }}
                  animate={{ y: 0, backgroundColor: fond }}
                  transition={{ y: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.12 + k * 0.07 }, backgroundColor: { duration: 0.4 } }}
                >
                  {/* Liseré des favoris : il se DÉPLOIE au lieu d'apparaître. */}
                  <motion.span
                    className="absolute left-0 top-0 h-full w-1"
                    style={{ backgroundColor: '#EAB308', transformOrigin: 'center' }}
                    initial={false}
                    animate={{ scaleY: estFavori ? 1 : 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  />

                  {/* Case ronde + coche dessinée (#47 de TaskRow). */}
                  <span className="flex justify-center">
                    <motion.span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      initial={false}
                      animate={{
                        backgroundColor: fait ? J.accent : 'rgba(0,0,0,0)',
                        borderColor: fait ? J.accent : J.caseBord,
                        scale: phase === 'valide' && l.id === A_COCHER ? [1, 1.25, 1] : 1,
                      }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      style={{ borderWidth: 2, borderStyle: 'solid' }}
                    >
                      {fait && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <motion.path
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.22, ease: 'easeOut', delay: 0.05 }}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </motion.span>
                  </span>

                  {/* Pastille de catégorie (TaskCategoryIndicator). */}
                  <span className="flex justify-center">
                    <span className="h-6 w-6 rounded" style={{ backgroundColor: cat.couleur }} />
                  </span>

                  {/* Nom, qui se barre à la validation. */}
                  <span className="flex min-w-0 items-center gap-2 px-2">
                    <span className="relative truncate text-[15px] font-medium">
                      <motion.span initial={false} animate={{ color: fait ? J.muet : J.encre }} transition={{ duration: 0.25 }}>
                        {l.nom}
                      </motion.span>
                      <motion.span
                        className="absolute left-0 top-1/2 h-px w-full"
                        style={{ backgroundColor: J.muet, transformOrigin: 'left' }}
                        initial={false}
                        animate={{ scaleX: fait ? 1 : 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.1 }}
                      />
                    </span>
                    {l.sousTaches && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs" style={{ backgroundColor: J.puce, color: J.encre2 }}>
                        <ListChecks size={12} />
                        {l.sousTaches[0]}/{l.sousTaches[1]}
                      </span>
                    )}
                    {l.collaborateur && (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: J.accent }}>
                        {l.collaborateur}
                      </span>
                    )}
                  </span>

                  {/* Catégorie. */}
                  <span className="flex items-center gap-2 px-2 text-[13px]" style={{ color: J.encre2 }}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.couleur }} />
                    {cat.nom}
                  </span>

                  {/* Priorité (task-priority-N). */}
                  <span className="flex justify-center">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold"
                      style={{ backgroundColor: p.fond, color: p.texte, border: `1px solid ${p.bord}` }}
                    >
                      {l.priorite}
                    </span>
                  </span>

                  {/* Échéance : l'ancienne s'en va vers le haut, la nouvelle arrive du bas. */}
                  <span className="relative h-5 overflow-hidden px-2 text-[14px] font-medium">
                    <AnimatePresence initial={false}>
                      <motion.span
                        key={echeance}
                        className="absolute left-2 whitespace-nowrap"
                        initial={{ y: 18, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -18, opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        style={{ color: retard ? J.echeanceRetard : J.encre, fontWeight: retard ? 600 : 500 }}
                      >
                        {formatDeadlineSmart(jour(echeance))}
                      </motion.span>
                    </AnimatePresence>
                  </span>

                  {/* Durée. */}
                  <span className="whitespace-nowrap text-center text-[14px] font-medium" style={{ color: J.encre }}>
                    {formatDuration(l.duree)}
                  </span>

                  {/* Menu « … ». */}
                  <span className="flex justify-center">
                    <motion.span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md"
                      style={{ color: J.muet }}
                      initial={false}
                      animate={{
                        backgroundColor:
                          l.id === A_FAVORISER && (phase === 'versMenu' || menuOuvert) ? J.puce : 'rgba(0,0,0,0)',
                      }}
                      transition={{ duration: 0.2, delay: phase === 'versMenu' ? 0.6 : 0 }}
                    >
                      <MoreHorizontal size={18} />
                    </motion.span>
                  </span>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Menu de ligne (DropdownMenu de TaskRow) ── */}
        <AnimatePresence>
          {menuOuvert && (
            <motion.div
              key="menu-ligne"
              className="absolute z-20 rounded-lg p-1"
              style={{
                left: menuX, top: menuHaut, width: MENU_L,
                backgroundColor: J.menu, border: `1px solid ${J.menuBord}`, boxShadow: J.menuOmbre,
                transformOrigin: 'bottom right',
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {MENU_LIGNE.map(({ Icone, label }, i) => (
                <motion.div
                  key={label}
                  className="flex items-center gap-2 rounded-md px-2 text-[13px]"
                  style={{ height: ITEM_H, color: J.encre }}
                  initial={false}
                  animate={{ backgroundColor: i === 1 ? J.puce : 'rgba(0,0,0,0)' }}
                  transition={{ duration: 0.15, delay: i === 1 ? 0.95 : 0 }}
                >
                  <Icone size={15} style={{ color: J.muet }} />
                  {label}
                </motion.div>
              ))}
              <div className="my-1 h-px" style={{ backgroundColor: J.menuBord }} />
              <div className="flex items-center gap-2 rounded-md px-2 text-[13px]" style={{ height: ITEM_H, color: '#EF4444' }}>
                <Trash2 size={15} />
                Supprimer
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Menu « Tout replanifier » (OverdueBanner) ── */}
        <AnimatePresence>
          {reportOuvert && (
            <motion.div
              key="menu-report"
              className="absolute z-20 rounded-lg p-1"
              style={{
                left: reportX, top: reportHaut, width: 200,
                backgroundColor: J.menu, border: `1px solid ${J.menuBord}`, boxShadow: J.menuOmbre,
                transformOrigin: 'top right',
              }}
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {REPORTS.map((label, i) => (
                <motion.div
                  key={label}
                  className="flex items-center rounded-md px-2 text-[13px]"
                  style={{ height: ITEM_H, color: J.encre }}
                  initial={false}
                  animate={{ backgroundColor: i === 0 ? J.puce : 'rgba(0,0,0,0)' }}
                  transition={{ duration: 0.15, delay: i === 0 ? 0.95 : 0 }}
                >
                  {label}
                </motion.div>
              ))}
              <div className="my-1 h-px" style={{ backgroundColor: J.menuBord }} />
              <div className="flex items-center gap-2 rounded-md px-2 text-[13px]" style={{ height: ITEM_H, color: J.encre2 }}>
                <Hourglass size={14} style={{ color: J.muet }} />
                Choisir une date…
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Confirmation (toast) : ce que le report a produit ── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key={`toast-${cycle}`}
              className="absolute bottom-4 right-4 z-20 flex items-center gap-2.5 rounded-xl px-4 py-3 text-[13px] font-medium"
              style={{ backgroundColor: J.menu, border: `1px solid ${J.menuBord}`, boxShadow: J.menuOmbre, color: J.encre }}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <CheckCircle2 size={17} style={{ color: '#16A34A' }} />
              Tâche replanifiée à demain
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Le clic : une onde, là où il tombe ── */}
        <AnimatePresence>
          {pointClic && (
            <motion.span
              key={`clic-${cycle}-${etape}`}
              className="pointer-events-none absolute z-30 rounded-full"
              style={{
                left: pointClic.x - 16, top: pointClic.y - 16, width: 32, height: 32,
                backgroundColor: J.accent,
              }}
              initial={{ scale: 0.2, opacity: 0.35 }}
              animate={{ scale: 1.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {/* ── Le curseur ── */}
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-40"
          initial={false}
          animate={{
            x: cible[phase].x,
            y: cible[phase].y,
            opacity: phase === 'entree' || phase === 'fin' ? 0 : 1,
            scale: pointClic ? [1, 0.85, 1] : 1,
          }}
          transition={{
            x: { ...GLISSE, delay: departDiffere ? 0.3 : 0 },
            y: { ...GLISSE, delay: departDiffere ? 0.3 : 0 },
            opacity: { duration: 0.3 },
            scale: { duration: 0.25 },
          }}
        >
          <svg width="20" height="22" viewBox="0 0 20 22" style={{ transform: 'translate(-2px, -1px)' }}>
            <path
              d="M2 1.5 L2 17.5 L6.3 13.6 L9.2 20.2 L12 19 L9.2 12.5 L15 12.5 Z"
              fill={J.curseur}
              stroke={J.curseurBord}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </div>

      {/* ── Pause / lecture : 44 × 44 px RÉELS, hors de la mise à l'échelle ── */}
      <button
        type="button"
        onClick={() => setEtat((e) => etatApresAppui(e, mouvementReduit))}
        aria-pressed={!demandee}
        aria-label={demandee ? t('showcase.pause') : t('showcase.play')}
        className="absolute top-1 z-10 flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        style={{ backgroundColor: J.puce, color: J.puceTexte, right: decalageX + 4 }}
      >
        {demandee ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      </button>
    </div>
  );
};

export default TaskTableShowcase;
