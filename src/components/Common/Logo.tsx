export function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
        <defs>
          <linearGradient id="sb-logo" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2f6bff" />
            <stop offset="1" stopColor="#3ee6f5" />
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="#0a1228" stroke="rgba(62,230,245,0.3)" />
        <path d="M14 40c6-10 12-14 18-14s12 4 18 14" stroke="url(#sb-logo)" strokeWidth="4" strokeLinecap="round" />
        <circle cx="14" cy="40" r="4" fill="#2f6bff" />
        <circle cx="50" cy="40" r="4" fill="#3ee6f5" />
        <circle cx="32" cy="26" r="4" fill="#7cf3ff" />
        <path d="M24 48h16" stroke="url(#sb-logo)" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      </svg>
      {withText && (
        <span className="font-display text-lg font-semibold tracking-tight text-white">
          Sign<span className="bg-gradient-to-r from-electric-400 to-cyan-400 bg-clip-text text-transparent">Bridge</span>
        </span>
      )}
    </span>
  );
}
