import { Label } from '@components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';

import { cn } from '@lib/utils';

export interface FilterSelectProps {
  readonly id: string;
  /** The query parameter it submits in a GET filter form. */
  readonly name: string;
  /** Read out, not shown: the chosen option says what the select filters. */
  readonly label: string;
  readonly defaultValue: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  readonly className?: string;
}

/**
 * A select of a filter strip: no visible label, so every control of the strip
 * shares one height and one line. Each option must name what it filters
 * ("Any role", "25 per page").
 */
export function FilterSelect({
  id,
  name,
  label,
  defaultValue,
  options,
  className,
}: FilterSelectProps) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger id={id} className={cn('min-w-36 gap-2', className ? 'w-full' : 'w-auto')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
