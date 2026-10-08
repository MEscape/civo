import { toTenantId } from '@modules/auth';

import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { toWebsiteId } from '../../domain/models/ids';
import { isTemplateKey } from '../../domain/models/website-template';
import { restoreWebsiteTheme } from '../../domain/models/website-theme';

import type { Website, WebsiteSummary } from '../../domain/models/website';
import type { TemplateKey } from '../../domain/models/website-template';
import type { WebsiteTheme } from '../../domain/models/website-theme';

/**
 * Persistence shapes.
 *
 * Generated Prisma contract types never leave the persistence layer.
 */

export interface ThemeRecord {
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
  readonly headingFont: string;
  readonly bodyFont: string;
  readonly radius: string;
  readonly spacingScale: string;
}

export interface WebsiteSummaryRecord {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly templateKey: string;
  readonly createdAt: InstantRecord;
  readonly updatedAt: InstantRecord;
}

export interface WebsiteRecord extends WebsiteSummaryRecord {
  readonly theme: ThemeRecord | null;
}

/**
 * Field lists for `.select(...)`.
 *
 * Prisma 8 has no `select: { ... }` option. Queries are built by chaining,
 * and `.select()` takes field names as separate arguments, so these are
 * spread at the call site: `.select(...WEBSITE_SUMMARY_SELECT)`.
 *
 * `satisfies` keeps each list in sync with its record shape: a typo or a
 * field that is not on the record fails type-checking here, not at runtime.
 */
export const THEME_SELECT = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'headingFont',
  'bodyFont',
  'radius',
  'spacingScale',
] as const satisfies ReadonlyArray<keyof ThemeRecord>;

export const WEBSITE_SUMMARY_SELECT = [
  'id',
  'tenantId',
  'name',
  'slug',
  'description',
  'templateKey',
  'createdAt',
  'updatedAt',
] as const satisfies ReadonlyArray<keyof WebsiteSummaryRecord>;

/**
 * Converts a persisted templateKey into the domain TemplateKey.
 *
 * Old rows may contain a value that no longer exists in the template
 * registry, so persistence treats those rows as having no usable template.
 */
function toTemplateKey(raw: string | null): TemplateKey | null {
  return raw !== null && isTemplateKey(raw) ? raw : null;
}

export function toWebsiteSummary(record: WebsiteSummaryRecord): WebsiteSummary {
  return {
    id: toWebsiteId(record.id),
    tenantId: toTenantId(record.tenantId),
    name: record.name,
    slug: record.slug,
    description: record.description,
    templateKey: toTemplateKey(record.templateKey),
    createdAt: instantToDate(record.createdAt),
    updatedAt: instantToDate(record.updatedAt),
  };
}

export function toWebsite(record: WebsiteRecord): Website {
  return {
    ...toWebsiteSummary(record),
    theme: restoreWebsiteTheme(
      record.theme
        ? {
            colors: {
              primary: record.theme.primaryColor,
              secondary: record.theme.secondaryColor,
              accent: record.theme.accentColor,
            },
            typography: {
              headingFont: record.theme.headingFont,
              bodyFont: record.theme.bodyFont,
            },
            radius: record.theme.radius,
            spacingScale: record.theme.spacingScale,
          }
        : undefined,
    ),
  };
}

/**
 * Converts the domain theme into the flat WebsiteTheme persistence shape.
 */
export function toThemeData(theme: WebsiteTheme): ThemeRecord {
  return {
    primaryColor: theme.colors.primary,
    secondaryColor: theme.colors.secondary,
    accentColor: theme.colors.accent,
    headingFont: theme.typography.headingFont,
    bodyFont: theme.typography.bodyFont,
    radius: theme.radius,
    spacingScale: theme.spacingScale,
  };
}
