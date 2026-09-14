import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  title,
}: {
  className?: string;
  children: ReactNode;
  title: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-bg/70" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[min(100%-2rem,28rem)] max-h-[88vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-panel",
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <DialogPrimitive.Title className="text-lg font-medium tracking-tight">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close className="rounded-sm p-2 text-muted hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
