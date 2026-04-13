"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"

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
  /** highlights the trigger border in blue (pre-filled mode) */
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
    const datePart = selectedDate ? format(selectedDate, "dd MMM yyyy", { locale: fr }) : null
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
            "w-full px-3 py-2.5 h-11 border rounded-lg transition-all flex items-center justify-between text-left text-sm font-medium",
            "hover:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
            highlighted
              ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-800"
              : "bg-transparent border-[rgb(var(--color-border))]",
            className
          )}
        >
          <span
            className={cn(
              displayLabel
                ? "text-[rgb(var(--color-text-primary))]"
                : "text-[rgb(var(--color-text-muted))]"
            )}
          >
            {displayLabel ?? placeholder}
          </span>
          <CalendarIcon size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0 z-[100]"
        align="start"
        sideOffset={8}
      >
        {/* Calendar */}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelectDate}
          initialFocus
          locale={fr}
        />

        {/* Divider */}
        <div className="border-t border-border mx-3" />

        {/* Time inputs */}
        <div className="p-3 space-y-3">
          {/* Start Time */}
          <div>
            <p className="text-sm font-bold text-foreground mb-1.5">Start Time</p>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
              <Clock size={15} className="text-muted-foreground shrink-0" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
              />
            </div>
          </div>

          {/* End Time */}
          <div>
            <p className="text-sm font-bold text-foreground mb-1.5">End Time</p>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
              <Clock size={15} className="text-muted-foreground shrink-0" />
              <input
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
