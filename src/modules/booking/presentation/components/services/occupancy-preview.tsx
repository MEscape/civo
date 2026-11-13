import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { EXAMPLE_START_MINUTE, clockText } from '../../forms/clock-text';

import type {
  OccupancyPreview as Preview,
  PreviewSpan,
} from '../../../application/contracts/occupancy-preview-model';

export interface OccupancyPreviewProps {
  /** From `previewOccupancy`, which asks the domain's occupancy function; `null` while the numbers are not valid. */
  readonly preview: Preview | null;
}

const PERCENT = 100;

const spanText = (span: PreviewSpan) =>
  `${clockText(EXAMPLE_START_MINUTE + span.fromMinute)}–${clockText(EXAMPLE_START_MINUTE + span.toMinute)}`;

/** One party's bar on the shared time axis, as a share of the whole. */
function Bar({
  span,
  axis,
  tone,
  children,
}: {
  readonly span: PreviewSpan;
  readonly axis: { readonly from: number; readonly to: number };
  readonly tone: 'citizen' | 'staff' | 'resource';
  readonly children: string;
}) {
  const total = axis.to - axis.from;
  const left = ((span.fromMinute - axis.from) / total) * PERCENT;
  const width = ((span.toMinute - span.fromMinute) / total) * PERCENT;
  return (
    <div className="relative h-8 rounded-token bg-canvas">
      <div
        className={cn(
          'absolute inset-y-0 flex items-center justify-center overflow-hidden rounded-token px-1 text-xs font-medium whitespace-nowrap',
          tone === 'citizen' && 'bg-primary text-primary-foreground',
          tone === 'staff' && 'border border-dashed border-warning bg-warning-surface text-copy',
          tone === 'resource' && 'bg-accent-surface text-copy',
        )}
        style={{ left: `${left}%`, width: `${width}%` }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * How a time is occupied, for an example appointment: what the citizen sees, how long an employee
 * is held (preparation, appointment, clean-up), and how long each required resource is held (the
 * appointment and its own setup and teardown). It draws the answer of the domain's occupancy
 * function, so it shows what the engine will do. The same facts follow in words below, so nothing is
 * only in the picture.
 */
export function OccupancyPreview({ preview }: OccupancyPreviewProps) {
  const t = useTranslations('booking');
  if (preview === null) {
    return <p className="text-sm text-copy-muted">{t('services.timing.previewInvalid')}</p>;
  }
  const spans = [
    preview.citizen,
    ...(preview.employee === null ? [] : [preview.employee]),
    ...preview.resources.map((resource) => resource.span),
  ];
  const axis = {
    from: Math.min(...spans.map((span) => span.fromMinute)),
    to: Math.max(...spans.map((span) => span.toMinute)),
  };
  const minutes = (span: PreviewSpan) => span.toMinute - span.fromMinute;

  return (
    <div className="space-y-4">
      <p className="text-xs text-copy-muted">
        {t('services.timing.previewExample', { time: clockText(EXAMPLE_START_MINUTE) })}
      </p>
      <div
        className="grid grid-cols-[minmax(7rem,auto)_1fr] items-center gap-x-3 gap-y-2"
        aria-hidden="true"
      >
        <span className="text-sm font-medium text-copy">{t('services.timing.citizen')}</span>
        <Bar span={preview.citizen} axis={axis} tone="citizen">
          {spanText(preview.citizen)}
        </Bar>
        {preview.employee !== null && (
          <>
            <span className="text-sm font-medium text-copy">{t('services.timing.employee')}</span>
            <Bar span={preview.employee} axis={axis} tone="staff">
              {`${spanText(preview.employee)} · ${t('services.duration', { minutes: minutes(preview.employee) })}`}
            </Bar>
          </>
        )}
        {preview.resources.map((resource) => (
          <div key={resource.id} className="contents">
            <span className="text-sm font-medium text-copy">
              {t('services.timing.resource', { name: resource.name })}
            </span>
            <Bar span={resource.span} axis={axis} tone="resource">
              {spanText(resource.span)}
            </Bar>
          </div>
        ))}
      </div>
      <ul className="list-disc space-y-1 ps-5 text-sm text-copy">
        <li>
          {t('services.timing.textCitizen', {
            span: spanText(preview.citizen),
            minutes: minutes(preview.citizen),
          })}
        </li>
        {preview.employee === null ? (
          <li>{t('services.timing.textNoEmployee')}</li>
        ) : (
          <li>
            {t('services.timing.textEmployee', {
              span: spanText(preview.employee),
              minutes: minutes(preview.employee),
            })}
          </li>
        )}
        {preview.resources.map((resource) => (
          <li key={resource.id}>
            {t('services.timing.textResource', {
              name: resource.name,
              span: spanText(resource.span),
              minutes: minutes(resource.span),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
