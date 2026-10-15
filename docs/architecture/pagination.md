# Pagination

Every list-returning query is bounded ([`performance.md`](../rules/performance.md)). A list a person browses and that can grow without a ceiling is also **paginated**, with the shared pieces:

- `@lib/pagination`: the request (`resolvePageRequest`), the arithmetic, `Page<T>` and the sort allowlist.
- `@components/shared/pagination`: the page links. State lives in the address (`page`, `pageSize`, `sort`, plus the list's own filters).
- Repositories filter, order, count and slice **in the store** (`LIMIT/OFFSET` with the total from the same read), never in memory over an unbounded read.

## Audit of the lists

| List                              | Where                             | Bound today                                    | Paginated                                                                         |
| --------------------------------- | --------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Members of a tenant               | `auth` `ListUsers`                | roster cap `MAX_TENANT_MEMBERS`, then SQL page | **yes** (search, role filter, sort, page size)                                    |
| Open invitations                  | `auth` `ListInvitations`          | page                                           | **yes** (first page shown)                                                        |
| Websites of a tenant              | `website` `ListWebsites`          | `WEBSITE_PAGE_LIMITS`                          | **yes** (page and size in the address)                                            |
| Bookings in the calendar          | `booking` `GetOperationsCalendar` | date range + `MAX_CALENDAR_BOOKINGS_PER_QUERY` | no: the range is the page, as a calendar shows a period, not a list               |
| Services, resources, locations    | `booking` setup queries           | `MAX_*_PER_WEBSITE`                            | no: configuration, edited as a whole                                              |
| Data sources, datasets            | `data-sources` list queries       | `MAX_SOURCES_PER_WEBSITE`, `MAX_DATASETS_*`    | no: configuration lists                                                           |
| Records read from an external API | `data-sources` connector          | the caller's window and `maxPages`             | **API pagination**, a different thing: see below                                  |
| Release history                   | `release` `ListReleases`          | page size, then SQL page                       | **yes** (page and size in the address, on the releases tab of the release screen) |
| Migration history                 | `release` `ListMigrations`        | page size, then SQL page                       | **yes** (page and size in the address, on the component updates tab)              |

## API pagination follows the window the screen shows

Reading an external API page by page (`offset`, `page`, `cursor`, `next-url`, in the query or the body of a POST) is the data-sources connector's concern, configured per source. **How much it reads is not decided by data-sources.** The caller passes a `ReadWindow` (`limit` records from `offset`):

- `limit` is the Limit an editor set on the component in the builder, clamped by the scale of the content kind (`LIST_LIMITS`, `ListScale` on the kind's definition in the component platform). A news grid shows a page of cards; a map or a chart declares `scale: 'dataset'` and may read a whole dataset. The kind declares its scale where the kind is defined; no other list names the kinds.
- `offset` is where the visitor moved the view. A chart zoomed out asks for a larger window, panned earlier for a later `offset` (`readTrendWindowAction`). Offset and page strategies jump straight to the window; cursor and next-link strategies walk from the start and drop what precedes it.
- data-sources only enforces a backstop that follows from the connector's own limits (`READ_WINDOW_LIMITS`: `maxPages` of `maxPageSize`). It knows no kinds, so there is nothing to keep in step with the component platform.
- The source's own order decides which records form the window; filters and sorting of a component (category, "upcoming") apply to the window. Put the ordering in the source address (a sort parameter in the base URL or path) and raise the Limit when a category filter would otherwise leave too few.

A map is bounded by its Limit; moving the map to another place needs the source to filter by area (a bounding-box parameter), which a pagination strategy does not describe yet.
