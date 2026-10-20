'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ChevronDown } from '@components/ui/icons';

import { useDismiss } from '@hooks/use-dismiss';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface NavDisclosureLink {
  readonly href: string;
  readonly label: string;
  readonly isCurrent: boolean;
}

export interface NavDisclosureProps {
  /** What the button says: the group's name, or on a narrow screen the current section. */
  readonly label: ReactNode;
  readonly links: readonly NavDisclosureLink[];
  /** Marks the button like a current tab when one of its links is the current page. */
  readonly isCurrent: boolean;
  readonly className?: string;
  /** Where the panel opens from: the button's left edge, or its right one near the screen edge. */
  readonly align?: 'start' | 'end';
}

/**
 * A few navigation links behind one button: the disclosure pattern for site
 * navigation (a button and a list of links, not an ARIA menu). It closes on
 * Escape (focus goes back to the button), on a click outside, after a link
 * is followed, and when the page is hidden (a left page stays mounted).
 */
export function NavDisclosure({
  label,
  links,
  isCurrent,
  className,
  align = 'start',
}: NavDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Activity hiding the page closes it, so it is not open when the page is shown again.
  useLayoutEffect(
    () => () => {
      setIsOpen(false);
    },
    [],
  );

  useDismiss(isOpen, rootRef, (reason) => {
    setIsOpen(false);
    if (reason === 'escape') {
      buttonRef.current?.focus();
    }
  });

  return (
    <div ref={rootRef} className={cn('relative flex', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        className={cn(
          'flex items-center gap-1 whitespace-nowrap border-b-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
          isCurrent
            ? 'border-primary text-copy'
            : 'border-transparent text-copy-muted hover:text-copy',
        )}
      >
        {label}
        <ChevronDown
          className={cn(
            'size-3.5 transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      <ul
        id={panelId}
        hidden={!isOpen}
        className={cn(
          'absolute top-full z-40 mt-px min-w-48 rounded-token border border-border bg-surface py-1 shadow-lg',
          align === 'end' ? 'right-0' : 'left-0',
        )}
      >
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={link.isCurrent ? 'page' : undefined}
              onClick={() => {
                setIsOpen(false);
              }}
              className={cn(
                'block px-3 py-2 text-sm outline-none hover:bg-canvas focus-visible:bg-canvas focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                link.isCurrent ? 'font-medium text-copy' : 'text-copy-muted',
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
