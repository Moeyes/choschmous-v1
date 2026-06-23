import { cn } from "@/shared/utils/cn";

interface MinistryCrestProps {
  /** Accessible name for the crest (pass a translated ministry name). */
  label: string;
  className?: string;
}

/**
 * Placeholder for the official MoEYS seal/logo.
 *
 * TODO(asset): drop the real ministry seal into `frontend/public/` (e.g.
 * `moeys-seal.svg`) and replace this SVG with a `next/image`, keeping the same
 * `label`/`className` contract so callers don't change. Until then this renders
 * an accessible, brand-coloured emblem placeholder.
 */
export function MinistryCrest({ label, className }: MinistryCrestProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={label}
      className={cn("text-primary", className)}
      fill="none"
    >
      <title>{label}</title>
      {/* Outer seal ring */}
      <circle cx="24" cy="24" r="22" fill="hsl(var(--primary-50))" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
      {/* Stylised temple silhouette (national emblem motif) */}
      <path
        d="M24 11l4 4h-8l4-4zm-9 8h18v2H15v-2zm1 4h16l-1.5 11h-13L16 23zm-2 12h20v2H14v-2z"
        fill="currentColor"
      />
    </svg>
  );
}
