'use client';

import { useState } from 'react';

import { EmptyState } from '@components/layout/layout-primitives';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

import { ConfiguredSourceCard } from './configured-source-card';
import { DataSourceForm } from './data-source-form';

import type { DataSourceDto } from '../dto/data-source-dto';

export interface DataSourcesPanelProps {
  readonly websiteId: string;
  readonly sources: readonly DataSourceDto[];
}

export function DataSourcesPanel({ websiteId, sources }: DataSourcesPanelProps) {
  const t = useTranslations('dataSources');
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-copy">{t('panel.title')}</h2>
          <p className="mt-1 text-sm text-copy-muted">{t('panel.intro')}</p>
        </div>
        <Button
          onClick={() => {
            setIsCreating(true);
          }}
          disabled={isCreating}
        >
          {t('panel.newSource')}
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>{t('panel.createTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataSourceForm
              websiteId={websiteId}
              onCancel={() => {
                setIsCreating(false);
              }}
              onSaved={() => {
                setIsCreating(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      {sources.map((source) => (
        <ConfiguredSourceCard key={source.id} source={source} />
      ))}

      {sources.length === 0 && !isCreating && (
        <EmptyState variant="outlined" className="py-8" title={t('panel.empty')} />
      )}
    </div>
  );
}
