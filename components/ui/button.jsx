'use client';
/* Кнопка в духе shadcn/ui: варианты через cva, цвета из наших токенов. Повторяет прежние .btn / .btn.primary / .btn.quiet / .btn.danger / .btn.mini. */
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-medium leading-tight cursor-pointer transition-colors disabled:opacity-35 disabled:cursor-default whitespace-nowrap',
  {
    variants: {
      variant: {
        outline: 'border border-ink text-ink bg-transparent hover:bg-tint',
        primary: 'border border-accent bg-accent text-white hover:bg-[#2740b8]',
        quiet: 'border border-rule text-ink-2 hover:border-ink hover:text-ink',
        danger: 'border border-bad bg-bad text-white hover:bg-[#a83522]',
        ghost: 'text-ink-2 hover:bg-tint hover:text-ink',
      },
      size: {
        default: 'px-5 py-[11px]',
        primary: 'px-6 py-3',
        mini: 'px-3.5 py-[7px] text-sm',
        icon: 'h-[42px] w-[42px] p-0',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
);

export function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
export default Button;
