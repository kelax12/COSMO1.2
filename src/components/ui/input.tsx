import * as React from "react"

import { cn } from "@/lib/utils"

// `ref` est une prop ordinaire depuis React 19 (migration du 2026-10-23).
// Sous React 18 il fallait un `forwardRef` : trouvé cassé le 2026-09-03
// (A-6), `AdminMfaGate` pose `ref={inputRef}` sur cet `Input` pour autofocus
// le champ de code TOTP au montage, et sans `forwardRef` `inputRef.current`
// restait `null`. Témoin : `input.test.tsx`.
function Input({ className, type, ref, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-[rgb(var(--color-border))] flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-all outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "hover:border-[rgb(var(--color-border-strong))]",
        "focus:border-[rgb(var(--color-accent))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--color-accent))]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
