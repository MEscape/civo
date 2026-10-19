# Releases and the website overview

A **release** is an immutable copy of a website's pages and settings that the public site serves (a trigger refuses any change to a stored release except its status, and the live-release pointer must name a release of the same website). Editing a page only ever writes a draft; publishing is the one action that makes drafts public ([`publish-release.ts`](../../src/modules/release/application/commands/publish-release.ts)).

## What a release keeps

| Kept       | Why                                                                                                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `snapshot` | Pages, theme and the component versions they were built with. Restoring needs nothing else.                                                                                                                                                                                                                  |
| `note`     | What the editor wrote when publishing (at most `RELEASE_NOTE_MAX_LENGTH`). Optional.                                                                                                                                                                                                                         |
| `changes`  | What this release changed against the one live before it: pages added, edited or removed, and whether the website details or the theme changed. Frozen at publish time, so the history never reads a snapshot to show it. `null` for releases made before this was kept; the history says "no details kept". |

`changes` is computed by `describeDraftChanges` from the same read a publish makes. A live release that cannot be read does not stop a publish: it is compared against as absent, so everything counts as new.

`publishedBy` is the actor id of who published. It is stored as an id, not a name, so it is never stale; the screens name the person with `loadMemberNames` (`ResolveMemberNames` in the auth module: only names, only members of the same tenant, any actor who may read the website). A person who left, or a release made before this was kept, shows no name rather than an id.

## Publication status (read only)

`GetPublicationStatus` answers, for one website, in one call: what is live, what publishing now would change, which pages block a publish, the last releases, and which components have newer versions. It reads the live release, the pages as a publish would read them and the plan of the live release against today's components. It writes nothing and records no migration (`planLiveRelease` is shared with `ProposeMigration`, which records).

Per request, the overview and the release screen share one answer (`loadPublicationStatus`, a React `cache`), so a page of several blocks reads once.

## Screens

- **Website bar** (every page of the website): the publish state, a tick when everything is live and otherwise the number of changes waiting with the way to publish them. It streams in beside the sections and shares the page's own read of the status within a request. Actions that change what a publish would change (publish, restore, apply an update, save a page, change the website or its theme) mark the website layout stale, so the next render re-reads it.
- **Overview** (`/websites/<id>`): a banner (not published yet, changes waiting, or everything live) with the one thing to do about it; the first steps while any is open (ticked from what exists: pages, a release, a booking location, a data source); appointments; the website's facts with the address and a copy button; the last releases with note, author and how long ago. The page re-reads itself when the tab becomes visible again (`RefreshOnFocus`). Each block asks for its own permission and streams in on its own.
- **Releases** (`/websites/<id>/releases`, tab `releases`): the history as a table, one page at a time, with the note, the author and what each release changed, a preview of its pages and a count. Restoring asks first and reactivates the unchanged release; drafts are never touched.
- **Component updates** (`?tab=updates`): what the live release holds against today's components, by component (version, pages, status, and per component what is new or needs a decision), when it was read, a read-only refresh, a review that proposes and records a migration, and the history of earlier updates. Updates are written to drafts and published like any other change.
- `/websites/<id>/migrations` redirects to the updates tab.

Publishing asks first (`PublishButton`): the pages that go live, an optional note, and the number the release gets. The server still decides; the button is guidance.

## Preview

`/websites/<id>/releases/<releaseId>/preview?path=<page>&from=<list page>` renders the pages a release froze, with the same renderer as the public site, inside the admin shell and read through the authorized website (`GetReleasePreview`, `release.read`). Another website's release is "not found".

- **Place in the history:** a breadcrumb back to the release list at the page the person came from (`from`), the release's own header (live badge, status, note, date, who published) and Older / Newer buttons. The neighbours come from `findNeighbours`: three indexed reads on (website, number), no snapshots.
- **Old releases that cannot be reproduced:** pages are frozen but drawn by today's components. `describePreviewFidelity` compares the release's pinned component versions with the registry: `exact`, `changed` (a component moved on, it may look different) or `unavailable` (a component is gone and shows a placeholder). The preview says so above the pages and names the components. A page whose stored content cannot be read at all says that instead of failing, and the other pages of the release still open. Restoring brings back exactly what was stored either way.
- A person with `release.rollback` can restore from the preview with the same question as in the list.
- Not built: a side-by-side comparison; each release already says what it changed against the one before it.

## Switching between websites

The website's name in the bar is a menu of the other websites. A platform administrator gets the most recently changed ones (at most 48) and an "All websites" entry, and keeps the current section when switching; a person who belongs to several websites gets those, and opens each at its start, where their role leads them. With one website there is nothing to switch and the name is plain text (`loadSwitchableWebsites`, `WebsiteSwitcher`).

## Limits

- Restoring does not reset drafts. A "restore and discard drafts" choice would overwrite editors' work and needs its own use case and confirmation.
- Component updates count components, not uses; the review that follows works on single uses and says so in its own counts.
- The bar's status costs a read of the live release and the pages on a full load or after the layout was marked stale; it is shared with the page that needs the same status, and it never blocks rendering.
