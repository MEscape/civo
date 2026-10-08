import type { WebsiteChangesInput, WebsiteDraftInput } from '../../domain/models/website';
import type { TemplateKey } from '../../domain/models/website-template';
import type { WebsiteTheme, WebsiteThemeInput } from '../../domain/models/website-theme';

export type { TemplateKey, WebsiteThemeInput };

/** The theme as consumers see it. Plain, serializable, fully resolved. */
export type WebsiteThemeView = WebsiteTheme;

/** A website for its owner. The tenant is an internal detail and is not exposed. */
export interface WebsiteView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly templateKey: TemplateKey | null;
  readonly theme: WebsiteThemeView;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** One row of a website list; carries no theme. */
export type WebsiteSummaryView = Omit<WebsiteView, 'theme'>;

/** Everything the public site needs to render, and nothing about ownership or history. */
export interface PublicWebsiteView {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly theme: WebsiteThemeView;
}

export type CreateWebsiteInput = WebsiteDraftInput;

export interface UpdateWebsiteInput extends WebsiteChangesInput {
  readonly id: string;
}

export interface UpdateWebsiteThemeInput {
  readonly websiteId: string;
  readonly theme: WebsiteThemeInput;
}
