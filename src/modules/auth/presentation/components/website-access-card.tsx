'use client';

import { CheckboxField } from '@components/shared/checkbox-field';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Trash2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { ROLES } from '../../application/contracts/auth-constraints';
import { ROLE_HINT_KEYS, ROLE_MESSAGE_KEYS } from '../messages/message-keys';

import type { TenantRole } from '../../application/contracts/auth-constraints';

/** How a website's row differs from what is stored. */
export type AccessChange = 'none' | 'new' | 'changed' | 'removed';

export interface WebsiteAccessCardProps {
  /** Unique within the page: ids of the checkboxes. */
  readonly idPrefix: string;
  readonly websiteName: string;
  readonly roles: readonly TenantRole[];
  readonly change: AccessChange;
  readonly onToggleRole: (role: TenantRole, isChecked: boolean) => void;
  /** Takes the website away (or, for one just added, drops the row); for one that is marked, undoes the mark. */
  readonly onToggleRemoved: () => void;
}

const CHANGE_BADGES = {
  new: { variant: 'info', key: 'platformUsers.access.state.new' },
  changed: { variant: 'warning', key: 'platformUsers.access.state.changed' },
  removed: { variant: 'danger', key: 'platformUsers.access.state.removed' },
} as const;

/**
 * One website of a person's access, in the dialog: its name and what changed
 * about it so far, each role with what it allows, and a way to take it away.
 * A website marked for removal keeps its card, dimmed, so the mark can be undone.
 */
export function WebsiteAccessCard({
  idPrefix,
  websiteName,
  roles,
  change,
  onToggleRole,
  onToggleRemoved,
}: WebsiteAccessCardProps) {
  const t = useTranslations('auth');
  const isRemoved = change === 'removed';
  const badge = change === 'none' ? null : CHANGE_BADGES[change];

  return (
    <li className="overflow-hidden rounded-token border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-canvas px-3 py-2">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium text-copy">
          <span className={isRemoved ? 'truncate line-through' : 'truncate'}>{websiteName}</span>
          {badge !== null && <Badge variant={badge.variant}>{t(badge.key)}</Badge>}
        </p>
        <Button
          type="button"
          variant={isRemoved ? 'ghost' : 'destructive-ghost'}
          size="sm"
          onClick={onToggleRemoved}
        >
          {isRemoved ? (
            t('platformUsers.access.keep')
          ) : (
            <>
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('platformUsers.access.remove')}
              <span className="sr-only"> {websiteName}</span>
            </>
          )}
        </Button>
      </div>
      <fieldset disabled={isRemoved} className="grid gap-2 p-3 disabled:opacity-50 sm:grid-cols-2">
        <legend className="sr-only">
          {t('platformUsers.access.rolesOf', { site: websiteName })}
        </legend>
        {ROLES.map((role) => (
          <div
            key={role}
            className="rounded-token border border-border px-3 py-2 transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-canvas"
          >
            <CheckboxField
              id={`${idPrefix}-${role}`}
              label={t(ROLE_MESSAGE_KEYS[role])}
              hint={t(ROLE_HINT_KEYS[role])}
              checked={roles.includes(role)}
              onChange={(event) => {
                onToggleRole(role, event.target.checked);
              }}
            />
          </div>
        ))}
      </fieldset>
    </li>
  );
}
