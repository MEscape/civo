'use client';

import type { ReactNode } from 'react';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import { PagePathLabel } from './page-path-label';

import type { ComponentUpdateView } from '../../application/contracts/release-views';

function DetailGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-copy-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** What changes for one component, in groups: where it is used, what is new, what needs a decision. */
export function ComponentDetails({ component }: { readonly component: ComponentUpdateView }) {
  const t = useTranslations('release');
  const hasSettings = component.addedFields.length + component.conflictFields.length > 0;

  return (
    <div className="space-y-3">
      <DetailGroup label={t('updates.affectedPages')}>
        {component.pagePaths.map((path) => (
          <Badge key={path} variant="outline">
            <PagePathLabel path={path} />
          </Badge>
        ))}
      </DetailGroup>
      {component.addedFields.length > 0 && (
        <DetailGroup label={t('updates.newSettings')}>
          {component.addedFields.map((field) => (
            <Badge key={field} variant="muted">
              {field}
            </Badge>
          ))}
        </DetailGroup>
      )}
      {component.conflictFields.length > 0 && (
        <DetailGroup label={t('updates.decisionSettings')}>
          {component.conflictFields.map((field) => (
            <Badge key={field} variant="warning">
              {field}
            </Badge>
          ))}
        </DetailGroup>
      )}
      {component.status === 'unresolvable' && (
        <p className="text-sm text-copy">{t('updates.blockedHint')}</p>
      )}
      {component.status !== 'unresolvable' && !hasSettings && (
        <p className="text-sm text-copy-muted">{t('updates.noSettingChange')}</p>
      )}
    </div>
  );
}
