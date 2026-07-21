"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { buttonVariants } from "@/components/ui/button"
import { buildDatePresets } from "@/lib/date-presets"

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  className?: string
  /** Affiche « Pas de date » (onChange('')). Défaut : true. */
  allowClear?: boolean
  /** Format date-fns du libellé affiché. Défaut : "dd/MM/yyyy". */
  displayFormat?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  className,
  allowClear = true,
  displayFormat = "dd/MM/yyyy",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selectedDate = value ? new Date(value + "T12:00:00") : undefined

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    onChange?.(format(date, "yyyy-MM-dd"))
    setOpen(false)
  }

  // Presets (#25) : 80 % des échéances sont « aujourd'hui / demain / ce
  // week-end » — un clic au lieu de trois.
  const applyPreset = (v: string) => {
    onChange?.(v)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
          style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        >
          <span>
            {selectedDate
              ? format(selectedDate, displayFormat, { locale: fr })
              : placeholder}
          </span>
          <CalendarIcon size={16} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0 z-[100]" align="start" sideOffset={8}>
        {/* Presets au-dessus du calendrier (#25) */}
        <div className="flex flex-wrap gap-1.5 p-2 border-b border-border">
          {buildDatePresets().map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset.value)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:bg-accent transition-colors"
            >
              {preset.label}
            </button>
          ))}
          {allowClear && (
            <button
              type="button"
              onClick={() => applyPreset('')}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground border border-transparent hover:bg-accent transition-colors"
            >
              Pas de date
            </button>
          )}
        </div>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={fr}
          initialFocus
          className="w-full"
          classNames={{
            root: "w-full",
            months: "w-full",
            month: "w-full",
            weekdays: "flex w-full",
            weekday: "flex-1 text-center",
            week: "mt-2 flex w-full",
            day: "group/day relative flex-1 aspect-square rounded-[var(--cell-radius)] p-0 text-center select-none",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
