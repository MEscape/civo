'use client';

import { useTranslations } from '@i18n/client';

import { previewOccupancy } from '../../application/contracts/occupancy-preview-model';
import { speakLength } from '../forms/service-length-options';

import type { ResourceOptionDto } from '../dto/service-dto';
import type { ServicePartKey } from '../forms/service-steps';
import type { ServiceFormValues } from '../schemas/service-schema';

interface Held {
  readonly fromMinute: number;
  readonly toMinute: number;
}
const heldFor = (span: Held) => span.toMinute - span.fromMinute;

/**
 * What is set in each part of a service, in one line each, worked out from the values and the
 * resources (never typed by hand). The overview and the review step both draw these, so the words
 * never differ between them. The occupancy is the domain's own answer (`previewOccupancy`).
 */
export function useServiceSummaries(
  values: ServiceFormValues,
  resources: readonly ResourceOptionDto[],
): Record<ServicePartKey, string> {
  const t = useTranslations('booking');
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const lengthText = (minutes: number) => {
    const spoken = speakLength(minutes);
    return t(`services.units.short.${spoken.unit}`, { count: spoken.count });
  };
  const preview = previewOccupancy({
    durationMinutes: values.durationMinutes,
    preparationMinutes: values.preparationMinutes,
    cleanupMinutes: values.cleanupMinutes,
    needsEmployee: values.employee !== 'none',
    resources: values.resources.flatMap((link) => {
      const resource = byId.get(link.resourceId);
      return resource === undefined || !link.isRequired
        ? []
        : [
            {
              id: resource.id,
              name: resource.name,
              setupMinutes: resource.setupMinutes,
              teardownMinutes: resource.teardownMinutes,
            },
          ];
    }),
  });
  const resourceNames = values.resources.map((link) =>
    t(link.isRequired ? 'services.summary.resourceRequired' : 'services.summary.resourceOptional', {
      name: byId.get(link.resourceId)?.name ?? link.resourceId,
    }),
  );
  const qualification =
    values.employee === 'qualified'
      ? t('services.summary.qualification', { name: values.qualification })
      : t(
          values.employee === 'any'
            ? 'services.summary.anyEmployee'
            : 'services.summary.noEmployee',
        );

  return {
    general: [
      values.name,
      values.category === '' ? t('services.summary.noCategory') : values.category,
      values.isOnlineBookable ? t('services.summary.online') : t('services.summary.notOnline'),
      ...(values.documents.length === 0
        ? []
        : [t('services.summary.documents', { list: values.documents.join(', ') })]),
    ].join(' · '),
    timing:
      preview === null
        ? t('services.timing.previewInvalid')
        : [
            t('services.summary.appointment', { length: lengthText(heldFor(preview.citizen)) }),
            ...(preview.employee === null
              ? []
              : [t('services.summary.staff', { length: lengthText(heldFor(preview.employee)) })]),
            ...preview.resources.map((resource) =>
              t('services.summary.held', {
                name: resource.name,
                length: lengthText(heldFor(resource.span)),
              }),
            ),
          ].join(' · '),
    resources:
      resourceNames.length === 0 ? t('services.summary.noResources') : resourceNames.join(' · '),
    rules: [
      t('services.summary.booking', {
        notice: lengthText(values.noticeMinutes),
        horizon: t('services.units.short.days', { count: values.horizonDays }),
      }),
      t('services.summary.cancelUntil', { length: lengthText(values.cancelUntilMinutes) }),
      qualification,
    ].join(' · '),
  };
}
