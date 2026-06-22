import * as React from "react"

import { cn } from "@/shared/utils/cn"

function Label({ className, required, children, ...props }: React.ComponentProps<"label"> & { required?: boolean }) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm font-medium text-foreground mb-1.5 leading-relaxed select-none",
        className
      )}
      {...props}
    >
      {children}
      {required && <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>}
    </label>
  )
}

export { Label }
