import { dayAfter } from './month-calendar';

import type { CoverageDto } from '../dto/team-dto';

/** The spells that are on today or start within `daysAhead` days, soonest first (days are `YYYY-MM-DD`, so they sort as text). */
export function comingSpells(
  coverage: readonly CoverageDto[],
  today: string,
  daysAhead: number,
): CoverageDto[] {
  const until = dayAfter(today, daysAhead);
  return coverage
    .filter((spell) => spell.to >= today && spell.from <= until)
    .sort((a, b) => a.from.localeCompare(b.from));
}
