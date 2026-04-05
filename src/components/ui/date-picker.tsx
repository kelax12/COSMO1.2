"use client"

import * as React from "react"
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  className?: string
}
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
]

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

export function DatePicker({ value, onChange, placeholder: _placeholder = "Sélectionner une date", className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewDate, setViewDate] = React.useState(() => {
    if (value) return new Date(value)
    return new Date()
  })

  const selectedDate = value ? new Date(value) : null

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    
    let startDay = firstDay.getDay() - 1
    if (startDay === -1) startDay = 6
    
    const days: (Date | null)[] = []
    
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    
    return days
  }

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const handleSelectDate = (date: Date) => {
    const formatted = format(date, "yyyy-MM-dd")
    onChange?.(formatted)
    setOpen(false)
  }

  const isSelected = (date: Date) => {
    if (!selectedDate) return false
    return date.toDateString() === selectedDate.toDateString()
  }

  const isToday = (date: Date) => {
    return date.toDateString() === new Date().toDateString()
  }

  const days = getDaysInMonth(viewDate)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full p-3 bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-lg hover:border-blue-400/50 focus:border-blue-500/50 focus:border-2 outline-none transition-all flex items-center justify-between text-left",
              className
            )}
          >
            <span className={cn(
              selectedDate ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"
            )}>
              {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "JJ/MM/AAAA"}
            </span>
            <CalendarIcon className="h-5 w-5 text-slate-400 flex-shrink-0" />
          </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 border-0 shadow-2xl" 
        align="start"
        sideOffset={8}
      >
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-1">
          <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors text-white"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="text-center">
                  <h3 className="text-white font-bold text-lg tracking-wide">
                    {MONTHS[viewDate.getMonth()]}
                  </h3>
                  <p className="text-white/70 text-sm">{viewDate.getFullYear()}</p>
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 rounded-full hover:bg-white/20 transition-colors text-white"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="h-8 flex items-center justify-center text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((date, index) => (
                  <div key={index} className="aspect-square">
                    {date ? (
                      <button
                        type="button"
                        onClick={() => handleSelectDate(date)}
                        className={cn(
                          "w-full h-full rounded-xl text-sm font-medium transition-all duration-200 relative",
                          "hover:bg-blue-500 hover:text-white hover:scale-110 hover:shadow-lg",
                          isSelected(date) && "bg-blue-500 text-white shadow-lg scale-105",
                          isToday(date) && !isSelected(date) && "ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-slate-900",
                          !isSelected(date) && !isToday(date) && "text-slate-700 dark:text-slate-300 hover:text-white"
                        )}
                      >
                        {date.getDate()}
                        {isToday(date) && (
                          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
                        )}
                      </button>
                    ) : (
                      <div className="w-full h-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-4 pb-4">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date()
                    setViewDate(today)
                    handleSelectDate(today)
                  }}
                  className="w-full py-2.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition-colors"
                >
                Aujourd'hui
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
