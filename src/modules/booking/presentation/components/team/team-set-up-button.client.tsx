'use client';

import { useState } from 'react';

import { ConfirmDialog, DialogNotice } from '@components/shared/dialog';
import { SelectField } from '@components/shared/select-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useSetUpMember } from '../../hooks/use-team-actions';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { bookingRoutes } from '../../routes';

import type { TeamCandidateDto } from '../../dto/team-dto';

export interface TeamSetUpButtonProps {
  readonly websiteId: string;
  readonly location: { readonly id: string; readonly name: string };
  /** Members with the role `employee` who have no calendar yet. */
  readonly candidates: readonly TeamCandidateDto[];
}

/**
 * "Add employee" in the header, like "Add resource" and "Add service": a member with the role
 * "Employee" is chosen in a dialog and given their calendar at this location, which then opens to be
 * filled in. A person has one calendar, so only members without one are offered.
 */
export function TeamSetUpButton({ websiteId, location, candidates }: TeamSetUpButtonProps) {
  const t = useTranslations('booking');
  const [isOpen, setIsOpen] = useState(false);
  const { isPending, formCode, actorId, setActorId, setUp } = useSetUpMember(location.id, (id) =>
    bookingRoutes.teamMember(websiteId, location.id, id),
  );

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setIsOpen(true);
        }}
      >
        {t('team.setUp.open')}
      </Button>
      <ConfirmDialog
        open={isOpen}
        confirmVariant="default"
        title={t('team.setUp.title')}
        description={t('team.setUp.description', { location: location.name })}
        confirmLabel={isPending ? t('team.setUp.saving') : t('team.setUp.submit')}
        cancelLabel={t('team.form.cancel')}
        isConfirmDisabled={actorId === ''}
        isPending={isPending}
        onCancel={() => {
          setIsOpen(false);
        }}
        onConfirm={setUp}
      >
        <SelectField
          id="team-set-up-member"
          label={t('team.setUp.member')}
          placeholder={t('team.setUp.placeholder')}
          options={candidates.map(({ actorId: value, name }) => ({ value, label: name }))}
          value={actorId}
          onValueChange={setActorId}
          disabled={isPending}
        />
        {formCode !== null && (
          <DialogNotice tone="danger">
            {t(messageKeyForCode(formCode), MESSAGE_PARAMS)}
          </DialogNotice>
        )}
      </ConfirmDialog>
    </>
  );
}
