'use client';

import type { ReactNode } from 'react';

import { ChevronDown } from '@components/icons/icons';

import { useNavDisclosure } from '@hooks/use-nav-disclosure';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

interface NavDisclosureLink {
  readonly href: string;
  readonly label: string;
  readonly isCurrent: boolean;
  /** Listed so the way exists, but not followable yet; `hint` says why. */
  readonly isDisabled?: boolean;
  readonly hint?: string | undefined;
}

interface NavDisclosureProps {
  /** What the button says: the group's name, or on a narrow screen the current section. */
  readonly label: ReactNode;
  readonly links: readonly NavDisclosureLink[];
  /** Marks the button like a current tab when one of its links is the current page. */
  readonly isCurrent: boolean;
  readonly className?: string;
  /** Where the panel opens from: the button's left edge, or its right one near the screen edge. */
  readonly align?: 'start' | 'end';
  /** Optional status about a bounded list of destinations. */
  readonly notice?: ReactNode;
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
  notice,
}: NavDisclosureProps) {
  const { isOpen, panelId, rootRef, buttonRef, toggle, close } = useNavDisclosure();

  return (
    <div ref={rootRef} className={cn('relative flex', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={toggle}
        className={cn(
          'flex items-center gap-1 whitespace-nowrap border-b-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
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
          'absolute top-full z-40 mt-px max-h-80 min-w-48 max-w-72 overflow-y-auto rounded-token border border-border bg-surface py-1 shadow-lg',
          align === 'end' ? 'right-0' : 'left-0',
        )}
      >
        {links.map((link) => (
          <li key={link.href}>
            {link.isDisabled === true ? (
              <span
                aria-disabled="true"
                title={link.hint}
                className="block cursor-not-allowed px-3 py-2 text-sm text-copy-muted/60"
              >
                {link.label}
              </span>
            ) : (
              <Link
                href={link.href}
                aria-current={link.isCurrent ? 'page' : undefined}
                onClick={close}
                className={cn(
                  'block break-words px-3 py-2 text-sm outline-none hover:bg-canvas focus-visible:bg-canvas focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
                  link.isCurrent ? 'font-medium text-copy' : 'text-copy-muted',
                )}
              >
                {link.label}
              </Link>
            )}
          </li>
        ))}
        {notice !== undefined && <li className="border-t border-border px-3 py-2">{notice}</li>}
      </ul>
    </div>
  );
}
