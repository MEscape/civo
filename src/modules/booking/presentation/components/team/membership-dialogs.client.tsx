'use client';

import { ConfirmDialog, DialogNotice } from '@components/shared/dialog';
import { SelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { ResourceImpactDialog } from '../resources/resource-impact-dialog.client';

import type { LocationNameDto } from '../../dto/service-dto';
import type { MembershipSubject, useTeamMembership } from '../../hooks/use-team-membership';

export interface MembershipDialogsProps {
  readonly subject: MembershipSubject;
  /** The locations the person can be moved to. */
  readonly choices: readonly LocationNameDto[];
  readonly membership: ReturnType<typeof useTeamMembership>;
}

/**
 * The questions of taking a member out of their team or moving them to another: first the question (and
 * where to, for a move), then, when bookings that have not begun would be open again, the review of them.
 * Whatever is refused shows in the question, the same way as in every dialog.
 */
export function MembershipDialogs({ subject, choices, membership }: MembershipDialogsProps) {
  const t = useTranslations('booking');
  const { action, impact } = membership;
  const confirmLabel = action === 'move' ? t('team.membership.move') : t('team.membership.remove');

  return (
    <>
      <ConfirmDialog
        open={action !== null && impact === null}
        title={t(action === 'move' ? 'team.membership.moveTitle' : 'team.membership.removeTitle', {
          name: subject.name,
        })}
        description={t(
          action === 'move' ? 'team.membership.moveBody' : 'team.membership.removeBody',
        )}
        confirmLabel={confirmLabel}
        confirmVariant={action === 'move' ? 'default' : 'destructive'}
        cancelLabel={t('team.membership.cancel')}
        isPending={membership.isPending}
        isConfirmDisabled={membership.isConfirmDisabled}
        onConfirm={membership.confirm}
        onCancel={membership.close}
      >
        <div className="space-y-4">
          {action === 'move' && (
            <SelectField
              id={`membership-location-${subject.id}`}
              label={t('team.membership.location')}
              placeholder={t('team.membership.locationPlaceholder')}
              value={membership.locationId}
              options={choices.map(({ id, name }) => ({ value: id, label: name }))}
              onValueChange={membership.chooseLocation}
            />
          )}
          {membership.failure !== null && (
            <DialogNotice tone="danger">
              {t(messageKeyForCode(membership.failure.code), MESSAGE_PARAMS)}
            </DialogNotice>
          )}
        </div>
      </ConfirmDialog>
      <ResourceImpactDialog
        words="team.leave"
        impact={impact}
        confirmLabel={confirmLabel}
        isPending={membership.isPending}
        onConfirm={membership.confirmImpact}
        onCancel={membership.dismissImpact}
      />
    </>
  );
}
