'use client';

import { EmptyState } from '@components/layout/layout-primitives';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { Alert } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { MappingPreview } from './mapping-progress';

import type { useMappingWizard } from '../../hooks/use-mapping-wizard';

interface MappingReviewStepProps {
  readonly screen: ReturnType<typeof useMappingWizard>;
}

/** The last step: what is assigned, the record it produces from the sample, and what saving does. */
export function MappingReviewStep({ screen }: MappingReviewStepProps) {
  const t = useTranslations('dataSources');
  const rows = Object.entries(screen.assignments).map(([source, target]) => ({ source, target }));
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-token border border-border">
        <ResponsiveTable
          label={t('mapping.review.tableCaption')}
          rows={rows}
          rowKey={(row) => row.source}
          density="compact"
          columns={[
            {
              id: 'source',
              label: t('mapping.externalField'),
              cell: (row) => (
                <span className="font-mono text-xs [overflow-wrap:anywhere]">{row.source}</span>
              ),
            },
            {
              id: 'target',
              label: t('mapping.targetField'),
              cell: (row) => <span className="text-sm">{screen.targetLabel(row.target)}</span>,
            },
          ]}
          state={{
            kind: 'ready',
            empty: (
              <EmptyState
                className="py-10"
                title={t('mapping.review.emptyTitle')}
                description={t('mapping.review.emptyDescription')}
              />
            ),
          }}
        />
      </div>
      {screen.status.kind === 'previewed' && <MappingPreview json={screen.status.json} />}
      <Alert variant="info">{t('mapping.review.afterSave')}</Alert>
    </div>
  );
}
