import { cn } from '@lib/utils';

import type { ControlProps } from './control-props';

/** The column counts come from the platform's field options, so the panel never restates them. */
export function ColumnsControl({ labelId, field, value, onChange, onCommit }: ControlProps) {
  return (
    <div role="group" aria-labelledby={labelId} className="flex gap-1">
      {field.options.map(({ value: count }) => (
        <button
          key={count}
          type="button"
          aria-pressed={value === count}
          onClick={() => {
            onChange(count);
            onCommit();
          }}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-token-sm border text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent',
            value === count
              ? 'border-accent bg-accent text-accent-foreground'
              : 'border-border bg-surface text-copy hover:border-secondary',
          )}
        >
          {count}
        </button>
      ))}
    </div>
  );
}
