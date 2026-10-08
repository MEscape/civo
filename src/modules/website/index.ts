/**
 * Server-side public API of the website module. Other modules and framework
 * entry points import from here and nowhere deeper. Components that run in
 * the browser import from `./client` instead: this file reaches server-only
 * code through `composition.ts` and must never end up in a client bundle.
 */

/** Server-only queries for Server Components. Mutations are reachable through Server Actions only. */
export { restoreStoredWebsiteTheme, websiteQueries } from './composition';

export { CreateWebsiteForm } from './presentation/components/create-website-form';
export { ThemeProvider } from './presentation/components/theme-provider';
export { ThemeSettingsForm } from './presentation/components/theme-settings-form';
export { themeToCssVariables } from './presentation/theme/theme-css';
export { websiteRoutes } from './presentation/routes';

export { default as enWebsite } from './presentation/i18n/en.json';
export { default as deWebsite } from './presentation/i18n/de.json';

export type { WebsiteView } from './application/contracts/website-views';
