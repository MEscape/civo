- look all components and look if improvement of ui and usage of layout primitives etc

- restructure in release folder -> models ? into multiple folders

- adjustment in proxy? like let everything go through /s ?

- do not use plain formatters only via my i18n

- use attribute format, should we also have sth like this in component platform we need a lot of formatting especially in smartcity components

- updated website template smartcity with map and civic with appointment booking.

- we have saturation check for theme colors so it could switch based on contrast to dark mode but then we need also for mapbox. not only light

- check usage of server-only where to add where to remove

- why is /support/dataset-limits only used in specific smartcity components and not all?

- finegrain app layer -> seo and consistency!

- idk how to handle error and not found buttons for redirect because how to determine which public site?!

- in public is outdated root page

- update lib readme because of seo and clock update/adding

- no global i18n provider but one for each module?

- i18n translations work bout not for our external data might also need translation but because its dynamic we need like google translator or sth like this

- quick link,location skeleton?

- Client.ts missing and you see in Website we can Change theme and changing Colors might set the Background based on Saturation contrasts dynamic from White to black and backwards yk shouldnt map style light / dark also adjust? or is it already doing this?
  export const MAX_CONTENT_LIST_LIMIT = 1_000; shouldnt we introduce a sparate for map? ist an exception every other list not soo much!!!

