import { OWNERS, type OwnerId } from "@/lib/trades";
import { cn } from "@/lib/utils";

const TONE: Record<OwnerId, string> = {
  J: "bg-sky-500/25 text-sky-200",
  A: "bg-amber-500/25 text-amber-200",
  P: "bg-violet-500/25 text-violet-200",
};

export function OwnerBadge({ owner, className }: { owner: OwnerId | null; className?: string }) {
  if (!owner) {
    return (
      <span className={cn("inline-flex size-6 items-center justify-center rounded-full bg-elevated text-[11px] text-subtle", className)}>
        ?
      </span>
    );
  }
  return (
    <span
      title={OWNERS.find((o) => o.id === owner)?.name}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-medium",
        TONE[owner],
        className,
      )}
    >
      {owner}
    </span>
  );
}

export function OwnerPicker({
  value,
  onChange,
}: {
  value: OwnerId | null;
  onChange: (id: OwnerId | null) => void;
}) {
  return (
    <div className="flex gap-2">
      {OWNERS.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.name}
          onClick={() => onChange(value === o.id ? null : o.id)}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full text-xs font-medium",
            value === o.id ? TONE[o.id] : "bg-elevated text-subtle",
          )}
        >
          {o.id}
        </button>
      ))}
    </div>
  );
}
