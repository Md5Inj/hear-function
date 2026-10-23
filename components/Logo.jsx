/* Логотип: монограмма Hf (hear function) на акцентном квадрате и надпись. */
import { cn } from '@/lib/utils';

export function LogoMark({ size = 40, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="var(--color-accent, #2f4bd6)" />
      <text x="15.5" y="22.5" textAnchor="middle" fill="#fff" fontFamily="var(--font-serif), Georgia, 'Times New Roman', serif" fontSize="18" fontWeight="500" letterSpacing="-0.5">H<tspan fontStyle="italic" dx="-0.5">f</tspan></text>
    </svg>
  );
}

export default function Logo({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <LogoMark />
      <span className="font-serif text-[26px] font-medium text-ink tracking-[-0.01em] whitespace-nowrap leading-none">hear function</span>
    </span>
  );
}
