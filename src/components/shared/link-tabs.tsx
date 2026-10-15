import { TABS_LIST_CLASS_NAME, TABS_TRIGGER_CLASS_NAME } from '@components/ui/tabs';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface LinkTab {
  readonly key: string;
  readonly label: string;
  readonly href: string;
}

export interface LinkTabsProps {
  /** The name of the navigation for assistive technology. */
  readonly label: string;
  readonly tabs: readonly LinkTab[];
  readonly activeKey: string;
  readonly className?: string;
}

/**
 * Tabs that are addresses: the part shown lives in the URL, so it can be
 * linked to and bookmarked, back and forward work, and only the part shown is
 * read from the server. Looks like `Tabs`; use that one for parts that are
 * only local state.
 */
export function LinkTabs({ label, tabs, activeKey, className }: LinkTabsProps) {
  return (
    <nav
      aria-label={label}
      className={cn(TABS_LIST_CLASS_NAME, 'max-w-full overflow-x-auto', className)}
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === activeKey ? 'page' : undefined}
          className={TABS_TRIGGER_CLASS_NAME}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
