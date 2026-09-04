"use client"

import * as React from "react"
import { useT } from '@/i18n/useT'
import { format } from "date-fns"
import { getDateLocale } from '@/i18n/format';
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { buttonVariants } from "@/components/ui/button"
import { buildDatePresets } from "@/lib/date-presets"

interface DateCalendarPanelProps {
  /** Date sélectionnée, format 'YYYY-MM-DD'. */
  value?: string
  /** Reçoit 'YYYY-MM-DD', ou '' pour « Pas de date ». */
  onSelect: (date: string) => void
  /** Affiche « Pas de date ». Défaut : true. */
  allowClear?: boolean
  /**
   * Borne basse ('YYYY-MM-DD') : les jours antérieurs sont désactivés, et les
   * presets qui tombent avant sont retirés. Remplace l'attribut `min` de
   * l'input natif — sans elle, un report d'échéance pourrait viser hier.
   */
  minDate?: string
}

/**
 * Corps du calendrier COSMO : la rangée de presets, puis le mois.
 *
 * Extrait de `DatePicker` parce que deux façons d'ouvrir coexistent : un champ
 * qu'on clique (`DatePicker`), et une entrée de menu qui ouvre le calendrier
 * sans champ visible (« Choisir une date… » du report en masse). Les deux
 * doivent montrer EXACTEMENT le même calendrier — c'est la seule raison d'être
 * de cette extraction.
 */
