"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button, buttonVariants } from "@/components/ui/button"

interface CalendarWithTimeProps {
  /** ISO date string "yyyy-MM-dd" */
  date: string
  onDateChange: (date: string) => void
  /** "HH:mm" */
  startTime: string
  onStartTimeChange: (time: string) => void
  /** "HH:mm" */
  endTime: string
  onEndTimeChange: (time: string) => void
  placeholder?: string
  /** highlights the trigger border in primary color (pre-filled mode) */
  highlighted?: boolean
  className?: string
}

export function CalendarWithTime({
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  placeholder = "Date & heure",
  highlighted = false,
  className,
}: CalendarWithTimeProps) {
  const [open, setOpen] = React.useState(false)

  const selectedDate = date ? new Date(date + "T12:00:00") : undefined

  const handleSelectDate = (d: Date | undefined) => {
    if (!d) return
    onDateChange(format(d, "yyyy-MM-dd"))
  }

  const displayLabel = (() => {
    const datePart = selectedDate
      ? format(selectedDate, "dd MMM yyyy", { locale: fr })
      : null
    const times = [startTime, endTime].filter(Boolean).join(" → ")
    if (datePart && times) return `${datePart}  ·  ${times}`
    if (datePart) return datePart
    return null
  })()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-between font-normal",
            highlighted && "border-primary/50 bg-primary/5",
            !displayLabel && "text-muted-foreground",
            className
          )}
        >
          <span>{displayLabel ?? placeholder}</span>
          <CalendarIcon size={16} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0 z-[100]" align="start" sideOffset={8}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelectDate}
          locale={fr}
          initialFocus
        />

        <div className="border-t border-border p-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            {/* Heure de début */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Heure de début
              </p>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                <Clock size={14} className="text-muted-foreground shrink-0" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => onStartTimeChange(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Heure de fin */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Heure de fin
              </p>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                <Clock size={14} className="text-muted-foreground shrink-0" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => onEndTimeChange(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
