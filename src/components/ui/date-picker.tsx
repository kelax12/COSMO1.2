"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"

interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Sélectionner une date",
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selectedDate = value ? new Date(value + "T12:00:00") : undefined

  const handleSelect = (date: Date | undefined) => {
    if (!date) return
    onChange?.(format(date, "yyyy-MM-dd"))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-between font-normal",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <span>
            {selectedDate
              ? format(selectedDate, "dd/MM/yyyy")
              : placeholder}
          </span>
          <CalendarIcon size={16} data-icon="inline-end" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0 z-[100]" align="start" sideOffset={8}>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={fr}
          initialFocus
        />
        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm"
            onClick={() => handleSelect(new Date())}
          >
            Aujourd'hui
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