export function DateCalendarPanel({ value, onSelect, allowClear = true, minDate }: DateCalendarPanelProps) {
  const ov = useT('overlays')
  const selectedDate = value ? new Date(value + "T12:00:00") : undefined
  const floor = minDate ? new Date(minDate + "T00:00:00") : undefined
  const presets = buildDatePresets().filter((p) => !minDate || p.value >= minDate)

  /** Nom accessible d'un jour, avec ses états — cf. `labels` plus bas. */
  const dayLabel = (date: Date, modifiers?: { today?: boolean; selected?: boolean }) => {
    const long = format(date, 'PPPP', { locale: getDateLocale() })
    const base = modifiers?.today ? ov.t('datePicker.todayPrefix', { date: long }) : long
    return modifiers?.selected ? ov.t('datePicker.selectedSuffix', { date: base }) : base
  }

  return (
    <>
      {/* Presets au-dessus du calendrier (#25) : 80 % des échéances sont
          « aujourd'hui / demain / ce week-end » — un clic au lieu de trois.
          `group` + `aria-label` : c'est la PREMIÈRE chose que rencontre le
          focus clavier, une rangée de boutons sans rien qui la nomme. */}
      <div className="flex flex-wrap gap-1.5 p-2 border-b border-border" role="group" aria-label={ov.t('datePicker.presets')}>
        {presets.map((preset) => (
          <button
            key={preset.labelKey}
            type="button"
            onClick={() => onSelect(preset.value)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors"
          >
            {ov.t(preset.labelKey)}
          </button>
        ))}
        {allowClear && (
          <button
            type="button"
            onClick={() => onSelect('')}
            className="px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground border border-transparent hover:bg-accent transition-colors"
          >
            {ov.t('datePicker.noDate')}
          </button>
        )}
      </div>
      <Calendar
        mode="single"
        selected={selectedDate}
        // `selected` ne pilote PAS le mois affiché en react-day-picker 9 :
        // sans `defaultMonth`, le calendrier s'ouvre sur le mois COURANT même
        // quand le champ porte déjà une date. Mesuré le 2026-09-03 : champ à
        // « 2 décembre 2026 », calendrier ouvert sur « septembre 2026 ». Le
        // jour focalisé était alors hors de la grille affichée, et les
        // flèches ne déplaçaient plus rien.
        defaultMonth={selectedDate}
        onSelect={(date) => { if (date) onSelect(format(date, "yyyy-MM-dd")) }}
        disabled={floor ? { before: floor } : undefined}
        locale={getDateLocale()}
        // 🔴 `initialFocus` est MORT depuis react-day-picker 9 : la prop
        // survit dans les types (dépréciée) mais `useFocus` ne lit plus que
        // `autoFocus`. Mesuré le 2026-09-03 : ouvrir le calendrier au clavier
        // posait le focus sur la rangée de presets, où les flèches ne font
        // rien — la grille n'était atteignable que par un Maj+Tab qui
        // rebouclait. Même classe que le `Button` non-forwardRef du
        // 2026-08-30 : une prop écrite pour une autre version majeure, qui
        // ne fait silencieusement rien.
        autoFocus
        // react-day-picker ne traduit AUCUN de ses libellés ARIA : `locale`
        // ne porte que les DATES. Sans ça, le calendrier d'un produit
        // francophone annonce « Navigation bar », « Go to the Previous
        // Month » et « Today, jeudi 3 septembre 2026 » (mesuré).
        // `i18n:scan` ne peut pas le voir : ces chaînes vivent dans la
        // bibliothèque, pas dans src/.
        labels={{
          labelNav: () => ov.t('datePicker.navLabel'),
          labelPrevious: () => ov.t('datePicker.prevMonth'),
          labelNext: () => ov.t('datePicker.nextMonth'),
          // « Today, » et « , selected » sont concaténés en dur par
          // labelDayButton : on refait le libellé entier plutôt que de le
          // rapiécer, sinon la traduction dépendrait de l'ordre des mots.
          labelDayButton: dayLabel,
          labelGridcell: dayLabel,
        }}
        className="w-full p-3 [--cell-size:2.5rem]"
        classNames={{
          root: "w-full",
          // `relative` est OBLIGATOIRE ici : le défaut de shadcn le porte
          // (cf. ui/calendar.tsx, "relative flex flex-col…"), et cette
          // surcharge REMPLACE la chaîne entière au lieu de la compléter.
          // Sans lui, `nav` (position: absolute, inset-x-0, top-0) perd son
          // ancrage et remonte jusqu'au prochain ancêtre positionné — ici
          // le PopoverContent lui-même — s'étalant en zone invisible sur
          // toute la largeur du popover, PAR-DESSUS la rangée de presets.
          // C'était le bug : Aujourd'hui / Demain / etc. semblaient morts
          // au clic, en réalité c'est la nav du calendrier qui l'interceptait.
          months: "relative w-full",
          month: "w-full",
          weekdays: "flex w-full",
          weekday: "flex-1 text-center",
          week: "mt-2 flex w-full",
          day: "group/day relative flex-1 aspect-square rounded-[var(--cell-radius)] p-0 text-center select-none",
        }}
      />
    </>
  )
}

/** Largeur et gouttières du panneau — partagées par tous ses points d'ouverture. */
export const DATE_PANEL_CLASS = "w-[clamp(240px,22rem,calc(100vw-2rem))] p-0"

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  className?: string
  /** Affiche « Pas de date » (onChange('')). Défaut : true. */
  allowClear?: boolean
  /** Format date-fns du libellé affiché. Défaut : "dd/MM/yyyy". */
  displayFormat?: string
  /**
   * Classes ajoutées au popover — en pratique, son `z-index`.
   *
   * Le défaut `z-[100]` passe au-dessus d'un Dialog Radix (z-50) mais PAS des
   * modales maison montées à `z-[9999]` / `z-[10000]` (TeamTaskModal, les
   * popups de dépendances). Dans celles-là il faut passer `z-[10001]`, sinon
   * le calendrier s'ouvre réellement mais DERRIÈRE la modale — le bouton
   * paraît mort. Même remède que `overlayClassName` sur `DialogContent`.
   */
  popoverClassName?: string
  /** Désactive le champ (le calendrier ne s'ouvre plus). */
  disabled?: boolean
  /** Repris sur le bouton déclencheur, pour un `<label htmlFor>`. */
  id?: string
  /** Borne basse ('YYYY-MM-DD') — cf. `DateCalendarPanel`. */
  minDate?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  allowClear = true,
  displayFormat = "dd/MM/yyyy",
  popoverClassName,
  disabled = false,
  id,
  minDate,
}: DatePickerProps) {
  const ov = useT('overlays')
  // Defaut traduit au rendu : dans la signature, il serait fige en francais.
  const placeholderText = placeholder ?? ov.t('datePicker.placeholder')
  const [open, setOpen] = React.useState(false)

  const selectedDate = value ? new Date(value + "T12:00:00") : undefined

  const handleSelect = (date: string) => {
    onChange?.(date)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
          style={{
            backgroundColor: 'rgb(var(--color-surface))',
            color: selectedDate ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))',
          }}
        >
          <span>
            {selectedDate
              ? format(selectedDate, displayFormat, { locale: getDateLocale() })
              : placeholderText}
          </span>
          <CalendarIcon size={16} className="shrink-0" style={{ color: 'rgb(var(--color-text-muted))' }} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className={cn(DATE_PANEL_CLASS, "z-[100]", popoverClassName)}
        align="start"
        collisionPadding={16}
        sideOffset={8}
        // Radix pose le focus sur le PREMIER élément focalisable du popover,
        // c'est-à-dire le preset « Aujourd'hui » — et sur une rangée de
        // boutons, les flèches ne font rien : on croit être dans un
        // calendrier et rien ne bouge. On vise donc explicitement le jour
        // que la grille rend focalisable (`tabindex="0"`), le seul endroit
        // où les flèches naviguent.
        onOpenAutoFocus={(e) => {
          const day = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(
            '[data-slot="calendar"] button[tabindex="0"]',
          )
          if (!day) return // pas de grille rendue : on laisse Radix faire
          e.preventDefault()
          day.focus()
        }}
      >
        <DateCalendarPanel
          value={value}
          onSelect={handleSelect}
          allowClear={allowClear}
          minDate={minDate}
        />
      </PopoverContent>
    </Popover>
  )
}
