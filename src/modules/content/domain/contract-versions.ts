/**
 * Canonical data contract versioning (Phase 4 Rule 3 / Phase 7).
 *
 * A "contract" here is one of the canonical shapes in civic-schema.ts /
 * smartcity-schema.ts (CivicEvent, NewsItem, Service, SmartCityMetric,
 * …) — the shapes UI components are allowed to depend on, per the
 * boundary civic-types.ts documents ("External data ≠ internal data ≠ UI
 * props").
 *
 * SCOPE NOTE — what this deliberately does NOT introduce: the platform
 * has no `Dataset` or `Mapping` entity distinct from a contract, and this
 * file does not add one. `data-source-schema.ts` already documents a
 * considered, prior decision against a generic "map any external API's
 * fields to our canonical model" engine — every adapter (see
 * integrations/civic/infrastructure/adapters) is trusted code that
 * constructs a canonical shape directly, not configuration that a
 * mapping layer interprets at runtime. Introducing a `Mapping` entity
 * with no real mapping step behind it would be speculative scaffolding,
 * not a minimal change serving an actual code path. What Phase 4C's
 * dataset/mapping versioning becomes, given that architecture, is
 * versioning the one thing that genuinely exists and genuinely changes:
 * the canonical contract shape itself. If a real, runtime-configured
 * mapping layer is ever introduced, IT would be the thing to version
 * (Mapping@1 → Mapping@2) — this file's `ContractVersion` registry is
 * designed to compose with that later without changing shape, not to
 * pretend it already exists.
 *
 * Every contract here starts at version 1, because no contract has had a
 * breaking change yet — this registry exists so the NEXT breaking change
 * has somewhere to be declared, checked, and rejected-if-incompatible
 * (Phase 46 / Phase 11), rather than silently shipping.
 */

export type ContractName =
    | "NewsItem"
    | "CivicEvent"
    | "Service"
    | "Contact"
    | "OpeningHoursEntry"
    | "ServiceDetail"
    | "CouncilBody"
    | "WasteCollectionEntry"
    | "Alert"
    | "Department"
    | "SmartCityMetric";

/**
 * The current version of each canonical contract. Bump the entry here
 * (and add a new entry to `contractVersionHistory` below) only when a
 * contract's shape changes in a way that isn't safely backward-compatible
 * (Phase 7's "Safe" vs. "Migration required" vs. "Breaking"
 * classification) — e.g. renaming or removing a field, or changing a
 * field's type. Adding a new OPTIONAL field to a schema is a safe,
 * non-breaking change and does not require a version bump.
 */
export const currentContractVersions: Record<ContractName, number> = {
    NewsItem: 1,
    CivicEvent: 1,
    Service: 1,
    Contact: 1,
    OpeningHoursEntry: 1,
    ServiceDetail: 1,
    CouncilBody: 1,
    WasteCollectionEntry: 1,
    Alert: 1,
    Department: 1,
    SmartCityMetric: 1,
};

/**
 * Every version a contract has ever had, oldest first. Today this is
 * just `[currentContractVersions[name]]` for each contract, since none
 * has been bumped yet — kept as an explicit array (not derived from a
 * "1..current" range) because a future breaking change might need to
 * retire an old version's support rather than assume every integer in
 * the range was ever valid.
 */
export const contractVersionHistory: Record<ContractName, readonly number[]> = {
    NewsItem: [1],
    CivicEvent: [1],
    Service: [1],
    Contact: [1],
    OpeningHoursEntry: [1],
    ServiceDetail: [1],
    CouncilBody: [1],
    WasteCollectionEntry: [1],
    Alert: [1],
    Department: [1],
    SmartCityMetric: [1],
};

/** The contract version a fresh, unversioned reference should assume. */
export function getCurrentContractVersion(contract: ContractName): number {
    return currentContractVersions[contract];
}

/**
 * Whether `version` of `contract` is one this build still understands at
 * all (current or a still-supported historical version) — the basic
 * compatibility check Phase 11's compatibility engine builds on. This
 * does NOT mean two different versions are interchangeable, only that
 * `version` is a recognized, non-garbage-collected version of `contract`
 * (Phase 32: never garbage-collect a dependency an active release still
 * needs).
 */
export function isContractVersionSupported(contract: ContractName, version: number): boolean {
    return contractVersionHistory[contract].includes(version);
}
