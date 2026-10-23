/* Логотип: монограмма Hf и надпись Hear Function — Fraunces полужирный, мягкие засечки (ось SOFT). */
import { cn } from '@/lib/utils';

export function LogoMark({ size = 40, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="8" fill="var(--color-accent, #2f4bd6)" />
      <text x="16" y="23" textAnchor="middle" fill="#fff" style={{ fontFamily: "var(--font-logo), Georgia, serif", fontWeight: 600, fontVariationSettings: "'SOFT' 100, 'opsz' 144", letterSpacing: "-0.04em" }} fontSize="19">H<tspan fontStyle="italic">f</tspan></text>
    </svg>
  );
}

export default function Logo({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <LogoMark />
      <span className="font-logo text-[26px] font-semibold text-ink tracking-[-0.02em] whitespace-nowrap leading-none [font-variation-settings:'SOFT'_100,'opsz'_144]">Hear Function</span>
    </span>
  );
}
