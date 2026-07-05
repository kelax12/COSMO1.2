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
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  className,
  allowClear = true,
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
              ? format(selectedDate, "dd/MM/yyyy")
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
        />
      </PopoverContent>
    </Popover>
  )
}
