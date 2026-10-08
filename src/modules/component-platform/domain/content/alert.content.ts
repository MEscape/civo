import { instant, oneOf, optional, withFallback } from '../models/field-schema';

import { defineContent } from './define-content';
import { sampleInstant } from './sample-instant';
import { optionalLinkTarget, recordId, shortText, title } from './shared-fields';

export const ALERT_SEVERITIES = ['info', 'warning', 'urgent'] as const;

const SEVERITY_ORDER: Readonly<Record<(typeof ALERT_SEVERITIES)[number], number>> = {
  urgent: 0,
  warning: 1,
  info: 2,
};

/**
 * An official notice. It is relevant while its optional time window is
 * open; most urgent first. An unknown severity spelling from a source
 * degrades to `info` instead of dropping the notice.
 */
export const alertContent = defineContent({
  shape: {
    id: recordId(),
    title: title(),
    message: shortText(),
    severity: withFallback(oneOf(ALERT_SEVERITIES), 'info'),
    href: optionalLinkTarget(),
    startsAt: optional(instant()),
    endsAt: optional(instant()),
  },
  rule: {
    isRelevant: (alert, now) =>
      (alert.startsAt === undefined || alert.startsAt <= now) &&
      (alert.endsAt === undefined || alert.endsAt >= now),
    compare: (first, second) => SEVERITY_ORDER[first.severity] - SEVERITY_ORDER[second.severity],
  },
}).withSample((now) => [
  {
    id: 'sample-alert-1',
    title: 'Straßensperrung in der Bahnhofstraße',
    message: 'Wegen Bauarbeiten ist die Straße bis Freitag gesperrt.',
    severity: 'warning',
    endsAt: sampleInstant(now, { days: 4, hour: 18 }),
  },
  {
    id: 'sample-alert-2',
    title: 'Rathaus am Montag geschlossen',
    severity: 'info',
  },
]);
