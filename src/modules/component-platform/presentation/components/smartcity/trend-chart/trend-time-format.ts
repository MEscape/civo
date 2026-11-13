import { MS_PER_DAY, MS_PER_MINUTE } from '@lib/utils';

const SHORT_RANGE_DAYS = 3;
const YEAR_DAYS = 365;
const SECOND_DETAIL_MINUTES = 2;
const CALENDAR_DATE_LENGTH = 10;

/** Source buckets that name a calendar month or year: the label is that bucket, never a time of day. */
const BUCKET_FORMATS: Readonly<Record<string, Intl.DateTimeFormatOptions>> = {
  P1M: { month: 'short', year: 'numeric', timeZone: 'UTC' },
  P1Y: { year: 'numeric', timeZone: 'UTC' },
};

/** Axis precision follows the visible window; tooltips and tables retain the complete instant. */
export function trendAxisFormat(
  points: ReadonlyArray<{ readonly date: string }>,
  resolution?: string,
): Intl.DateTimeFormatOptions {
  const instants = points.map((point) => Date.parse(point.date)).filter(Number.isFinite);
  const span = instants.length < 2 ? 0 : Math.max(...instants) - Math.min(...instants);
  const bucket = resolution === undefined ? undefined : BUCKET_FORMATS[resolution];
  if (bucket !== undefined) {
    return bucket;
  }
  if (resolution === 'P1D') {
    return {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
      ...(span >= YEAR_DAYS * MS_PER_DAY ? { year: 'numeric' } : {}),
    };
  }
  if (span < MS_PER_DAY) {
    return {
      hour: '2-digit',
      minute: '2-digit',
      ...(span < SECOND_DETAIL_MINUTES * MS_PER_MINUTE ? { second: '2-digit' } : {}),
    };
  }
  if (span <= SHORT_RANGE_DAYS * MS_PER_DAY) {
    return { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' };
  }
  return {
    day: '2-digit',
    month: 'short',
    ...(span >= YEAR_DAYS * MS_PER_DAY ? { year: 'numeric' } : {}),
  };
}

const TREND_INSTANT_FORMAT = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
} as const;

/** Date-only source buckets use a UTC sorting anchor, never a fabricated local measurement time. */
function trendInstantFormat(resolution?: string): Intl.DateTimeFormatOptions {
  const bucket = resolution === undefined ? undefined : BUCKET_FORMATS[resolution];
  if (bucket !== undefined) {
    return bucket;
  }
  return resolution === 'P1D'
    ? { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }
    : TREND_INSTANT_FORMAT;
}

interface TrendDateFormatters {
  date(value: string, options: Intl.DateTimeFormatOptions): string;
  calendarDate(value: string, options: Intl.DateTimeFormatOptions): string;
}

/** The source's declared resolution decides whether a date is a calendar bucket or a measured instant. */
export function formatTrendDate(
  value: string,
  fmt: TrendDateFormatters,
  options: {
    readonly resolution?: string | undefined;
    readonly format?: Intl.DateTimeFormatOptions;
  } = {},
): string {
  const format = options.format ?? trendInstantFormat(options.resolution);
  const isCalendar =
    options.resolution === 'P1D' ||
    (options.resolution !== undefined && options.resolution in BUCKET_FORMATS);
  return isCalendar
    ? fmt.calendarDate(value.slice(0, CALENDAR_DATE_LENGTH), format)
    : fmt.date(value, format);
}
