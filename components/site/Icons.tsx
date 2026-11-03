import type { FeatureIcon } from "../../lib/content/types.ts";

type IconProps = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base} strokeWidth={2}>
      <path d="M4.5 10.5l3.5 3.5 7.5-8" />
    </svg>
  );
}

export function DashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base} strokeWidth={2}>
      <path d="M5 10h10" />
    </svg>
  );
}

export function ArrowIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base} strokeWidth={1.8}>
      <path d="M4 10h11m0 0l-4.5-4.5M15 10l-4.5 4.5" />
    </svg>
  );
}

export function MenuIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base} strokeWidth={1.8}>
      <path d="M3 6h14M3 10h14M3 14h14" />
    </svg>
  );
}

export function CloseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base} strokeWidth={1.8}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function PlusIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} {...base} strokeWidth={1.8}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

const FEATURE_PATHS: Record<FeatureIcon, React.ReactNode> = {
  script: (
    <>
      <path d="M7 3.5h7.5L19 8v12.5H7z" />
      <path d="M14.5 3.5V8H19M10 12h6M10 15.5h6M10 19h3.5" />
    </>
  ),
  motion: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M10.5 9.5l4.5 2.5-4.5 2.5z" />
      <path d="M3.5 9h2M3.5 15h2M18.5 9h2M18.5 15h2" />
    </>
  ),
  product: (
    <>
      <path d="M5.5 8.5h13l-1 11.5h-11z" />
      <path d="M9 8.5V7a3 3 0 016 0v1.5" />
    </>
  ),
  photo: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M20.5 15.5l-4.5-4.5-8.5 8.5" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5v3M9 20.5h6" />
    </>
  ),
  formats: (
    <>
      <rect x="3.5" y="7" width="9" height="11" rx="1.5" />
      <rect x="14" y="4" width="6.5" height="11" rx="1.5" />
      <path d="M14 18.5h6.5" />
    </>
  ),
  quality: (
    <>
      <path d="M12 3.5l7 3v5.5c0 4.2-3 7.4-7 8.5-4-1.1-7-4.3-7-8.5V6.5z" />
      <path d="M9 12.2l2.2 2.2 4-4.4" />
    </>
  ),
  honest: (
    <>
      <path d="M4 17.5a8 8 0 0116 0" />
      <path d="M12 17.5l3.5-5" />
      <circle cx="12" cy="17.5" r="1.2" />
    </>
  ),
};

export function FeatureGlyph({ name, className = "h-6 w-6" }: { name: FeatureIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      {FEATURE_PATHS[name]}
    </svg>
  );
}
