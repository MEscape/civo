# Design Review

**Verdict:** Needs Changes

### Overall Assessment

The current Würzburg site is a focused civic website built from stored builder pages and real public records. Twelve public pages replace the former catalog showcase. Navigation prioritizes citizen tasks, maps belong to their topics, and the public appointment journey leads from service search to the verified municipal booking portal. Generated bookings and staff remain internal.

The visual composition and tested interactions are substantially improved. Public municipal launch is still blocked by missing operator-approved legal declarations. Production operations and several acceptance checks remain unverified; this is not an approval to deploy.

### Review Summary

- **Design system and tokens — Good within checked scope.** Existing semantic tokens, Source Serif/Inter self-hosted fonts and theme hooks are reused. Sixteen desktop page/brand text-contrast checks passed under the reference palette and three stress brands. Official Würzburg brand approval and complete UI/focus contrast are Not Verified.
- **Layout and visual hierarchy — Good within checked scope.** The homepage leads with three concrete tasks, then a split topic/stat composition and secondary links. Header and footer have clear roles; mobile navigation uses a native disclosure and indicates the current page. Homepage and mobility screenshots were inspected. A typographic hero avoids an unnecessary image dependency.
- **Responsive behavior — Good within checked scope.** Twelve public pages passed 60 automated page/viewport checks at 390, 768, 1440, 1920 and 320 CSS pixels, with no horizontal overflow. Actual browser zoom and text expansion remain Not Verified. A final affected-page recheck covers the later Rathaus point and source-deduplication changes.
- **Accessibility — Needs Changes.** The 60-check run found no axe violations. Skip-link focus under forced-colors/reduced-motion emulation passed previously. Map selection has a native-button list alternative and charts have paginated tables. No-script content access passed on all 12 public pages (2026-11-09). Actual screen-reader review and complete manual keyboard/forced-colors review are Not Verified.
- **Interactions and UI states — Good within tested scope.** First-party geographic rendering, list selection, zoom and focus return have browser evidence. Intraday axes display clock precision; date-only daily counts keep their calendar day across visitor time zones. Complete short series now zoom on the first action. Table pagination contains the bounded chart window. Public appointments hand off to the city; local fixture transactions are never presented as municipal bookings.
- **Loading, empty, stale and error states — Partial / Not Verified for operations.** Regression tests preserve the previous chart on an empty/failed window, enforce source read budgets, reject conflicting record identities and distinguish missing parking status/time. Expired capture budgets retain dated records and show an overdue-refresh message. A bounded ingestion cycle and its immediate within-budget no-op passed. Full deployed timeout/429/drift/crash drills remain Not Verified.
- **Copy, visual quality and complexity — Good within reviewed composition.** Public records are actual snapshots, not invented civic content. Required credit and freshness use a shared component. Parking shows source-defined status and observation time, never invented capacity. Historical weather, partial tree samples and local booking fixtures stay internal. The public tree link opens the full city cadastre. Global site search and a complete translated English city are not implemented.

### Issues

**High — Responsible operator and binding legal declarations are missing (Confirmed)**

- **Location:** Impressum, Datenschutz and Barrierefreiheit pages; WUE-037.
- **Evidence:** The pages explicitly identify missing approved operator information rather than impersonating the city. Operator identity/address and approved privacy/accessibility contacts were requested; they have not been supplied.
- **Impact:** The site cannot be approved as a publicly operated municipal website.
- **Recommended correction:** Supply the actual deployment operator and approved declarations/contact channels, then verify the published pages. Do not copy the city's declarations for a differently operated deployment.

**Resolved 2026-11-09 — Public content is unavailable without JavaScript (was High, Confirmed)**

- **Location:** Published route and page renderer; WUE-030.
- **Evidence:** Streaming left content in `div[hidden]` segments. The route now renders blocking (`instant = false`) without loading boundaries or per-block Suspense. Real Chromium with JavaScript off passed all 12 public pages at 320px on development and production builds; maps and chart tables are present as HTML.
- **Remaining:** Interactive map zoom and chart paging still need JavaScript; their list and table alternatives do not.

**High — Production deployment and monitored refresh are not established (Confirmed missing operational setup; remaining behavior Not Verified)**

- **Location:** Worker deployment, infrastructure environment and verification ledger.
- **Evidence:** The repository has source-only refresh and worker commands, bounded requests, fixture validation, previous-capture retention and an exclusive workspace lock. A successful refresh updated existing configurations; an immediate repeat made no requests. No deployed service-manager/alerting setup has been verified. The production build previously compiled and passed TypeScript, then rejected the local HTTP Redis/storage configuration.
- **Impact:** An unmonitored deployment could serve overdue data; this local configuration cannot establish production build/runtime readiness.
- **Recommended correction:** Configure real production HTTPS infrastructure, deploy one monitored refresh worker, and verify startup, stale/failure handling and recovery. Preserve the production security checks.

**Medium — Remaining production acceptance evidence is incomplete (Not Verified)**

- **Location:** Verification ledger and deployment acceptance.
- **Evidence:** Fresh-database installation, migration recovery/reset, production Core Web Vitals, complete source failure drills, actual screen-reader review, actual 200%/400% zoom and full focus/UI contrast have not been established. A 320px viewport and development layout-shift observation do not prove these checks.
- **Impact:** Automated successes cannot substantiate comprehensive accessibility, installation or performance approval.
- **Recommended correction:** Execute the missing checks in an isolated acceptance environment and record failures with their actual scope. Existing internal booking database-defense limitations remain documented separately and do not imply a local fixture booking is an official appointment.

### Recommended Priorities

1. Supply operator-approved declarations and deployment infrastructure.
2. Deploy and monitor the bounded ingestion worker; exercise source and process failures.
3. Verify clean installation, manual accessibility, actual zoom, UI/focus contrast and production performance.

### Final Assessment

The current local site is suitable for reviewing its civic information structure, real-data bindings and polished component changes. It is not approved for public municipal launch. See [the verification ledger](NOT-VERIFIED.md) for executed checks and their limits, [migration notes](MIGRATIONS.md) for compatibility, and [operator instructions](ONBOARD-A-CITY.md#operate-the-source-refresh-worker) for ingestion. No commits were made.
