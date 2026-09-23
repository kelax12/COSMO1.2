// ═══════════════════════════════════════════════════════════════════
// statistics/HabitHeatmap — calendrier de complétion des habitudes (26 sem.).
// Extrait verbatim de statistics/sections.tsx (god-component refactor).
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Habit } from '@/modules/habits';
import { getLocalDateString } from '@/lib/workTimeCalculator';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';

type HeatmapCell = { date: Date; dateStr: string; completed: number; total: number; rate: number; isFuture: boolean };

export const HabitHeatmap = React.memo<{ habits: Habit[]; now: Date; embedded?: boolean }>(({ habits, now, embedded = false }) => {
  const { t } = useT('statistics');
  const WEEKS = 26;
  // Bornes desktop (non-embedded, orientation verticale) : 26 lignes sans
  // hauteur maximale poussaient le reste de la page vers le bas au lieu de
  // défiler dans la carte — le conteneur portait `overflow-y-auto` mais
  // aucune hauteur pour lui donner prise (un overflow n'a d'effet que sur un
  // axe borné). N'affecte pas `embedded` : ce mode vit déjà dans un parent à
  // hauteur fixée (`h-full`).
  const VISIBLE_ROWS = 10;
  // Repère desktop : au-delà de cette largeur de conteneur, la grille passe
  // à l'horizontale (semaines en colonnes, jours en lignes) — même seuil que
  // le reste de la page (`md:`, 768 px). En deçà, 7 colonnes de jours seules
  // remplissaient déjà toute la largeur disponible (mobile) ; au-delà, elles
  // laissaient plus de la moitié d'une carte large vide, signalé par Axel :
  // la verticale n'a jamais été pensée pour occuper une carte pleine largeur.
  const HORIZONTAL_BREAKPOINT = 768;
  const GAP = embedded ? 3 : 2;
  const MONTH_W = embedded ? 24 : 14;
  // Colonne des lettres de jour en orientation horizontale — une seule
  // lettre, contrairement à `MONTH_W` qui porte un nom de mois abrégé.
  const DAY_AXIS_W = 16;
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(embedded ? 28 : 13);
  const [horizontal, setHorizontal] = useState(false);
  const CELL = cellSize;
  // Rayon proportionnel à la taille de la cellule : un rayon fixe de 3 px
  // (l'ancienne valeur) restait quasi invisible une fois CELL monté à 40+ px
  // par le ResizeObserver ci-dessous — les carrés paraissaient à angles vifs
  // alors qu'ils portaient déjà un `border-radius`.
  const CELL_RADIUS = Math.min(10, Math.max(3, Math.round(CELL * 0.22)));
  // Tooltip rendu via portail (document.body) pour ne jamais être découpé
  // par l'overflow-y-auto du conteneur défilant (bug : tooltip masqué en arrière-plan).
  const [hovered, setHovered] = useState<{ cell: HeatmapCell; rect: DOMRect } | null>(null);

  useEffect(() => {
    if (embedded) return;
    const el = wrapperRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const wide = w >= HORIZONTAL_BREAKPOINT;
      setHorizontal(wide);
      if (wide) {
        // WEEKS colonnes + l'axe des jours, séparés par WEEKS interstices
        // (WEEKS + 1 éléments dans la ligne flex → WEEKS gaps).
        const size = Math.min(42, Math.floor((w - DAY_AXIS_W - WEEKS * GAP) / WEEKS));
        setCellSize(Math.max(10, size));
      } else {
        // 7 colonnes + la colonne de mois, séparés par 7 interstices.
        const size = Math.min(42, Math.floor((w - MONTH_W - 7 * GAP) / 7));
        setCellSize(Math.max(13, size));
      }
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded, GAP, MONTH_W]);

  // Semaines en ordre CHRONOLOGIQUE (la plus ancienne d'abord) : c'est ce que
  // veut l'orientation horizontale (gauche → droite = passé → présent, comme
  // tout calendrier). L'orientation verticale veut l'inverse (la semaine la
  // plus récente EN HAUT, pour rester visible sans avoir à défiler) — elle
  // dérive sa propre vue plutôt que de faire porter cet ordre par les deux.
  const weeksChrono = useMemo(() => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const firstDay = new Date(today);
    firstDay.setDate(today.getDate() - (WEEKS * 7 - 1));
    const dow = firstDay.getDay();
    firstDay.setDate(firstDay.getDate() + (dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow));

    const allCells: HeatmapCell[] = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + i);
      const dateStr = getLocalDateString(date);
      const isFuture = date > today;

      const activeHabits = habits.filter(h => {
        if (!h.createdAt) return true;
        const created = new Date(h.createdAt);
        const cn = new Date(created.getFullYear(), created.getMonth(), created.getDate());
        return date >= cn;
      });

      const completed = isFuture ? 0 : activeHabits.filter(h => h.completions[dateStr] === true).length;
      const rate = isFuture ? -1 : activeHabits.length > 0 ? completed / activeHabits.length : -1;
      allCells.push({ date, dateStr, completed, total: activeHabits.length, rate, isFuture });
    }

    const result: typeof allCells[] = [];
    for (let w = 0; w < WEEKS; w++) {
      result.push(allCells.slice(w * 7, (w + 1) * 7));
    }
    return result;
  }, [habits, now]);

  const weeksRecentFirst = useMemo(() => [...weeksChrono].reverse(), [weeksChrono]);

  // Étiquette de mois d'une semaine : calculée à la volée sur la semaine
  // affichée plutôt que pré-indexée par position, pour rester correcte quelle
  // que soit l'orientation (et l'ordre chronologique ou inversé) sans faire
  // porter cette synchronisation par deux structures séparées.
  const monthLabelFor = (week: HeatmapCell[]): string | undefined => {
    const firstOfMonth = week.find(c => c.date.getDate() === 1);
    return firstOfMonth ? formatDate(firstOfMonth.date, { month: 'short' }) : undefined;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [weeksChrono]);

  // Échelle rouge → vert (même logique que HabitGlobalTracking : haut taux = vert, bas taux = rouge).
  const getCellColor = (rate: number) => {
    if (rate < 0) return 'transparent';
    if (rate === 0) return '#991B1B'; // rouge foncé
    if (rate <= 0.25) return '#EF4444'; // rouge
    if (rate <= 0.5) return '#F97316'; // orange
    if (rate <= 0.75) return '#EAB308'; // jaune
    if (rate < 1) return '#22C55E'; // vert clair
    return '#166534'; // vert foncé
  };

  const CELL_BORDER = 'rgb(var(--color-border-muted))';
  const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const tooltipPortal = hovered && createPortal(
    <div
      className="fixed px-2 py-1 rounded-md whitespace-nowrap shadow-lg pointer-events-none"
      style={{
        left: hovered.rect.left + hovered.rect.width / 2,
        top: hovered.rect.top - 6,
        transform: 'translate(-50%, -100%)',
        zIndex: 9999,
        backgroundColor: 'rgb(var(--color-surface))',
        border: '1px solid rgb(var(--color-border))',
        color: 'rgb(var(--color-text-primary))',
      }}
    >
      <div className="text-[10px] font-bold text-center">{hovered.cell.completed}/{hovered.cell.total}</div>
      <div className="text-[9px] font-normal text-center mt-0.5" style={{ color: 'rgb(var(--color-text-muted))' }}>
        {formatDate(hovered.cell.date, { day: 'numeric', month: 'short' })}
      </div>
    </div>,
    document.body
  );

  const legend = (
    <div className="flex items-center gap-1.5 mt-3 justify-end flex-shrink-0">
      <span className="text-[9px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('heatmap.less')}</span>
      {[0, 0.1, 0.3, 0.55, 0.8, 1].map((r, i) => (
        <div key={i} style={{ width: CELL, height: CELL, borderRadius: CELL_RADIUS, backgroundColor: getCellColor(r), border: `1px solid ${CELL_BORDER}`, flexShrink: 0 }} />
      ))}
      <span className="text-[9px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>{t('heatmap.more')}</span>
    </div>
  );

  // Cellule d'un jour — identique dans les deux orientations, seule sa
  // position dans la grille change.
  const dayCell = (cell: HeatmapCell, key: number) => (
    <div
      key={key}
      className="relative group"
      style={{ width: CELL, height: CELL, flexShrink: 0 }}
      onMouseEnter={(e) => {
        if (cell.isFuture || cell.rate < 0) return;
        setHovered({ cell, rect: e.currentTarget.getBoundingClientRect() });
      }}
      onMouseLeave={() => setHovered(null)}
    >
      <div
        className="w-full h-full transition-transform duration-100 group-hover:scale-110"
        style={{ borderRadius: CELL_RADIUS, backgroundColor: getCellColor(cell.rate), border: `1px solid ${cell.isFuture ? 'transparent' : CELL_BORDER}` }}
      />
    </div>
  );

  // Orientation verticale (lignes = semaines, colonnes = jours) — mobile, et
  // desktop sous le seuil `HORIZONTAL_BREAKPOINT`. Semaine la plus récente EN
  // HAUT (weeksRecentFirst), pour rester visible sans avoir à défiler.
  const gridVertical = (scrollClass: string, scrollStyle?: React.CSSProperties) => (
    <>
      {/* Day headers */}
      <div className="flex flex-shrink-0" style={{ gap: GAP, paddingLeft: MONTH_W + GAP, marginBottom: GAP }}>
        {DAY_LABELS.map((d, i) => (
          <div key={i} style={{ width: CELL, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="text-[8px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>{d}</span>
          </div>
        ))}
      </div>
      {/* Scrollable weeks (rows)
          2026-09-23 · depuis que ce conteneur défile pour de bon (`c2affeeb`),
          axe relève `scrollable-region-focusable` sous WebKit : aucune case
          n'est focalisable, donc sous Safari la zone ne défile ni au clavier
          ni pour un lecteur d'écran piloté au clavier. Le conteneur devient
          lui-même un arrêt de tabulation, nommé par le titre de la carte. */}
      <div
        ref={scrollRef}
        className={`${scrollClass} rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent-solid))]`}
        style={scrollStyle}
        tabIndex={0}
        role="region"
        aria-label={t('heatmap.title')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {weeksRecentFirst.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', gap: GAP, alignItems: 'center', flexShrink: 0 }}>
              {/* Month label */}
              <div style={{ width: MONTH_W, height: CELL, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {monthLabelFor(week) && (
                  <span className="text-[8px] font-semibold leading-none select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>
                    {monthLabelFor(week)}
                  </span>
                )}
              </div>
              {/* Day cells */}
              {week.map((cell, di) => dayCell(cell, di))}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  // Orientation horizontale (colonnes = semaines, lignes = jours) — desktop,
  // à partir de `HORIZONTAL_BREAKPOINT`. Ordre CHRONOLOGIQUE gauche → droite
  // (weeksChrono), comme tout calendrier. Remplit la largeur de la carte au
  // lieu des 7 colonnes de jours seules, qui laissaient plus de la moitié
  // d'une carte large vide (signalé par Axel).
  const gridHorizontal = () => (
    <>
      {/* Month headers, un par colonne de semaine */}
      <div className="flex flex-shrink-0" style={{ gap: GAP, paddingLeft: DAY_AXIS_W + GAP, marginBottom: GAP }}>
        {weeksChrono.map((week, wi) => (
          <div key={wi} style={{ width: CELL, height: 12, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {monthLabelFor(week) && (
              <span className="text-[8px] font-semibold leading-none select-none whitespace-nowrap" style={{ color: 'rgb(var(--color-text-muted))' }}>
                {monthLabelFor(week)}
              </span>
            )}
          </div>
        ))}
      </div>
      {/* 7 lignes de jour ; défilement horizontal en filet de sécurité si le
          seuil ci-dessus laisse passer une largeur où CELL a touché son
          plancher (10 px) sans suffire à tenir WEEKS colonnes. */}
      <div className="overflow-x-auto">
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {DAY_LABELS.map((d, di) => (
            <div key={di} style={{ display: 'flex', gap: GAP, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: DAY_AXIS_W, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="text-[8px] font-medium select-none" style={{ color: 'rgb(var(--color-text-muted))' }}>{d}</span>
              </div>
              {weeksChrono.map((week, wi) => dayCell(week[di], wi))}
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {gridVertical('overflow-y-auto flex-1 min-h-0')}
        {legend}
        {tooltipPortal}
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'rgb(var(--color-text-primary))' }}>
        {t('heatmap.title')}
      </h3>
      <div ref={wrapperRef}>
        {horizontal
          ? gridHorizontal()
          : gridVertical('overflow-y-auto', { maxHeight: VISIBLE_ROWS * CELL + (VISIBLE_ROWS - 1) * GAP })}
      </div>
      {legend}
      {tooltipPortal}
    </div>
  );
});
