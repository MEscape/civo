import { weekLines } from './team-week';

import type { TeamMemberSummaryDto } from '../../dto/team-dto';
import type { ZonedFormat } from '../../hooks/use-zoned-format';
import type { BookingTranslator } from '../../translation/translator';

export interface TeamRowDetailsProps {
  readonly t: BookingTranslator;
  readonly zoned: ZonedFormat;
  readonly member: TeamMemberSummaryDto;
}

/** What a row of the team opens to: the whole week of the person, and the days they are away. */
export function TeamRowDetails({ t, zoned, member }: TeamRowDetailsProps) {
  return (
    <div
      className={`grid gap-6 border-t border-border bg-canvas p-4 ${member.coverage.length > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
    >
      <section className="space-y-1 text-sm">
        <h3 className="font-semibold text-copy">{t('team.list.details.week')}</h3>
        <ul className="space-y-0.5 text-copy">
          {weekLines(t, member.weekly).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
      <section className="space-y-1 text-sm">
        <h3 className="font-semibold text-copy">{t('team.list.details.absences')}</h3>
        {member.absences.length === 0 ? (
          <p className="text-copy-muted">{t('team.list.details.noAbsences')}</p>
        ) : (
          <ul className="space-y-0.5 text-copy">
            {member.absences.map(({ from, to }) => (
              <li key={`${from}-${to}`}>
                {from === to
                  ? zoned.calendarDate(from)
                  : t('exceptions.range', {
                      from: zoned.calendarDate(from),
                      to: zoned.calendarDate(to),
                    })}
              </li>
            ))}
          </ul>
        )}
      </section>
      {member.coverage.length > 0 && (
        <section className="space-y-1 text-sm">
          <h3 className="font-semibold text-copy">{t('team.list.details.coverage')}</h3>
          <ul className="space-y-0.5 text-copy">
            {member.coverage.map(({ locationName, from, to }) => (
              <li key={`${locationName}-${from}-${to}`}>
                {t('team.coverage.row', {
                  location: locationName,
                  period:
                    from === to
                      ? zoned.calendarDate(from)
                      : t('exceptions.range', {
                          from: zoned.calendarDate(from),
                          to: zoned.calendarDate(to),
                        }),
                })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
