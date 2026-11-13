'use client';

import { useRef, useState, useTransition } from 'react';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { useTranslations } from '@i18n/client';

import { unique } from '@lib/utils';

import { grantPlatformAdminAction } from '../actions/grant-platform-admin-action';
import { removeUserAccessAction } from '../actions/remove-user-access-action';
import { revokePlatformAdminAction } from '../actions/revoke-platform-admin-action';
import { setUserAccessAction } from '../actions/set-user-access-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import type { TenantRole } from '../../application/contracts/auth-constraints';
import type { AccessChange } from '../components/users/website-access-card';

interface UserAccessEditorInput {
  readonly userId: string;
  readonly isPlatformAdmin?: boolean;
  readonly canManagePlatform?: boolean;
  /** Where the person works now, with their roles. */
  readonly memberships: ReadonlyArray<{
    readonly tenantId: string;
    readonly roles: readonly TenantRole[];
  }>;
  /** Every website a person can be given access to. */
  readonly websites: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

type Draft = ReadonlyMap<string, readonly TenantRole[]>;

/** The role a person starts with in a website that is added: the one that changes nothing. */
const STARTING_ROLE: TenantRole = 'viewer';

const sameRoles = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((role) => b.includes(role));

/**
 * The working copy of one person's access: which websites and roles are set
 * now, what changed against what is stored, and the save that sends only the
 * changes, counting as it goes.
 */
export function useUserAccessEditor({
  userId,
  memberships,
  websites,
  isPlatformAdmin = false,
  canManagePlatform = false,
}: UserAccessEditorInput) {
  const t = useTranslations('auth');
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(new Map());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const saving = useRef(false);
  const [original, setOriginal] = useState<Draft>(new Map());
  const [platformAdmin, setPlatformAdmin] = useState(isPlatformAdmin);
  const [originalPlatformAdmin, setOriginalPlatformAdmin] = useState(isPlatformAdmin);

  const nameOf = (tenantId: string) =>
    websites.find((website) => website.id === tenantId)?.name ?? tenantId;
  const addable = websites.filter((website) => !draft.has(website.id));

  function changeOf(tenantId: string, roles: readonly TenantRole[]): AccessChange {
    if (removed.has(tenantId)) {
      return 'removed';
    }
    const before = original.get(tenantId);
    if (before === undefined) {
      return 'new';
    }
    return sameRoles(before, roles) ? 'none' : 'changed';
  }

  const platformAdminChanged = platformAdmin !== originalPlatformAdmin;
  const websiteChangeCount = [...draft].filter(
    ([tenantId, roles]) => changeOf(tenantId, roles) !== 'none',
  ).length;
  const changeCount = websiteChangeCount + (platformAdminChanged ? 1 : 0);
  useReportUnsavedChanges(isOpen && changeCount > 0);

  function open() {
    const current = new Map(memberships.map(({ tenantId, roles }) => [tenantId, roles]));
    setOriginal(current);
    setDraft(current);
    setRemoved(new Set());
    setPlatformAdmin(isPlatformAdmin);
    setOriginalPlatformAdmin(isPlatformAdmin);
    setErrorText(null);
    setIsOpen(true);
  }

  function close() {
    if (!saving.current) {
      setIsOpen(false);
    }
  }

  function toggleRole(tenantId: string, role: TenantRole, isChecked: boolean) {
    const current = draft.get(tenantId) ?? [];
    const next = isChecked ? unique([...current, role]) : current.filter((held) => held !== role);
    setDraft(new Map(draft).set(tenantId, next));
  }

  function togglePlatformAdmin(checked: boolean) {
    if (!canManagePlatform) {
      return;
    }
    setPlatformAdmin(checked);
  }

  function toggleRemoved(tenantId: string) {
    if (!original.has(tenantId)) {
      // A website that was only just added has nothing stored to take away: drop the row.
      const next = new Map(draft);
      next.delete(tenantId);
      setDraft(next);
      return;
    }
    const next = new Set(removed);
    if (!next.delete(tenantId)) {
      next.add(tenantId);
    }
    setRemoved(next);
  }

  function addWebsite(tenantId: string) {
    if (addable.some((website) => website.id === tenantId)) {
      setDraft(new Map(draft).set(tenantId, [STARTING_ROLE]));
    }
  }

  function applyMutationSuccess(tenantId: string, roles: readonly TenantRole[] | null) {
    // Advance the baseline after each committed mutation. Retrying a later failure
    // must not replay successful grants or removals against newly changed access.
    setOriginal((before) => {
      const next = new Map(before);
      if (roles === null) {
        next.delete(tenantId);
      } else {
        next.set(tenantId, roles);
      }
      return next;
    });
    if (roles === null) {
      setDraft((before) => {
        const next = new Map(before);
        next.delete(tenantId);
        return next;
      });
      setRemoved((before) => {
        const next = new Set(before);
        next.delete(tenantId);
        return next;
      });
    }
  }

  function reportSaveFailure(completed: number, reason: string) {
    setErrorText(
      completed === 0 ? reason : t('users.access.partialFailure', { count: completed, reason }),
    );
  }

  function save() {
    if (saving.current) {
      return;
    }
    const kept = [...draft].filter(([tenantId]) => !removed.has(tenantId));
    if (kept.some(([, roles]) => roles.length === 0)) {
      setErrorText(t('users.access.needRole'));
      return;
    }
    const changes = [
      ...kept
        .filter(([tenantId, roles]) => changeOf(tenantId, roles) !== 'none')
        .map(([tenantId, roles]) => ({ tenantId, roles })),
      ...[...removed].map((tenantId) => ({ tenantId, roles: null })),
    ];
    if (changes.length === 0 && !platformAdminChanged) {
      setIsOpen(false);
      return;
    }
    setErrorText(null);
    saving.current = true;
    startTransition(async () => {
      let completed = 0;
      try {
        if (platformAdminChanged) {
          const adminResult = await (platformAdmin
            ? grantPlatformAdminAction({ userId })
            : revokePlatformAdminAction({ userId }));
          if (!adminResult.ok) {
            const reason = t(messageKeyForCode(adminResult.error.code), MESSAGE_PARAMS);
            reportSaveFailure(completed, reason);
            return;
          }
          setOriginalPlatformAdmin(platformAdmin);
          completed += 1;
        }

        for (const { tenantId, roles } of changes) {
          const result = await (roles === null
            ? removeUserAccessAction({
                userId,
                tenantId,
                expectedRoles: original.get(tenantId) ?? [],
              })
            : setUserAccessAction({
                userId,
                tenantId,
                roles,
                expectedRoles: original.get(tenantId) ?? [],
              }));
          if (!result.ok) {
            const reason = t(messageKeyForCode(result.error.code), MESSAGE_PARAMS);
            reportSaveFailure(completed, reason);
            return;
          }
          applyMutationSuccess(tenantId, roles);
          completed += 1;
        }
        setIsOpen(false);
      } catch {
        reportSaveFailure(completed, t('errors.infrastructure'));
      } finally {
        saving.current = false;
      }
    });
  }

  return {
    isOpen,
    draft,
    addable,
    changeCount,
    errorText,
    isPending,
    platformAdmin,
    nameOf,
    changeOf,
    open,
    close,
    toggleRole,
    toggleRemoved,
    togglePlatformAdmin,
    addWebsite,
    /** Nothing changed: just close; otherwise save. */
    confirm: () => {
      if (saving.current) {
        return;
      }
      if (changeCount === 0) {
        setIsOpen(false);
        return;
      }
      save();
    },
  };
}
