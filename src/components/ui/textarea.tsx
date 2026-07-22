import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 border-[rgb(var(--color-border))] flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-all outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-[rgb(var(--color-border-strong))]",
        "focus:border-[rgb(var(--color-accent))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-accent))]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
