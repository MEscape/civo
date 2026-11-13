'use client';

import type { ReactNode } from 'react';

import { Check, ChevronDown } from '@components/icons/icons';
import { Button } from '@components/ui/button';

import { useAnchoredPosition } from '@hooks/use-anchored-position';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

import { useDisclosureMenu } from '../../hooks/use-disclosure-menu';

export interface ActionMenuOption {
  readonly href: string;
  readonly title: string;
  readonly description?: string | undefined;
  /** A face for the option, left of its name: a tile, an icon. */
  readonly leading?: ReactNode;
  /** The option the person is on: marked, so the list also says where they are. */
  readonly isCurrent?: boolean;
}

export interface ActionMenuProps {
  readonly label: string;
  /** Left of the label, inside the button: what the menu is about (the location, with its tile). */
  readonly leading?: ReactNode;
  readonly options: readonly ActionMenuOption[];
  readonly variant?: 'default' | 'outline';
  readonly size?: 'default' | 'sm';
  /** Opens against the right edge of the button (the default) or its left one. */
  readonly align?: 'start' | 'end';
}

/**
 * Several ways to go on behind one button (add a service here or there, make one new or take one
 * over). The disclosure pattern (a button and a list of links, not an ARIA menu): it closes on
 * Escape (focus goes back to the button), on a press outside and after a link is followed.
 */
export function ActionMenu({
  label,
  leading,
  options,
  variant = 'default',
  size = 'default',
  align = 'end',
}: ActionMenuProps) {
  const { isOpen, panelId, rootRef, buttonRef, toggle, close } = useDisclosureMenu();
  useAnchoredPosition(isOpen, rootRef, panelId);

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-full">
      <Button
        ref={buttonRef}
        type="button"
        variant={variant}
        size={size}
        className={cn(
          'h-auto min-w-0 max-w-full py-1 text-start whitespace-normal',
          size === 'sm' ? 'min-h-7' : 'min-h-8',
        )}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={toggle}
      >
        {leading !== undefined && <span className="shrink-0">{leading}</span>}
        <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </Button>
      <ul
        data-align={align}
        id={panelId}
        hidden={!isOpen}
        className="fixed start-0 top-0 z-50 max-h-80 w-72 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-token border border-border bg-surface p-1 shadow-lg"
      >
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              aria-current={option.isCurrent === true ? 'page' : undefined}
              onClick={close}
              className="flex items-start justify-between gap-2 rounded-token px-3 py-2 outline-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="flex min-w-0 items-center gap-3">
                {option.leading !== undefined && <span className="shrink-0">{option.leading}</span>}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-copy [overflow-wrap:anywhere]">
                    {option.title}
                  </span>
                  {option.description !== undefined && (
                    <span className="block text-xs text-copy-muted [overflow-wrap:anywhere]">
                      {option.description}
                    </span>
                  )}
                </span>
              </span>
              {option.isCurrent === true && (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-copy" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
