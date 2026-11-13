import type { ReactNode } from 'react';

import { ChevronDown, ChevronUp, Search } from '@components/icons/icons';
import { Button, buttonVariants } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { TABS_LIST_CLASS_NAME, TABS_TRIGGER_CLASS_NAME } from '@components/ui/tabs-styles';

import { Link } from '@i18n';

import type { SortSpec } from '@lib/pagination';
import { cn } from '@lib/utils';

/* -------------------------------------------------------------------------- */
/* FilterBar                                                                  */
/* -------------------------------------------------------------------------- */

export interface FilterBarProps {
  /** The address the filters are applied to: the filter state is the address, so a view can be shared. */
  readonly action: string;
  /** What the filters filter; the search landmark's name. */
  readonly label: string;
  readonly applyLabel: string;
  readonly resetLabel: string;
  /** The address without any filter. */
  readonly resetHref: string;
  /** `FilterSearchField` and `FilterSelect`s; hidden inputs for state to keep (a view, a date). */
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

/**
 * A named search landmark with a GET form, so filters live in the address and
 * work without client JavaScript. Key this component by the applied filters to
 * reset uncontrolled fields after URL navigation.
 */
export function FilterBar({
  action,
  label,
  applyLabel,
  resetLabel,
  resetHref,
  children,
  className,
}: FilterBarProps) {
  return (
    <form
      method="get"
      action={action}
      role="search"
      aria-label={label}
      // `items-end` keeps the buttons level with the controls when a field has a label above it.
      className={cn('flex flex-wrap items-end gap-3', className)}
    >
      {children}
      <div className="flex gap-1">
        <Button type="submit" variant="outline" className="h-9">
          {applyLabel}
        </Button>
        <Link
          href={resetHref}
          className={cn(buttonVariants({ variant: 'ghost' }), 'h-9 text-copy-muted')}
        >
          {resetLabel}
        </Link>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* FilterSearchField                                                          */
/* -------------------------------------------------------------------------- */

export interface FilterSearchFieldProps {
  readonly id: string;
  readonly name: string;
  /** Read out, not shown: the placeholder tells the sighted what to type. */
  readonly label: string;
  readonly defaultValue: string;
  readonly placeholder: string;
  /** Adjusts the wrapper's sizing; by default it grows to fill the row. */
  readonly className?: string | undefined;
}

/**
 * The text search of a `FilterBar` for URL-driven listings, sized to share the
 * row with the selects. It is uncontrolled and the full value stays editable.
 */
export function FilterSearchField({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  className,
}: FilterSearchFieldProps) {
  return (
    // Grows to fill the row, never below 14rem, but shrinks to fit a narrower container.
    <div className={cn('relative min-w-[min(14rem,100%)] flex-1', className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-copy-muted"
        aria-hidden="true"
      />
      <Input
        id={id}
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="ps-9"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* FilterSelect                                                               */
/* -------------------------------------------------------------------------- */

export interface FilterSelectProps {
  readonly id: string;
  /** The query parameter it submits in a GET filter form. */
  readonly name: string;
  /** Read out, not shown: the chosen option says what the select filters. */
  readonly label: string;
  readonly defaultValue: string;
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>;
  /**
   * Sizes the wrapper; the trigger then fills it. Without one, the trigger fits
   * its content.
   */
  readonly className?: string | undefined;
}

/**
 * A select of a filter strip, uncontrolled so changing it never submits
 * anything: the value travels with the form's Apply. It has no visible label,
 * so every control of the strip shares one height and one line. Each option
 * must name what it filters ("Any role", "25 per page").
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
    <div className={cn('min-w-0 max-w-full', className === undefined && 'sm:max-w-64', className)}>
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger
          id={id}
          // `max-w-full` stops a long chosen label from stretching the row.
          className={cn('min-w-36 max-w-full gap-2', className === undefined ? 'w-auto' : 'w-full')}
        >
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

/* -------------------------------------------------------------------------- */
/* FilterChips                                                                */
/* -------------------------------------------------------------------------- */

/** One quick filter: a link to the list narrowed to one value of a dimension. */
export interface FilterChip {
  readonly key: string;
  readonly href: string;
  /** Translated, and may carry the count ("Pages (4)"). */
  readonly label: string;
  readonly isActive: boolean;
}

/**
 * Quick filters for one dimension of a list (its area, its status): one press narrows the list,
 * without opening a select and applying. Address-backed like `FilterBar`, the active chip marks
 * itself as the current page. Sits above the `FilterBar` of the same list.
 */
export function FilterChips({
  label,
  chips,
}: {
  /** Names the navigation landmark, e.g. "Areas". */
  readonly label: string;
  readonly chips: readonly FilterChip[];
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              aria-current={chip.isActive ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: chip.isActive ? 'default' : 'ghost', size: 'sm' }),
                !chip.isActive && 'text-copy-muted',
              )}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The select value that means "no restriction" in every filter bar. */
export const ANY_FILTER_VALUE = 'any';

/* -------------------------------------------------------------------------- */
/* SortLink                                                                   */
/* -------------------------------------------------------------------------- */

export type AriaSort = 'ascending' | 'descending' | undefined;

/** The `aria-sort` of one column given the list's current sort. */
export function ariaSortOf<Field extends string>(sort: SortSpec<Field>, field: Field): AriaSort {
  if (sort.field !== field) {
    return undefined;
  }
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

/** A column heading that sorts by its field; the arrow shows the current direction. */
export function SortLink({
  href,
  label,
  direction,
}: {
  readonly href: string;
  readonly label: string;
  readonly direction: AriaSort;
}) {
  const Arrow = direction === 'descending' ? ChevronDown : ChevronUp;
  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1 rounded-sm hover:text-copy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {label}
      <Arrow
        className={direction === undefined ? 'size-3.5 opacity-0' : 'size-3.5'}
        aria-hidden="true"
      />
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* LinkTabs                                                                   */
/* -------------------------------------------------------------------------- */

interface LinkTab {
  readonly key: string;
  readonly label: string;
  readonly href: string;
}

/**
 * Address-backed tabs remain usable without JavaScript and mark one current destination. They
 * look like `Tabs` (the strip and tab styles are shared), but wrap onto further lines when the
 * labels do not fit, since they are page titles of unknown length.
 */
export function LinkTabs({
  label,
  activeKey,
  tabs,
}: {
  readonly label: string;
  readonly activeKey: string;
  readonly tabs: readonly LinkTab[];
}) {
  return (
    <nav aria-label={label} className="min-w-0">
      <ul className={cn(TABS_LIST_CLASS_NAME, 'h-auto max-w-full flex-wrap justify-start')}>
        {tabs.map((tab) => (
          <li key={tab.key} className="min-w-0">
            <Link
              href={tab.href}
              aria-current={tab.key === activeKey ? 'page' : undefined}
              className={cn(
                TABS_TRIGGER_CLASS_NAME,
                'max-w-full whitespace-normal [overflow-wrap:anywhere]',
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
