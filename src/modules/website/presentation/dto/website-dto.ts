import type {
  WebsiteThemeView,
  TemplateKey,
  WebsiteView,
} from '../../application/contracts/website-views';

/** The JSON-safe shape Server Actions return: dates as ISO-8601 strings. */
export interface WebsiteDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly templateKey: TemplateKey | null;
  readonly theme: WebsiteThemeView;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toWebsiteDto(view: WebsiteView): WebsiteDto {
  return {
    id: view.id,
    name: view.name,
    slug: view.slug,
    description: view.description,
    templateKey: view.templateKey,
    theme: view.theme,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
