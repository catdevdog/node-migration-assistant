import type { ReactNode } from 'react';

type BadgeVariant = 'ai' | 'rule' | 'danger' | 'warning' | 'review' | 'safe' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  ai: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
  rule: 'bg-gray-600/20 text-gray-400 border-gray-500/30',
  danger: 'bg-red-600/20 text-red-400 border-red-500/30',
  warning: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
  review: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
  safe: 'bg-green-600/20 text-green-400 border-green-500/30',
  info: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
};

export function Badge({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5
        text-xs font-medium rounded border
        ${VARIANT_STYLES[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
