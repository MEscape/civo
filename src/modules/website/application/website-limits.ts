import type { PageLimits } from '@lib/pagination';

/** Website table rows stay bounded and use the same pagination mechanism as auth and audit. */
export const WEBSITE_PAGE_LIMITS: PageLimits = { defaultPageSize: 12, maxPageSize: 48 };
