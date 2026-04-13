"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, "0"))

interface CalendarWithTimeProps {
  /** ISO date string "yyyy-MM-dd" */
  date: string
  onDateChange: (date: string) => void
  /** "HH:mm" */
  time: string
  onTimeChange: (time: string) => void
  placeholder?: string
  /** highlights the trigger border in blue (pre-filled mode) */
  highlighted?: boolean
  className?: string
  required?: boolean
}

export function CalendarWithTime({
  date,
  onDateChange,
  time,
  onTimeChange,
  placeholder = "Date & heure",
  highlighted = false,
  className,
}: CalendarWithTimeProps) {
  const [open, setOpen] = React.useState(false)
  const [viewDate, setViewDate] = React.useState(() => {
    if (date) return new Date(date)
    return new Date()
  })
  const hourRef = React.useRef<HTMLDivElement>(null)
  const minRef = React.useRef<HTMLDivElement>(null)

  // Scroll selected hour/minute into view when popover opens
  React.useEffect(() => {
    if (!open) return
    const [hh] = time.split(":")
    requestAnimationFrame(() => {
      const hourBtn = hourRef.current?.querySelector(`[data-hour="${hh}"]`) as HTMLElement | null
      hourBtn?.scrollIntoView({ block: "center" })
    })
  }, [open, time])

  React.useEffect(() => {
    if (date) setViewDate(new Date(date))
  }, [date])

  const selectedDate = date ? new Date(date) : null

  const getDaysInMonth = (d: Date) => {
    const year = d.getFullYear()
    const month = d.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    let startDay = firstDay.getDay() - 1
    if (startDay === -1) startDay = 6
    const days: (Date | null)[] = []
    for (let i = 0; i < startDay; i++) days.push(null)
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i))
    return days
  }

  const handleSelectDate = (d: Date) => {
    onDateChange(format(d, "yyyy-MM-dd"))
  }

  const isSelected = (d: Date) => selectedDate?.toDateString() === d.toDateString()
  const isToday = (d: Date) => d.toDateString() === new Date().toDateString()

  const [currentHour, currentMin] = time.split(":") ?? ["", ""]

  const handleHourClick = (h: string) => {
    const m = currentMin || "00"
    onTimeChange(`${h}:${m}`)
  }

  const handleMinClick = (m: string) => {
    const h = currentHour || "12"
    onTimeChange(`${h}:${m}`)
  }

  const displayLabel = (() => {
    const datePart = selectedDate ? format(selectedDate, "dd/MM/yyyy") : null
    const timePart = time || null
    if (datePart && timePart) return `${datePart}  ${timePart}`
    if (datePart) return datePart
    return null
  })()

  const days = getDaysInMonth(viewDate)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full p-3 border rounded-lg transition-all flex items-center justify-between text-left text-sm font-medium",
            "hover:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
            highlighted
              ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-800"
              : "bg-transparent border-[rgb(var(--color-border))]",
            className
          )}
          style={!highlighted ? { color: "rgb(var(--color-text-primary))" } : undefined}
        >
          <span className={cn(displayLabel ? "text-[rgb(var(--color-text-primary))]" : "text-[rgb(var(--color-text-muted))]")}>
            {displayLabel ?? placeholder}
          </span>
          <div className="flex items-center gap-1.5 text-[rgb(var(--color-text-muted))]">
            {time && <Clock size={14} />}
            <CalendarIcon size={16} />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0 border-0 shadow-2xl z-[100]" align="start" sideOffset={8}>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-1">
          <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden flex">

            {/* ── Calendar ── */}
            <div className="min-w-[260px]">
              {/* Calendar header */}
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                    className="p-2 rounded-full hover:bg-white/20 transition-colors text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-center">
                    <h3 className="text-white font-bold text-base tracking-wide">
                      {MONTHS[viewDate.getMonth()]}
                    </h3>
                    <p className="text-white/70 text-xs">{viewDate.getFullYear()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                    className="p-2 rounded-full hover:bg-white/20 transition-colors text-white"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Day grid */}
              <div className="p-3">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {DAYS.map((d) => (
                    <div key={d} className="h-7 flex items-center justify-center text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d, i) => (
                    <div key={i} className="aspect-square">
                      {d ? (
                        <button
                          type="button"
                          onClick={() => handleSelectDate(d)}
                          className={cn(
                            "w-full h-full rounded-lg text-xs font-medium transition-all duration-150 relative",
                            "hover:bg-blue-500 hover:text-white hover:scale-105",
                            isSelected(d) && "bg-blue-500 text-white shadow-md scale-105",
                            isToday(d) && !isSelected(d) && "ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-slate-900",
                            !isSelected(d) && !isToday(d) && "text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {d.getDate()}
                        </button>
                      ) : <div />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Today button */}
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date()
                    setViewDate(today)
                    handleSelectDate(today)
                  }}
                  className="w-full py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                >
                  Aujourd'hui
                </button>
              </div>
            </div>

            {/* ── Time picker ── */}
            <div className="border-l border-slate-100 dark:border-slate-700/60 flex flex-col w-[100px]">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-4 flex items-center justify-center">
                <div className="flex items-center gap-1.5 text-white">
                  <Clock size={14} />
                  <span className="text-sm font-bold">{time || "--:--"}</span>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Hours */}
                <div ref={hourRef} className="flex-1 overflow-y-auto border-r border-slate-100 dark:border-slate-700/60 py-1" style={{ height: "calc(7*32px + 24px)" }}>
                  {HOURS.map((h) => {
                    const sel = currentHour === h
                    return (
                      <button
                        key={h}
                        type="button"
                        data-hour={h}
                        onClick={() => handleHourClick(h)}
                        className={cn(
                          "w-full px-1 py-1.5 text-xs font-medium transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20",
                          sel ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold" : "text-slate-600 dark:text-slate-300"
                        )}
                      >
                        {h}h
                      </button>
                    )
                  })}
                </div>
                {/* Minutes */}
                <div ref={minRef} className="flex-1 overflow-y-auto py-1" style={{ height: "calc(7*32px + 24px)" }}>
                  {MINUTES.map((m) => {
                    const sel = currentMin === m
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleMinClick(m)}
                        className={cn(
                          "w-full px-1 py-1.5 text-xs font-medium transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20",
                          sel ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold" : "text-slate-600 dark:text-slate-300"
                        )}
                      >
                        :{m}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
