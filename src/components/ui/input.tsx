import * as React from "react"

import { cn } from "@/lib/utils"

// `forwardRef` OBLIGATOIRE tant que le projet est sur React 18 (même raison
// que `Button`, cf. son commentaire). Trouvé cassé le 2026-09-03 (A-6) :
// `AdminMfaGate` pose `ref={inputRef}` sur cet `Input` pour autofocus le
// champ de code TOTP au montage — sans `forwardRef`, `inputRef.current`
// restait `null` et `inputRef.current?.focus()` ne faisait rien. Même classe
// de bug que `Button`, symptôme silencieux (pas d'erreur, juste un focus qui
// n'arrive jamais).
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, type, ...props }, ref) {
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
)

export { Input }
