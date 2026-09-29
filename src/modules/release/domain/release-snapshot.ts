import { z } from "zod";
import { pageConfigSchema } from "@/modules/builder/domain/page-schema";
import { themeInputSchema } from "@/modules/website/domain/website-schema";

/**
 * One resolved component dependency of a release, recorded at publish
 * time (Phase 4 Rule 3 / Phase 9 / Phase 55).
 *
 * `PageNode.type` (inside `pages[].config`) is, and remains, a bare
 * string with no version — see page-schema.ts's ADR-003 note on why the
 * wire format is deliberately decoupled from the registry. That means a
 * release's raw config alone cannot say which version of "eventsGrid"
 * was live when it was published; if that component's registered
 * version is later bumped, replaying an old release's config against
 * TODAY's registry would silently resolve to today's version, which is
 * exactly what Rule 1 ("its component versions cannot change") forbids
 * in spirit even though the stored JSON itself never changes.
 *
 * This array is how a release records the answer once, at publish time,
 * independently of the registry's current state — the version pin Rule
 * 2 / Phase 55 actually ask for. It doesn't yet change how rendering
 * resolves a node (render-nodes.tsx still resolves by bare type against
 * whatever the registry currently has — see that file's own scope), so
 * today this is a durable, inspectable record and a publish-time
 * compatibility gate (releaseService's contract check), not yet an
 * enforced pin at render time; making render time respect it is
 * follow-on work once multiple component versions actually need to
 * render side by side, not a gap introduced by only recording it here.
 */
export const releaseComponentDependencySchema = z.object({
    type: z.string().min(1),
    version: z.number().int().positive(),
    contracts: z.array(
        z.object({
            contract: z.string().min(1),
            minVersion: z.number().int().positive(),
        })
    ),
});
export type ReleaseComponentDependency = z.infer<typeof releaseComponentDependencySchema>;

/**
 * The shape of `WebsiteRelease.snapshot` (Phase 4 Rule 1 / Phase 2).
 *
 * A release snapshot fully materializes everything the public renderer
 * needs for every page of the website at publish time — it never stores a
 * reference to a mutable "current" Page/PageConfig row. Reconstructing a
 * release later (rollback, debugging, a future static-export step) only
 * ever needs this JSON blob plus the component registry that already
 * ships with the running application.
 *
 * `schemaVersion` lets a future migration recognize and upgrade an older
 * snapshot shape without guessing from the JSON's structure. Bump it
 * whenever a field is added, renamed, or removed here.
 */
export const releaseSnapshotSchema = z.object({
    schemaVersion: z.literal(1),
    website: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().nullable(),
    }),
    theme: themeInputSchema,
    pages: z
        .array(
            z.object({
                path: z.string(),
                title: z.string().min(1),
                config: pageConfigSchema,
            })
        )
        .min(1, "A release must contain at least one page."),
    /**
     * Every distinct component type used anywhere in `pages`, resolved to
     * the version that was current at publish time — see
     * ReleaseComponentDependency above. One entry per distinct `type`
     * across the whole release, not per node (a component used ten times
     * on a page appears once here).
     */
    dependencies: z.array(releaseComponentDependencySchema),
});

export type ReleaseSnapshot = z.infer<typeof releaseSnapshotSchema>;
