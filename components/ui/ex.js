/* Общие классы экранов упражнений (Tailwind), чтобы не дублировать строки в каждом упражнении. */
export const STAGE = 'pt-[30px] max-[900px]:pt-6';
export const ACTIONS = 'flex flex-wrap items-center gap-2.5';
export const PARTLINE = 'mt-7 text-ink-2 text-[15px]';
export const KEYS = 'flex flex-wrap gap-2.5 mt-[22px]';
export const KEY = 'min-w-[72px] h-[76px] px-3.5 rounded-[8px] border border-rule bg-paper font-serif text-[30px] text-ink cursor-pointer transition-colors hover:border-ink active:translate-y-px disabled:cursor-default';
export const KEY_CHROM = 'bg-tint text-[26px]';
export const KEY_OK = 'bg-ok-bg border-ok text-ok';
export const KEY_BAD = 'bg-bad-bg border-bad text-bad';
export const LINK = 'text-accent hover:underline cursor-pointer bg-transparent border-0 p-0';
export const ROMAN = 'font-serif text-[22px] tracking-[0.03em]';
export function feedbackCls(answered, ok) { return 'mt-6 pl-4 border-l-[3px] ' + (answered ? (ok ? 'block border-ok' : 'block border-bad') : 'hidden border-transparent'); }
