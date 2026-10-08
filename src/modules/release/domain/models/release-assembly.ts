import type { ValidationAppError } from '@lib/errors';
import { fieldPath } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { assertNever, unique, isDefined, pick } from '@lib/utils';

import {
  RELEASE_VALIDATION_CODES as CODES,
  createReleasePublishBlockedBag,
} from '../errors/release-errors';

import { RELEASE_SNAPSHOT_SCHEMA_VERSION } from './release-snapshot';

import type {
  ComponentResolver,
  PublishableWebsite,
  PublishablePage,
  ReadyPublishablePage,
  ResolvedComponent,
} from './publishable';
import type { ReleaseComponentDependency, ReleaseSnapshot, SnapshotPage } from './release-snapshot';

const HOME_PAGE_FIELD = 'home';

interface Problem {
  readonly field: string;
  readonly code: string;
}

type PageOutcome =
  | {
      readonly kind: 'accepted';
      readonly page: SnapshotPage;
      readonly dependencies: readonly ReleaseComponentDependency[];
    }
  | { readonly kind: 'blocked'; readonly problems: readonly Problem[] };

type AcceptedOutcome = Extract<PageOutcome, { kind: 'accepted' }>;

export interface AssembleReleaseSnapshotInput {
  readonly website: PublishableWebsite;
  readonly pages: readonly PublishablePage[];
  readonly resolveComponent: ComponentResolver;
}

function pageField(path: string): string {
  return fieldPath('pages', path === '' ? HOME_PAGE_FIELD : path);
}

function blocked(field: string, code: string): PageOutcome {
  return { kind: 'blocked', problems: [{ field, code }] };
}

function isAccepted(outcome: PageOutcome): outcome is AcceptedOutcome {
  return outcome.kind === 'accepted';
}

function hasIncompatibleContract(component: ResolvedComponent): boolean {
  return component.contracts.some((contract) => contract.currentVersion < contract.minVersion);
}

function toDependency(component: ResolvedComponent): ReleaseComponentDependency {
  return {
    type: component.type,
    version: component.version,
    contracts: component.contracts.map((c) => pick(c, ['contract', 'minVersion'])),
  };
}

/**
 * A type that is not registered is skipped, not rejected: an unknown type
 * is the renderer's concern (it shows a placeholder), not a reason to
 * block publishing.
 */
function evaluateReadyPage(
  page: ReadyPublishablePage,
  resolveComponent: ComponentResolver,
): PageOutcome {
  const components = page.componentTypes.map(resolveComponent).filter(isDefined);

  const incompatible = components.filter(hasIncompatibleContract);
  if (incompatible.length > 0) {
    const field = pageField(page.path);
    return {
      kind: 'blocked',
      problems: incompatible.map((component) => ({
        field: fieldPath(field, component.type),
        code: CODES.contractIncompatible,
      })),
    };
  }

  return {
    kind: 'accepted',
    page: { path: page.path, title: page.title, config: page.config },
    dependencies: components.map(toDependency),
  };
}

function evaluatePage(page: PublishablePage, resolveComponent: ComponentResolver): PageOutcome {
  switch (page.status) {
    case 'config_missing':
      return blocked(pageField(page.path), CODES.pageConfigMissing);
    case 'config_invalid':
      return blocked(pageField(page.path), CODES.pageConfigInvalid);
    case 'ready':
      return evaluateReadyPage(page, resolveComponent);
    default:
      return assertNever(page);
  }
}

/**
 * The only way a release snapshot is produced. Reports every offending page
 * and component at once (not just the first), so a migration preview can
 * show them all.
 *
 * Pure: the same input always yields the same snapshot, which keeps the
 * stored hash deterministic.
 */
export function assembleReleaseSnapshot(
  input: AssembleReleaseSnapshotInput,
): AppResult<ReleaseSnapshot, ValidationAppError> {
  const { website, pages, resolveComponent } = input;

  if (pages.length === 0) {
    const bag = createReleasePublishBlockedBag();
    bag.add('pages', CODES.noPages);
    return err(bag.toError());
  }

  const outcomes = pages.map((page) => evaluatePage(page, resolveComponent));
  const problems = outcomes.flatMap((outcome) =>
    outcome.kind === 'blocked' ? outcome.problems : [],
  );
  if (problems.length > 0) {
    const bag = createReleasePublishBlockedBag();
    for (const { field, code } of problems) {
      bag.add(field, code);
    }
    return err(bag.toError());
  }

  const accepted = outcomes.filter(isAccepted);
  return ok({
    schemaVersion: RELEASE_SNAPSHOT_SCHEMA_VERSION,
    website: pick(website, ['id', 'name', 'slug', 'description']),
    theme: website.theme,
    pages: accepted.map((outcome) => outcome.page),
    // Every page resolves a type through the same registry at the same
    // moment, so duplicates are identical and keeping the first is safe.
    dependencies: unique(
      accepted.flatMap((outcome) => outcome.dependencies),
      (dependency) => dependency.type,
    ),
  });
}
