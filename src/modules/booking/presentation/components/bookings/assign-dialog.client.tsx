'use client';

import { ConfirmDialog } from '@components/shared/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';

import { useTranslations } from '@i18n/client';

import { recommendedOf } from '../../hooks/use-assign-dialog';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

import { CandidateChoice, UnavailableList } from './candidate-lists.client';

import type { useAssignDialog } from '../../hooks/use-assign-dialog';

export interface AssignDialogProps {
  readonly dialog: ReturnType<typeof useAssignDialog>;
  /** Service, time and location of the booking, in one line. */
  readonly subtitle: string;
  readonly nameOf: (resourceId: string) => string;
  readonly timeZone: string;
  /** Who is replaced, by name; absent when an open unit is filled. */
  readonly replacesName?: string | undefined;
}

/**
 * "Mitarbeiter zuweisen" (mockup 09): the recommended people (their preferences fit), everybody who
 * may serve, and who may not with the reason, each a tab. The server's ranking and reasons are shown
 * as they are; nothing is filtered here.
 */
export function AssignDialog({
  dialog,
  subtitle,
  nameOf,
  timeZone,
  replacesName,
}: AssignDialogProps) {
  const t = useTranslations('booking');
  const { candidates, chosen, command } = dialog;
  const view = candidates.kind === 'ready' ? candidates.view : null;
  const recommended = view === null ? [] : recommendedOf(view);

  return (
    <ConfirmDialog
      open={dialog.isOpen}
      size="lg"
      confirmVariant="default"
      title={t('bookings.assign.title')}
      description={subtitle}
      confirmLabel={
        chosen === null
          ? t('bookings.assign.confirmEmpty')
          : t('bookings.assign.confirm', { name: nameOf(chosen) })
      }
      cancelLabel={t('bookings.assign.cancel')}
      isConfirmDisabled={chosen === null}
      isPending={command.isPending}
      onConfirm={dialog.assign}
      onCancel={dialog.close}
    >
      {replacesName !== undefined && (
        <p className="mb-2 text-sm text-copy-muted">
          {t('bookings.assign.replacing', { name: replacesName })}
        </p>
      )}
      {candidates.kind === 'loading' && (
        <p role="status" className="text-sm text-copy-muted">
          {t('bookings.assign.loading')}
        </p>
      )}
      {candidates.kind === 'failed' && (
        <p role="alert" className="text-sm text-danger">
          {t(messageKeyForCode(candidates.code), MESSAGE_PARAMS)}
        </p>
      )}
      {view !== null && (
        <Tabs defaultValue="recommended">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="recommended">
              {t('bookings.assign.recommended', { count: recommended.length })}
            </TabsTrigger>
            <TabsTrigger value="eligible">
              {t('bookings.assign.eligible', { count: view.eligible.length })}
            </TabsTrigger>
            <TabsTrigger value="unavailable">
              {t('bookings.assign.unavailable', { count: view.unavailable.length })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="recommended">
            <CandidateChoice
              candidates={recommended}
              chosen={chosen}
              onChoose={dialog.choose}
              nameOf={nameOf}
            />
          </TabsContent>
          <TabsContent value="eligible">
            <CandidateChoice
              candidates={view.eligible}
              chosen={chosen}
              onChoose={dialog.choose}
              nameOf={nameOf}
            />
          </TabsContent>
          <TabsContent value="unavailable">
            <UnavailableList unavailable={view.unavailable} nameOf={nameOf} timeZone={timeZone} />
          </TabsContent>
        </Tabs>
      )}
      <p role="status" className="mt-2 text-sm text-copy-muted">
        {command.message}
      </p>
    </ConfirmDialog>
  );
}
