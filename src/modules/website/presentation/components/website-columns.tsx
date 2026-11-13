import { ArrowRight } from '@components/icons/icons';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { websiteRoutes } from '../routes';

import type { WebsiteSummaryView } from '../../application/contracts/website-views';
import type { AppFormatters, WebsiteTranslator } from '../translation/translator';

/** Another place a row leads to, which another area owns (the website's bookings), already worded. */
export interface WebsiteRowLink {
  readonly href: string;
  readonly label: string;
}

/**
 * A row of the list: a website the person can open, or a website they work in only through another
 * area (an employee's bookings), which has a name and its one way in and nothing else to show.
 */
export type WebsiteListRow =
  | { readonly kind: 'website'; readonly website: WebsiteSummaryView }
  | {
      readonly kind: 'elsewhere';
      readonly id: string;
      readonly name: string;
      readonly link: WebsiteRowLink;
    };

/** A website the person reaches only through another area. */
export type ElsewhereWebsite = Omit<Extract<WebsiteListRow, { kind: 'elsewhere' }>, 'kind'>;

interface WebsiteColumnsInput {
  readonly t: WebsiteTranslator;
  readonly format: AppFormatters;
  /** The website's other place, for the websites the person has one in; `undefined` for the others. */
  readonly alsoOpen?: ((websiteId: string) => WebsiteRowLink | undefined) | undefined;
}

const NOTHING = (
  <span aria-hidden="true" className="text-copy-muted">
    –
  </span>
);

/** The columns of the website list: the website itself, its address, when it changed, and where to go next. */
export function websiteColumns({
  t,
  format,
  alsoOpen,
}: WebsiteColumnsInput): ReadonlyArray<ResponsiveColumn<WebsiteListRow>> {
  return [
    {
      id: 'website',
      label: t('pages.list.columns.website'),
      cell: (row) =>
        row.kind === 'elsewhere' ? (
          <span className="font-medium text-copy">{row.name}</span>
        ) : (
          <div className="space-y-1">
            <Link
              href={websiteRoutes.detail(row.website.id)}
              className="rounded-token-sm font-medium text-primary-copy underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
            >
              {row.website.name}
            </Link>
            {row.website.description !== null && (
              <p className="text-xs text-copy-muted">{row.website.description}</p>
            )}
          </div>
        ),
    },
    {
      id: 'address',
      label: t('pages.list.columns.address'),
      cell: (row) =>
        row.kind === 'elsewhere' ? (
          NOTHING
        ) : (
          <code className="text-xs text-copy-muted">/{row.website.slug}</code>
        ),
    },
    {
      id: 'updatedAt',
      label: t('pages.detail.about.updated'),
      cell: (row) =>
        row.kind === 'elsewhere' ? (
          NOTHING
        ) : (
          <time dateTime={row.website.updatedAt.toISOString()} className="text-sm text-copy">
            {format.dateTime(row.website.updatedAt)}
          </time>
        ),
    },
    {
      id: 'actions',
      label: t('pages.list.columns.actions'),
      isAction: true,
      cell: (row) => {
        if (row.kind === 'elsewhere') {
          return <RowLink link={row.link} name={row.name} />;
        }
        const other = alsoOpen?.(row.website.id);
        return (
          <div className="flex justify-end gap-1">
            {other !== undefined && <RowLink link={other} name={row.website.name} />}
            {/* Audit log and people are one click away in the website's own navigation. */}
            <Link
              href={websiteRoutes.detail(row.website.id)}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              {t('pages.list.open')}
              <span className="sr-only"> {row.website.name}</span>
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        );
      },
    },
  ];
}

function RowLink({ link, name }: { readonly link: WebsiteRowLink; readonly name: string }) {
  return (
    <div className="flex justify-end gap-1">
      <Link href={link.href} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        {link.label}
        <span className="sr-only"> {name}</span>
      </Link>
    </div>
  );
}
