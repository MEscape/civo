import type { ReactNode } from 'react';

import { Badge } from '@components/ui/badge';
import { Icons } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { shortfallReasonOf } from '../../feasibility/feasibility-reasons';
import { RESOURCE_TYPE_MESSAGE_KEYS } from '../../messages/message-keys';

import type { ResourceKind } from '../../../application/contracts/booking-constraints';
import type {
  LocationFeasibilityView,
  RequirementCoverageView,
} from '../../../application/contracts/setup-views';
import type { ShortfallReason } from '../../feasibility/feasibility-reasons';
import type { FeasibilityState } from '../../hooks/use-service-feasibility';

export interface ServiceFeasibilityPanelProps {
  readonly state: FeasibilityState;
  /** The largest group one booking may bring, as configured. */
  readonly participantsPerBooking: number | null;
}

function isResourceKind(type: string): type is ResourceKind {
  return Object.hasOwn(RESOURCE_TYPE_MESSAGE_KEYS, type);
}

const READINESS_BADGE = {
  ready: 'success',
  'awaiting-employees': 'warning',
  blocked: 'danger',
} as const;

const READINESS_KEY = {
  ready: 'services.feasibility.ready',
  'awaiting-employees': 'services.feasibility.awaiting',
  blocked: 'services.feasibility.blocked',
} as const;

/** One requirement of the service and what covers it, marked so a gap stands out from what is fine. */
const SHORTFALL_KEY = {
  'no-type': 'services.feasibility.noType',
  'no-skills': 'services.feasibility.noSkills',
  'no-location': 'services.feasibility.noLocation',
  'no-pool': 'services.feasibility.noPool',
  'too-few': 'services.feasibility.tooFew',
} as const satisfies Record<ShortfallReason, string>;

function shortfallValues(coverage: RequirementCoverageView, type: string) {
  return { type, needed: coverage.needed, available: coverage.funnel.inPool };
}

const LINE_MARKER = {
  ok: { Icon: Icons.check, className: 'text-success' },
  waiting: { Icon: Icons.alertTriangle, className: 'text-warning' },
  missing: { Icon: Icons.alertTriangle, className: 'text-danger' },
} as const;

function Line({
  tone,
  children,
}: {
  readonly tone: keyof typeof LINE_MARKER;
  readonly children: ReactNode;
}) {
  const { Icon, className } = LINE_MARKER[tone];

  return (
    <li className="flex items-start gap-2">
      <Icon className={`mt-0.5 size-3.5 shrink-0 ${className}`} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function RequirementLine({ coverage }: { readonly coverage: RequirementCoverageView }) {
  const t = useTranslations('booking');
  const type = isResourceKind(coverage.resourceType)
    ? t(RESOURCE_TYPE_MESSAGE_KEYS[coverage.resourceType])
    : coverage.resourceType;
  const reason = shortfallReasonOf(coverage);

  if (reason === null) {
    return (
      <Line tone="ok">
        {t('services.feasibility.fits', {
          type,
          needed: coverage.needed,
          names: coverage.eligible.map((resource) => resource.name).join(', '),
        })}
      </Line>
    );
  }
  if (coverage.awaitingEmployees > 0) {
    return <Line tone="waiting">{t('services.feasibility.employees')}</Line>;
  }
  return <Line tone="missing">{t(SHORTFALL_KEY[reason], shortfallValues(coverage, type))}</Line>;
}

function LocationResult({
  entry,
  participantsPerBooking,
}: {
  readonly entry: LocationFeasibilityView;
  readonly participantsPerBooking: number | null;
}) {
  const t = useTranslations('booking');
  const isGroupLimited =
    participantsPerBooking !== null && entry.largestGroup < participantsPerBooking;

  return (
    <li className="space-y-1 rounded-token border border-border bg-surface p-3">
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-copy">
        {entry.locationName}
        <Badge variant={READINESS_BADGE[entry.readiness]}>
          {t(READINESS_KEY[entry.readiness])}
        </Badge>
      </p>
      <ul className="space-y-1 text-xs text-copy-muted">
        {entry.coverage.map((coverage) => (
          <RequirementLine key={coverage.requirementIndex} coverage={coverage} />
        ))}
        {entry.block === 'shared-resources' && (
          <Line tone="missing">{t('services.feasibility.shared')}</Line>
        )}
      </ul>
      {entry.readiness === 'ready' && (
        <p className="text-xs text-copy-muted">
          {isGroupLimited
            ? t('services.feasibility.groupTooSmall', {
                count: entry.largestGroup,
                max: participantsPerBooking,
              })
            : t('services.feasibility.group', { count: entry.largestGroup })}
        </p>
      )}
    </li>
  );
}

/**
 * Says whether the resources that exist can serve the service being edited, per
 * location, and why not when they cannot. The answer comes from the server's
 * rules (see `useServiceFeasibility`); this only shows it. It is announced
 * politely so a screen-reader user hears the result without losing their place.
 */
export function ServiceFeasibilityPanel({
  state,
  participantsPerBooking,
}: ServiceFeasibilityPanelProps) {
  const t = useTranslations('booking');

  return (
    <section
      aria-labelledby="service-feasibility-title"
      className="space-y-3 rounded-token border border-border bg-canvas p-4"
    >
      <h4 id="service-feasibility-title" className="text-sm font-medium text-copy">
        {t('services.feasibility.title')}
      </h4>
      <p className="text-xs text-copy-muted">{t('services.feasibility.hint')}</p>
      <div aria-live="polite" aria-busy={state.status === 'checking'} className="space-y-3">
        {state.status === 'incomplete' && (
          <p className="text-sm text-copy-muted">{t('services.feasibility.incomplete')}</p>
        )}
        {state.status === 'checking' && (
          <p className="text-sm text-copy-muted">{t('services.feasibility.checking')}</p>
        )}
        {state.status === 'unavailable' && (
          <p className="text-sm text-warning">{t('services.feasibility.unavailable')}</p>
        )}
        {state.status === 'ready' && (
          <>
            <ul className="space-y-2">
              {state.feasibility.locations.map((entry) => (
                <LocationResult
                  key={entry.locationId}
                  entry={entry}
                  participantsPerBooking={participantsPerBooking}
                />
              ))}
            </ul>
            {!state.feasibility.canBePublished && (
              <p className="text-sm text-danger">{t('services.feasibility.draftHint')}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
