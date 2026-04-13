"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function InputGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex items-center w-full border rounded-lg overflow-hidden transition-colors",
        "border-[rgb(var(--color-border))] focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500",
        className
      )}
      {...props}
    />
  )
}

function InputGroupAddon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "flex items-center justify-center px-3 py-2.5 h-11 shrink-0",
        "bg-[rgb(var(--color-hover))] border-r border-[rgb(var(--color-border))]",
        "text-[rgb(var(--color-text-muted))]",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input-group-input"
      className={cn(
        "flex-1 min-w-0 px-3 py-2.5 h-11 bg-transparent text-sm",
        "text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))]",
        "focus:outline-none",
        className
      )}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon, InputGroupInput }
