import { useId } from 'react';

import { useTranslations } from '@i18n/client';

import type { PublicServiceDto } from '../../dto/catalog-dto';

export interface ServiceGuidanceProps {
  readonly service: Pick<PublicServiceDto, 'instructions' | 'requiredDocuments'>;
}

/** What the visitor should know before giving details: the instructions and the documents to bring. */
export function ServiceGuidance({ service }: ServiceGuidanceProps) {
  const t = useTranslations('booking');
  const id = useId();

  return (
    <>
      {service.instructions !== null && (
        <aside className="rounded-token border border-info-border bg-info-subtle p-4 text-sm text-info">
          <p className="font-medium">{t('details.instructions')}</p>
          <p className="mt-1 whitespace-pre-line">{service.instructions}</p>
        </aside>
      )}

      {service.requiredDocuments.length > 0 && (
        <section aria-labelledby={`${id}-documents`} className="space-y-2">
          <h4 id={`${id}-documents`} className="text-sm font-medium text-copy">
            {t('details.documents')}
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-copy">
            {service.requiredDocuments.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
