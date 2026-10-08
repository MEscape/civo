'use client';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { PAGE_OUTCOME_MESSAGE_KEYS } from '../messages/message-keys';

import { PagePathLabel } from './page-path-label';

import type { ApplyMigrationResultDto } from '../dto/migration-result-dto';

export interface ApplyResultProps {
  readonly result: ApplyMigrationResultDto;
}

/**
 * What an apply did, page by page. A migration that stays `proposed` is not
 * an error to hide: it names which pages were written and which were left,
 * so the reviewer knows exactly what state the drafts are in.
 */
export function ApplyResult({ result }: ApplyResultProps) {
  const t = useTranslations('release');
  const isApplied = result.status === 'applied';

  return (
    <Alert variant={isApplied ? 'success' : 'warning'} role="status">
      <AlertTitle>
        {t(isApplied ? 'migration.result.applied' : 'migration.result.incomplete')}
      </AlertTitle>
      <AlertDescription>
        {t('migration.result.summary', {
          updated: result.updatedNodeCount,
          skipped: result.skippedNodeCount,
        })}
      </AlertDescription>
      {result.pages.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {result.pages.map((page) => (
            <li key={page.path}>
              <span className="font-medium">
                <PagePathLabel path={page.path} />
              </span>
              {': '}
              {t(PAGE_OUTCOME_MESSAGE_KEYS[page.outcome])}
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
