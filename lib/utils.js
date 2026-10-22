import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
/* cn: объединяет классы Tailwind, разрешая конфликты (как в shadcn/ui) */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
