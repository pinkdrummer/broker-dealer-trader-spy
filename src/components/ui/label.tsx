import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("block text-xs font-medium text-muted mb-2", className)}
      {...props}
    />
  );
}
