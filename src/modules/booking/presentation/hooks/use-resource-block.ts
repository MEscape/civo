'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import type { SerializedActionError } from '@lib/result';

import { previewResourceChangeAction } from '../actions/preview-resource-change-action';
import { updateBookableResourceAction } from '../actions/update-bookable-resource-action';
import { toResourceFormValues, toResourceInput } from '../forms/resource-form-values';
import { resourceListNavigation } from '../forms/resource-list-navigation';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { bookingRoutes } from '../routes';

import type { ResourceDto, ResourceImpactDto } from '../dto/resource-dto';

/** What a refused block says, by where it is shown. */
interface BlockErrors {
  readonly from?: string;
  readonly to?: string;
  readonly form?: string;
}

/**
 * Closing a resource for a period: the period becomes one more of its blocks and is saved like any
 * other change of it. The server first says which bookings would be left without the resource; with
 * any, they are shown and the block is saved only once the manager goes ahead. A refusal of a day
 * is shown at its field, anything else (somebody else saved first) under the fields.
 */
export function useResourceBlock(resource: ResourceDto, listOrigin?: string) {
  const t = useTranslations('booking');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState({ from: '', to: '' });
  const [errors, setErrors] = useState<BlockErrors>({});
  const [impact, setImpact] = useState<ResourceImpactDto | null>(null);

  const values = toResourceFormValues(resource);
  const index = values.openingHours.exceptions.length;
  const next = toResourceInput({
    ...values,
    openingHours: {
      ...values.openingHours,
      exceptions: [...values.openingHours.exceptions, { kind: 'closed', ...period }],
    },
  });
  const textOf = (code: string) => t(messageKeyForCode(code), MESSAGE_PARAMS);

  function close() {
    setIsOpen(false);
    setImpact(null);
    setErrors({});
  }

  function failedWith(error: SerializedActionError) {
    const at = (part: 'from' | 'to') =>
      error.fieldErrors?.[`openingHours.exceptions.${index}.${part}`]?.[0];
    const from = at('from');
    const to = at('to');
    setErrors({
      ...(from === undefined ? {} : { from: textOf(from) }),
      ...(to === undefined ? {} : { to: textOf(to) }),
      ...(from === undefined && to === undefined ? { form: textOf(error.code) } : {}),
    });
    setImpact(null);
  }

  function save(acknowledgeImpact: boolean) {
    startTransition(async () => {
      const result = await updateBookableResourceAction({
        websiteId: resource.websiteId,
        ...next,
        resourceId: resource.id,
        expectedVersion: resource.version,
        acknowledgeImpact,
      });
      if (result.ok) {
        close();
        router.push(
          resourceListNavigation.withOrigin(
            `${bookingRoutes.resource(resource.websiteId, resource.location.id, resource.id)}?saved=1`,
            listOrigin,
          ),
        );
        return;
      }
      failedWith(result.error);
    });
  }

  return {
    isPending,
    isOpen,
    period,
    errors,
    /** The bookings the block would reach, while the manager looks at them. */
    impact: isOpen ? impact : null,
    canConfirm: period.from !== '' && period.to !== '',
    open: () => {
      setPeriod({ from: '', to: '' });
      setIsOpen(true);
    },
    close,
    setDay: (part: 'from' | 'to', day: string) => {
      setPeriod({ ...period, [part]: day });
    },
    check: () => {
      setErrors({});
      startTransition(async () => {
        const preview = await previewResourceChangeAction({
          websiteId: resource.websiteId,
          resourceId: resource.id,
          resource: next,
        });
        if (!preview.ok) {
          failedWith(preview.error);
          return;
        }
        if (preview.data.affected.length > 0 || preview.data.isTruncated) {
          setImpact(preview.data);
          return;
        }
        save(false);
      });
    },
    confirmImpact: () => {
      save(true);
    },
    dismissImpact: () => {
      setImpact(null);
    },
  };
}
