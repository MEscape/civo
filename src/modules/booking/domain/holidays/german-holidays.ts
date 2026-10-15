/**
 * Public holidays of Germany and its states, computed from the rules that
 * define them (fixed dates, and days counted from Easter), so no external
 * service, licence, rate limit or privacy question is involved, and the
 * answer is the same offline and for every year.
 *
 * What this is not: an address does not name a holiday region (a border
 * town, a church holiday that only some municipalities keep), so the person
 * chooses the region; and a holiday here is only a fact about the calendar.
 * Closing a location on it is a separate, reviewed step.
 *
 * Not covered, on purpose: Bavaria's Assumption Day and Augsburg's peace
 * festival (kept only by some municipalities), and holidays of other
 * countries. Both are added by their own rule when a place needs them.
 */

export const GERMAN_REGIONS = [
  'DE',
  'BW',
  'BY',
  'BE',
  'BB',
  'HB',
  'HH',
  'HE',
  'MV',
  'NI',
  'NW',
  'RP',
  'SL',
  'SN',
  'ST',
  'SH',
  'TH',
] as const;

/** `DE` is the nationwide set; the others add what their state keeps on top. */
export type GermanRegion = (typeof GERMAN_REGIONS)[number];

/** Every holiday this module knows, so a stored or submitted key can be checked at runtime. */
export const HOLIDAY_KEYS = [
  'newYear',
  'epiphany',
  'womensDay',
  'goodFriday',
  'easterSunday',
  'easterMonday',
  'labourDay',
  'ascension',
  'whitSunday',
  'whitMonday',
  'corpusChristi',
  'assumption',
  'germanUnity',
  'childrensDay',
  'reformationDay',
  'allSaints',
  'repentanceDay',
  'christmasDay',
  'boxingDay',
] as const;

export type HolidayKey = (typeof HOLIDAY_KEYS)[number];

export interface PublicHoliday {
  readonly key: HolidayKey;
  /** `YYYY-MM-DD`. */
  readonly date: string;
}

type Rule =
  | { readonly kind: 'fixed'; readonly month: number; readonly day: number }
  | { readonly kind: 'easter'; readonly offsetDays: number }
  | { readonly kind: 'repentance' };

interface Definition {
  readonly key: HolidayKey;
  readonly rule: Rule;
  /** The states that keep it; `all` for the whole country. */
  readonly regions: 'all' | readonly GermanRegion[];
}

const EASTER_ASCENSION = 39;
const EASTER_WHIT_SUNDAY = 49;
const EASTER_WHIT_MONDAY = 50;
const EASTER_CORPUS_CHRISTI = 60;

const DEFINITIONS: readonly Definition[] = [
  { key: 'newYear', rule: { kind: 'fixed', month: 1, day: 1 }, regions: 'all' },
  { key: 'epiphany', rule: { kind: 'fixed', month: 1, day: 6 }, regions: ['BW', 'BY', 'ST'] },
  { key: 'womensDay', rule: { kind: 'fixed', month: 3, day: 8 }, regions: ['BE', 'MV'] },
  { key: 'goodFriday', rule: { kind: 'easter', offsetDays: -2 }, regions: 'all' },
  { key: 'easterSunday', rule: { kind: 'easter', offsetDays: 0 }, regions: ['BB'] },
  { key: 'easterMonday', rule: { kind: 'easter', offsetDays: 1 }, regions: 'all' },
  { key: 'labourDay', rule: { kind: 'fixed', month: 5, day: 1 }, regions: 'all' },
  { key: 'ascension', rule: { kind: 'easter', offsetDays: EASTER_ASCENSION }, regions: 'all' },
  { key: 'whitSunday', rule: { kind: 'easter', offsetDays: EASTER_WHIT_SUNDAY }, regions: ['BB'] },
  { key: 'whitMonday', rule: { kind: 'easter', offsetDays: EASTER_WHIT_MONDAY }, regions: 'all' },
  {
    key: 'corpusChristi',
    rule: { kind: 'easter', offsetDays: EASTER_CORPUS_CHRISTI },
    regions: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL'],
  },
  { key: 'assumption', rule: { kind: 'fixed', month: 8, day: 15 }, regions: ['SL'] },
  { key: 'germanUnity', rule: { kind: 'fixed', month: 10, day: 3 }, regions: 'all' },
  { key: 'childrensDay', rule: { kind: 'fixed', month: 9, day: 20 }, regions: ['TH'] },
  {
    key: 'reformationDay',
    rule: { kind: 'fixed', month: 10, day: 31 },
    regions: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH'],
  },
  {
    key: 'allSaints',
    rule: { kind: 'fixed', month: 11, day: 1 },
    regions: ['BW', 'BY', 'NW', 'RP', 'SL'],
  },
  { key: 'repentanceDay', rule: { kind: 'repentance' }, regions: ['SN'] },
  { key: 'christmasDay', rule: { kind: 'fixed', month: 12, day: 25 }, regions: 'all' },
  { key: 'boxingDay', rule: { kind: 'fixed', month: 12, day: 26 }, regions: 'all' },
];

const MS_PER_DAY = 86_400_000;
const REPENTANCE_ANCHOR_MONTH = 11;
const REPENTANCE_ANCHOR_DAY = 23;
const WEDNESDAY = 3;
const DAYS_PER_WEEK = 7;

function utc(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

function toIso(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 'YYYY-MM-DD'.length);
}

/** Easter Sunday of a year by the Gauss/Anonymous Gregorian algorithm (valid for the Gregorian calendar). */
export function easterSunday(year: number): string {
  /* eslint-disable no-magic-numbers -- the constants of the published algorithm */
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  /* eslint-enable no-magic-numbers -- end of the published algorithm */
  return toIso(utc(year, month, day));
}

/** The Wednesday before 23 November. */
function repentanceDay(year: number): number {
  const anchor = utc(year, REPENTANCE_ANCHOR_MONTH, REPENTANCE_ANCHOR_DAY);
  const weekday = new Date(anchor).getUTCDay();
  const back = (weekday - WEDNESDAY + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return anchor - back * MS_PER_DAY;
}

function dateOf(rule: Rule, year: number): string {
  switch (rule.kind) {
    case 'fixed':
      return toIso(utc(year, rule.month, rule.day));
    case 'easter':
      return toIso(Date.parse(`${easterSunday(year)}T00:00:00Z`) + rule.offsetDays * MS_PER_DAY);
    case 'repentance':
      return toIso(repentanceDay(year));
  }
}

function isKept(definition: Definition, region: GermanRegion): boolean {
  return definition.regions === 'all' || (region !== 'DE' && definition.regions.includes(region));
}

/**
 * The public holidays of a year in a region, earliest first. `DE` is only the
 * nationwide ones; a state adds its own.
 */
export function publicHolidaysOf(region: GermanRegion, year: number): readonly PublicHoliday[] {
  return DEFINITIONS.filter((definition) => isKept(definition, region))
    .map((definition) => ({ key: definition.key, date: dateOf(definition.rule, year) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
