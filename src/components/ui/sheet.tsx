import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;

export function SheetContent({
  className,
  children,
  title,
  subtitle,
}: {
  className?: string;
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-bg/50" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-xl border border-border bg-surface p-5 shadow-panel md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-full md:max-w-md md:max-h-none md:rounded-none md:rounded-l-xl",
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-mono text-base font-medium tracking-tight text-pretty">
              {title}
            </DialogPrimitive.Title>
            {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <DialogPrimitive.Close className="rounded-sm p-2 text-muted hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