{"level":"warn","message":"auth.disabled_dev_actor_active","timestamp":"2026-10-09T19:48:07.854Z","context":{"module":"auth.dev-actor","role":"admin"}}
✓ Compiled in 77.8s
○ Compiling /[locale]/websites ...
{"level":"warn","message":"auth.disabled_dev_actor_active","timestamp":"2026-10-09T19:52:06.535Z","context":{"module":"auth.dev-actor","role":"admin"}}
GET /de/websites 200 in 11.9s (next.js: 5.0s, proxy.ts: 5.0s, generate-params: 0.1ms, application-code: 1984ms)
{"level":"warn","message":"db.query.failed","timestamp":"2026-10-09T19:52:30.477Z","context":{"module":"infrastructure.prisma","sql":"SELECT \"Website\".\"id\" AS \"id\", \"Website\".\"tenantId\" AS \"tenantId\", \"Website\".\"name\" AS \"name\", \"Website\".\"slug\" AS \"slug\", \"Website\".\"description\" AS \"description\", \"Website\".\"templateKey\" AS \"templateKey\", \"Website\".\"createdAt\" AS \"createdAt\", \"Website\".\"updatedAt\" AS \"updatedAt\" FROM \"public\".\"Website\" WHERE \"Website\".\"tenantId\" = $1 ORDER BY \"Website\".\"updatedAt\" DESC, \"Website\".\"id\" ASC LIMIT 50","rowCount":0,"latencyMs":21681,"completed":false,"source":"driver"}}
{"level":"warn","message":"db.connection_error","timestamp":"2026-10-09T19:52:31.648Z","context":{"module":"infrastructure.prisma","mappedTo":"website.persistence_failed"}}
{"level":"error","message":"listByTenant failed","timestamp":"2026-10-09T19:52:31.783Z","context":{"module":"website.persistence","operation":"listByTenant"},"error":{"name":"SqlConnectionError","message":"Connection terminated due to connection timeout","stack":"SqlConnectionError: Connection terminated due to connection timeout\n at normalizePgError (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\node_modules_@prisma_orm-target-postgres_dist_1so7v9pycyc-7._.js:10928:42)\n at PostgresPoolDriverImpl.query (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\node_modules_@prisma_orm-target-postgres_dist_1so7v9pycyc-7._.js:9358:242)\n at process.processTicksAndRejections (node:internal/process/task_queues:104:5)\n at async iterator (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\node_modules_@prisma_07t95kdjdp9n4._.js:2393:30)\n at async PostgresRuntimeImpl.streamRows (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\1b0p_@prisma_orm-family-sql_dist_170-hkzsvbqtw._.js:10041:34)\n at async generator (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\1b0p_@prisma_orm-family-sql_dist_170-hkzsvbqtw._.js:10109:13)\n at async generator (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\1b0p_@prisma_orm-family-sql_dist_170-hkzsvbqtw._.js:3362:26)\n at async C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\node_modules_@prisma_07t95kdjdp9n4._.js:2127:30\n at async orFail (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\[root-of-the-server]\__1pn3r1k0fkvie._.js:218:20)\n at async WebsitesList (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\[root-of-the-server]__1pn3r1k0fkvie._.js:53:22)"}}
{"level":"error","message":"route.failed","timestamp":"2026-10-09T19:52:37.275Z","context":{"code":"website.persistence_failed"},"error":{"name":"UnknownError","message":"[object Object]"}}
⨯ Error: website.persistence_failed
at escalate (src\lib\errors\route-errors.ts:8:9)
at infrastructure (src\app\_lib\or-fail.ts:35:40)
at matchAppError (src\lib\errors\factory.ts:84:10)
at orFail (src\app\_lib\or-fail.ts:29:23)
at async WebsitesList (src\app\[locale]\(protected)\websites\page.tsx:32:20)
6 | export function escalate(error: AppError): never {
7 | logger.error('route.failed', error, { code: error.code });

> 8 | throw new Error(error.code, { cause: error });
> | ^
> 9 | }
> 10 | {
> digest: '1351315003',
> [cause]: {
> kind: 'infrastructure',
> code: 'website.persistence_failed',
> message: 'Website persistence failed during listByTenant.',
> cause: Error [SqlConnectionError]: Connection terminated due to connection timeout
> at normalizePgError (3-targets\7-drivers\postgres\dist\temporal-text-parsers-M28a91UF.mjs:116:39)
> at PostgresPoolDriverImpl.query (3-targets\7-drivers\postgres\dist\runtime.mjs:140:10)
> at async orFail (src\app\_lib\or-fail.ts:24:18)
> at async WebsitesList (src\app\[locale]\(protected)\websites\page.tsx:32:20)
> 114 | return new SqlQueryError(error.message, options);
> 115 | }
> 116 | if (isConnectionError(error)) return new SqlConnectionError(error.message, {
> | ^
> 117 | cause: error,
> 118 | transient: isTransientConnectionError(error)
> 119 | }); {
> kind: 'sql_connection',
> transient: true,
> [cause]: [Error]
> }
> }
> }
> {"level":"warn","message":"db.query.failed","timestamp":"2026-10-09T19:53:30.810Z","context":{"module":"infrastructure.prisma","sql":"SELECT \"Website\".\"id\" AS \"id\", \"Website\".\"tenantId\" AS \"tenantId\", \"Website\".\"name\" AS \"name\", \"Website\".\"slug\" AS \"slug\", \"Website\".\"description\" AS \"description\", \"Website\".\"templateKey\" AS \"templateKey\", \"Website\".\"createdAt\" AS \"createdAt\", \"Website\".\"updatedAt\" AS \"updatedAt\" FROM \"public\".\"Website\" WHERE \"Website\".\"tenantId\" = $1 ORDER BY \"Website\".\"updatedAt\" DESC, \"Website\".\"id\" ASC LIMIT 50","rowCount":0,"latencyMs":81687,"completed":false,"source":"driver"}}
> {"level":"warn","message":"db.connection_error","timestamp":"2026-10-09T19:53:30.825Z","context":{"module":"infrastructure.prisma","mappedTo":"website.persistence_failed"}}
> {"level":"error","message":"listByTenant failed","timestamp":"2026-10-09T19:53:30.825Z","context":{"module":"website.persistence","operation":"listByTenant"},"error":{"name":"SqlConnectionError","message":"Connection terminated due to connection timeout","stack":"SqlConnectionError: Connection terminated due to connection timeout\n at normalizePgError (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\node_modules_@prisma_orm-target-postgres_dist_1so7v9pycyc-7._.js:10928:42)\n at PostgresPoolDriverImpl.query (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\node_modules_@prisma_orm-target-postgres_dist_1so7v9pycyc-7._.js:9358:242)\n at process.processTicksAndRejections (node:internal/process/task_queues:104:5)\n at async iterator (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\node_modules_@prisma_07t95kdjdp9n4._.js:2393:30)\n at async PostgresRuntimeImpl.streamRows (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\1b0p_@prisma_orm-family-sql_dist_170-hkzsvbqtw._.js:10041:34)\n at async generator (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\1b0p_@prisma_orm-family-sql_dist_170-hkzsvbqtw._.js:10109:13)\n at async generator (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\1b0p_@prisma_orm-family-sql_dist_170-hkzsvbqtw._.js:3362:26)\n at async C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\node_modules_@prisma_07t95kdjdp9n4._.js:2127:30\n at async orFail (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\[root-of-the-server]\__1pn3r1k0fkvie._.js:218:20)\n at async WebsitesList (C:\\Users\\MEsc\\Documents\\Programming\\civo\\.next\\dev\\server\\chunks\\ssr\\[root-of-the-server]__1pn3r1k0fkvie._.js:53:22)"}}
> {"level":"error","message":"route.failed","timestamp":"2026-10-09T19:53:30.847Z","context":{"code":"website.persistence_failed"},"error":{"name":"UnknownError","message":"[object Object]"}}
> {"level":"warn","message":"auth.disabled_dev_actor_active","timestamp":"2026-10-09T19:52:41.795Z","context":{"module":"auth.dev-actor","role":"admin"}}
> ⨯ Error: website.persistence_failed
> at escalate (src\lib\errors\route-errors.ts:8:9)
> at infrastructure (src\app\_lib\or-fail.ts:35:40)
> at matchAppError (src\lib\errors\factory.ts:84:10)
> at orFail (src\app\_lib\or-fail.ts:29:23)
> at async WebsitesList (src\app\[locale]\(protected)\websites\page.tsx:32:20)
> 6 | export function escalate(error: AppError): never {
> 7 | logger.error('route.failed', error, { code: error.code });
> 8 | throw new Error(error.code, { cause: error });
> | ^
> 9 | }
> 10 | {
> digest: '1351315003',
> [cause]: {
> kind: 'infrastructure',
> code: 'website.persistence_failed',
> message: 'Website persistence failed during listByTenant.',
> cause: Error [SqlConnectionError]: Connection terminated due to connection timeout
> at normalizePgError (3-targets\7-drivers\postgres\dist\temporal-text-parsers-M28a91UF.mjs:116:39)
> at PostgresPoolDriverImpl.query (3-targets\7-drivers\postgres\dist\runtime.mjs:140:10)
> at async orFail (src\app\_lib\or-fail.ts:24:18)
> at async WebsitesList (src\app\[locale]\(protected)\websites\page.tsx:32:20)
> 114 | return new SqlQueryError(error.message, options);
> 115 | }
> 116 | if (isConnectionError(error)) return new SqlConnectionError(error.message, {
> | ^
> 117 | cause: error,
> 118 | transient: isTransientConnectionError(error)
> 119 | }); {
> kind: 'sql_connection',
> transient: true,
> [cause]: [Error]
> }
> }
> }
