import type { ReactNode } from 'react';

import { Badge } from '@components/ui/badge';

import type { IconComponent } from '@/types/icons';

export interface StatusChipProps {
  readonly tone: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  /** Always drawn: a status is never told by its colour alone. */
  readonly icon: IconComponent;
  /** The status as words, already translated. */
  readonly children: ReactNode;
  /** Only the icon is drawn (the word stays for assistive technology): where there is no room for a word. */
  readonly isIconOnly?: boolean;
}

/** A status as icon, word and tone, so every state of every booking screen is drawn the same way. */
export function StatusChip({ tone, icon: Icon, children, isIconOnly = false }: StatusChipProps) {
  return (
    <Badge variant={tone} className={isIconOnly ? 'px-1' : undefined}>
      <Icon className="size-3" aria-hidden="true" />
      {isIconOnly ? <span className="sr-only">{children}</span> : children}
    </Badge>
  );
}
