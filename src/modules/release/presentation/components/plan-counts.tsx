'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import type { MigrationPlanDto } from '../dto/migration-plan-dto';

export interface PlanCountsProps {
  readonly counts: MigrationPlanDto['counts'];
}

/** The plan at a glance. Each count is text, so colour is never the only signal. */
export function PlanCounts({ counts }: PlanCountsProps) {
  const t = useTranslations('release.migration.panel');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success">{t('upgradable', { count: counts.upgradable })}</Badge>
      <Badge variant="warning">{t('needsReview', { count: counts.needs_review })}</Badge>
      <Badge variant="danger">{t('unresolvable', { count: counts.unresolvable })}</Badge>
    </div>
  );
}
