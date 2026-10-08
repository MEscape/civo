import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

export interface FieldMessageProps {
  readonly id: string;
  readonly message?: ReactNode;
  readonly className?: string;
}

export function FieldMessage({ id, message, className }: FieldMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className={cn('text-xs text-danger', className)}>
      {message}
    </p>
  );
}
