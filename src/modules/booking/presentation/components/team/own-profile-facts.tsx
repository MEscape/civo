import { DataPanel } from '@components/shared/data-panel';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { createZonedFormat } from '../../hooks/use-zoned-format';
import { DetailFact } from '../shared/detail-fact';

import type { TeamMemberDto } from '../../dto/team-dto';

export interface OwnProfileFactsProps {
  readonly locale: Locale;
  readonly member: TeamMemberDto;
}

/** Where the employee works and what they are qualified for: set by managers, shown to read only. */
export async function OwnProfileFacts({ locale, member }: OwnProfileFactsProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const zoned = createZonedFormat(locale);

  return (
    <DataPanel title={t('team.profile.factsTitle')} description={t('team.profile.factsHint')}>
      <dl className="grid gap-4 p-4 sm:grid-cols-3">
        <DetailFact label={t('team.profile.location')}>{member.location.name}</DetailFact>
        <DetailFact label={t('team.profile.qualifications')}>
          {member.qualifications.length === 0
            ? t('team.list.noQualifications')
            : member.qualifications.join(', ')}
        </DetailFact>
        <DetailFact label={t('team.profile.coverage')}>
          {member.coverage.length === 0
            ? t('team.profile.coverageNone')
            : member.coverage
                .map(({ locationName, from, to }) =>
                  t('team.profile.coverageValue', {
                    location: locationName,
                    period:
                      from === to
                        ? zoned.calendarDate(from)
                        : t('exceptions.range', {
                            from: zoned.calendarDate(from),
                            to: zoned.calendarDate(to),
                          }),
                  }),
                )
                .join('; ')}
        </DetailFact>
      </dl>
    </DataPanel>
  );
}
