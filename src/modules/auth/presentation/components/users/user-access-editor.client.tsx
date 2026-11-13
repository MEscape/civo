'use client';

import type { ChangeEvent } from 'react';

import { ArrowRight, Pencil } from '@components/icons/icons';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';
import { ConfirmDialog } from '@components/shared/dialog';
import { CheckboxField, FieldMessage } from '@components/shared/field';
import { SelectField } from '@components/shared/select-field';
import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useUserAccessEditor } from '../../hooks/use-user-access-editor';

import { WebsiteAccessCard } from './website-access-card';

import type { TenantRole } from '../../../application/contracts/auth-constraints';

export interface AccessWebsite {
  readonly id: string;
  readonly name: string;
}

export interface UserAccessEditorProps {
  readonly userId: string;
  readonly userName: string;
  readonly userEmail: string;
  /** A platform administrator works in every website already; the dialog says so. */
  readonly isPlatformAdmin: boolean;
  readonly canManagePlatform?: boolean;
  /** Where the person works now, with their roles. */
  readonly memberships: ReadonlyArray<{
    readonly tenantId: string;
    readonly roles: readonly TenantRole[];
  }>;
  /** Every website a person can be given access to. */
  readonly websites: readonly AccessWebsite[];
  /** Where one website's people are managed, by website; absent inside a website. */
  readonly websiteHrefs?: Readonly<Record<string, string>> | undefined;
  /**
   * Inside one website: the cross-website user page, where access to other websites is managed.
   * Its presence limits the dialog to this website. Absent across websites.
   */
  readonly globalUsersHref?: string | undefined;
}

/** Below the website cards: adding another website across websites, or where that is done from inside one. */
function AddWebsite({
  userId,
  addable,
  globalUsersHref,
  onAdd,
}: {
  readonly userId: string;
  readonly addable: readonly AccessWebsite[];
  readonly globalUsersHref: string | undefined;
  readonly onAdd: (tenantId: string) => void;
}) {
  const t = useTranslations('auth');
  if (globalUsersHref !== undefined) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-token border border-dashed border-border bg-canvas p-3">
        <p className="text-sm text-copy-muted">{t('users.access.otherWebsites')}</p>
        <Link href={globalUsersHref} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          {t('users.access.otherWebsitesLink')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-token border border-dashed border-border bg-canvas p-3">
      {addable.length === 0 ? (
        <p className="text-sm text-copy-muted">{t('users.access.nothingToAdd')}</p>
      ) : (
        <SelectField
          id={`${userId}-add`}
          label={t('users.access.addTitle')}
          placeholder={t('users.access.addWebsite')}
          options={addable.map((website) => ({ value: website.id, label: website.name }))}
          value=""
          onValueChange={onAdd}
        />
      )}
    </div>
  );
}

/**
 * "Manage access" of one person: a dialog that lists the websites they work
 * in with their roles (each saying what it allows), lets an authorized
 * manager change the roles, take a website away or add one, and saves
 * only what changed, counting it as it goes. Every change is checked again by
 * the server, which also keeps each website's last administrator.
 */
function AccessEditor({
  userId,
  userName,
  userEmail,
  isPlatformAdmin,
  canManagePlatform = false,
  memberships,
  websites,
  websiteHrefs,
  globalUsersHref,
}: UserAccessEditorProps) {
  const t = useTranslations('auth');
  const editor = useUserAccessEditor({
    userId,
    memberships,
    websites,
    isPlatformAdmin,
    canManagePlatform,
  });
  const { draft, addable, changeCount } = editor;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={editor.open}
        disabled={editor.isPending}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        {t('users.table.manage')}
        <span className="sr-only"> {userName}</span>
      </Button>
      <ConfirmDialog
        open={editor.isOpen}
        size="lg"
        title={t('users.access.title', { name: userName })}
        description={userEmail}
        confirmLabel={
          changeCount === 0
            ? t('users.access.save')
            : t('users.access.saveCount', { count: changeCount })
        }
        confirmVariant="default"
        cancelLabel={t('users.access.cancel')}
        isPending={editor.isPending}
        isConfirmDisabled={changeCount === 0}
        onConfirm={editor.confirm}
        onCancel={editor.close}
      >
        <div className="space-y-4">
          <p className="text-sm text-copy-muted">
            {t(
              globalUsersHref === undefined
                ? 'users.access.description'
                : 'users.access.websiteDescription',
            )}
          </p>
          {canManagePlatform && (
            <div className="rounded-token border border-border bg-canvas p-3">
              <CheckboxField
                id={`${userId}-platform-admin`}
                label={t('users.access.platformAdminLabel')}
                hint={t('users.access.platformAdminHint')}
                checked={editor.platformAdmin}
                disabled={editor.isPending}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  editor.togglePlatformAdmin(event.target.checked);
                }}
              />
            </div>
          )}
          {draft.size === 0 && (
            <p className="rounded-token border border-dashed border-border px-4 py-6 text-center text-sm text-copy-muted">
              {t('users.access.empty')}
            </p>
          )}
          <fieldset disabled={editor.isPending} aria-busy={editor.isPending} className="space-y-4">
            <legend className="sr-only">{t('users.table.access')}</legend>
            <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {[...draft].map(([tenantId, roles]) => (
                <li key={tenantId} className="space-y-1">
                  <WebsiteAccessCard
                    idPrefix={`${userId}-${tenantId}`}
                    websiteName={editor.nameOf(tenantId)}
                    roles={roles}
                    change={editor.changeOf(tenantId, roles)}
                    manageHref={websiteHrefs?.[tenantId]}
                    onToggleRole={(role, isChecked) => {
                      editor.toggleRole(tenantId, role, isChecked);
                    }}
                    onToggleRemoved={() => {
                      editor.toggleRemoved(tenantId);
                    }}
                  />
                </li>
              ))}
            </ul>

            <AddWebsite
              userId={userId}
              addable={addable}
              globalUsersHref={globalUsersHref}
              onAdd={editor.addWebsite}
            />
          </fieldset>
          <FieldMessage
            id={`${userId}-access-error`}
            message={editor.errorText}
            className="text-sm"
          />
        </div>
      </ConfirmDialog>
    </>
  );
}

/** The shared navigation guard also covers website links inside the access dialog. */
export function UserAccessEditor(props: UserAccessEditorProps) {
  const t = useTranslations('auth');
  return (
    <UnsavedChangesProvider
      title={t('users.access.unsavedTitle')}
      description={t('users.access.unsavedDescription')}
      confirmLabel={t('users.access.discard')}
      cancelLabel={t('users.access.keepEditing')}
    >
      <AccessEditor {...props} />
    </UnsavedChangesProvider>
  );
}
