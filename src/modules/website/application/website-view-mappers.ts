import type { PublicWebsiteView, WebsiteSummaryView, WebsiteView } from './contracts/website-views';
import type { Website, WebsiteSummary } from '../domain/models/website';

export function toWebsiteView(website: Website): WebsiteView {
  return {
    id: website.id,
    name: website.name,
    slug: website.slug,
    description: website.description,
    templateKey: website.templateKey,
    theme: website.theme,
    createdAt: website.createdAt,
    updatedAt: website.updatedAt,
  };
}

export function toWebsiteSummaryView(summary: WebsiteSummary): WebsiteSummaryView {
  return {
    id: summary.id,
    name: summary.name,
    slug: summary.slug,
    description: summary.description,
    templateKey: summary.templateKey,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt,
  };
}

export function toPublicWebsiteView(website: Website): PublicWebsiteView {
  return {
    id: website.id,
    name: website.name,
    slug: website.slug,
    description: website.description,
    theme: website.theme,
  };
}
