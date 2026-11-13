'use client';

import { useId } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useResourceBlock } from '../../hooks/use-resource-block';
import { DateField } from '../shared/date-field.client';

import { ResourceImpactDialog } from './resource-impact-dialog.client';

import type { ResourceDto } from '../../dto/resource-dto';

export interface ResourceBlockDialogProps {
  readonly resource: ResourceDto;
  readonly listOrigin?: string | undefined;
}

/**
 * "Sperren": closes a resource for a period, e.g. for maintenance. The bookings the block would
 * leave without the resource are shown before anything is saved; nothing is cancelled or moved.
 */
export function ResourceBlockDialog({ resource, listOrigin }: ResourceBlockDialogProps) {
  const t = useTranslations('booking');
  const id = useId();
  const block = useResourceBlock(resource, listOrigin);

  return (
    <>
      <Button type="button" variant="outline" onClick={block.open}>
        {t('resources.block.open')}
      </Button>
      <ConfirmDialog
        open={block.isOpen && block.impact === null}
        title={t('resources.block.title', { name: resource.name })}
        description={t('resources.block.description')}
        confirmLabel={block.isPending ? t('resources.block.saving') : t('resources.block.confirm')}
        cancelLabel={t('resources.block.cancel')}
        isPending={block.isPending}
        isConfirmDisabled={!block.canConfirm}
        onConfirm={block.check}
        onCancel={block.close}
      >
        <div className="flex flex-wrap gap-3">
          <DateField
            id={`${id}-from`}

            label={t('resources.block.from')}
            value={block.period.from}
            error={block.errors.from}
            onValueChange={(value) => {
              block.setDay('from', value);
            }}
          />
          <DateField
            id={`${id}-to`}

            label={t('resources.block.to')}
            value={block.period.to}
            error={block.errors.to}
            onValueChange={(value) => {
              block.setDay('to', value);
            }}
          />
        </div>
        {block.errors.form !== undefined && (
          <p role="alert" className="text-sm text-danger">
            {block.errors.form}
          </p>
        )}
      </ConfirmDialog>
      <ResourceImpactDialog
        impact={block.impact}
        confirmLabel={t('resources.block.impactConfirm')}
        isPending={block.isPending}
        onConfirm={block.confirmImpact}
        onCancel={block.dismissImpact}
      />
    </>
  );
}
