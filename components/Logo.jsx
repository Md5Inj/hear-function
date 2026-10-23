/* Логотип: монограмма Hf (hear function) на акцентном квадрате и надпись. */
import { cn } from '@/lib/utils';

export function LogoMark({ size = 40, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="var(--color-accent, #2f4bd6)" />
      <text x="15.5" y="23" textAnchor="middle" fill="#fff" style={{ fontFamily: "var(--font-logo), Georgia, serif" }} fontSize="23" fontWeight="400" letterSpacing="-0.4">H<tspan fontStyle="italic" dx="-0.3">f</tspan></text>
    </svg>
  );
}

export default function Logo({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <LogoMark />
      <span className="font-logo text-[30px] text-ink tracking-[-0.005em] whitespace-nowrap leading-none">Hear Function</span>
    </span>
  );
}
