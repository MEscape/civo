import type { ReactNode } from 'react';

import { builderRoutes } from '@modules/builder/client';

import { ArrowRight } from '@components/icons/icons';
import { Alert } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { PagePathLabel } from '../shared/page-path-label';

import type { ComponentUpdateView } from '../../../application/contracts/publication-views';
import type { ReleaseTranslator } from '../../translation/translator';

function DetailGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-copy-muted">{label}</h4>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/** What changes for one component, in groups: where it is used, what is new, what needs a decision. */
export function ComponentUpdateDetails({
  component,
  t,
  websiteId,
  mayEditPages,
}: {
  readonly component: ComponentUpdateView;
  readonly t: ReleaseTranslator;
  readonly websiteId: string | undefined;
  readonly mayEditPages: boolean;
}) {
  const targets = component.editorTargets ?? [];
  return (
    <div className="space-y-4 bg-canvas p-4">
      {component.status === 'unresolvable' && (
        <Alert variant="warning">{t('updates.blockedHint')}</Alert>
      )}
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-4">
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
          {component.status !== 'unresolvable' &&
            component.addedFields.length + component.conflictFields.length === 0 && (
              <p className="text-sm text-copy-muted">{t('updates.noSettingChange')}</p>
            )}
        </div>
        {mayEditPages && websiteId !== undefined && (
          <div className="min-w-0 space-y-2">
            <h4 className="text-xs font-medium text-copy-muted">{t('updates.currentDrafts')}</h4>
            {targets.length === 0 ? (
              <p className="text-sm text-copy-muted">{t('updates.noDraftInstance')}</p>
            ) : (
              <ul className="space-y-2">
                {targets.map((target, index) => (
                  <li key={`${target.pageId}:${target.nodeId}`}>
                    <Link
                      href={builderRoutes.component(websiteId, target.pageId, target.nodeId)}
                      className={buttonVariants({
                        variant: 'outline',
                        size: 'sm',
                        className:
                          'h-auto min-h-8 max-w-full justify-between whitespace-normal text-left',
                      })}
                    >
                      <span className="min-w-0 break-words">
                        {t('updates.instance', {
                          page:
                            target.path === '' ? t('migration.review.homePage') : `/${target.path}`,
                          number: index + 1,
                        })}
                        <span className="sr-only"> · {t('updates.editComponent')}</span>
                      </span>
                      <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
