'use client';

import { NavDisclosure } from '@components/layout/nav-disclosure';
import { Alert } from '@components/ui/alert';

import { usePathname } from '@i18n';

import { bookingRoutes } from '../../routes';

export interface SwitchableWorkspace {
  readonly id: string;
  readonly name: string;
}

export interface WorkspaceSwitcherProps {
  readonly current: SwitchableWorkspace;
  /** The workspaces the person can go to, the current one included or not. */
  readonly workspaces: readonly SwitchableWorkspace[];
  /** The list is partial: auth bounds the selector. */
  readonly isTruncated: boolean;
  /** Passed in, not looked up: the bar sits outside the screens' message provider, and a client lookup would ship every booking text. */
  readonly labels: {
    readonly switch: string;
    readonly all: string;
    readonly truncated: string;
  };
}

/**
 * The workspace's name in the bar, which opens the other workspaces, as the website's name opens the
 * other websites. Choosing one goes to that workspace's overview (the areas of another workspace may
 * not exist for this person, the overview always does), and the last choice leads to the list of all.
 */
export function WorkspaceSwitcher({
  current,
  workspaces,
  isTruncated,
  labels,
}: WorkspaceSwitcherProps) {
  const pathname = usePathname();
  const choices = workspaces.some(({ id }) => id === current.id)
    ? workspaces
    : [current, ...workspaces];

  return (
    <NavDisclosure
      label={
        <>
          <span className="sr-only">{labels.switch}: </span>
          <span className="max-w-24 truncate font-heading font-semibold text-copy sm:max-w-56">
            {current.name}
          </span>
        </>
      }
      links={[
        ...choices.map(({ id, name }) => ({
          href: bookingRoutes.admin(id),
          label: name,
          isCurrent: pathname.startsWith(bookingRoutes.admin(id)),
        })),
        { href: bookingRoutes.workspaces(), label: labels.all, isCurrent: false },
      ]}
      isCurrent={false}
      notice={
        isTruncated ? (
          <Alert variant="warning" role="status">
            {labels.truncated}
          </Alert>
        ) : undefined
      }
      className="mr-1 shrink-0 self-stretch sm:mr-3"
    />
  );
}
