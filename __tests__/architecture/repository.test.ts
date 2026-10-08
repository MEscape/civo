import { describe, expect, it } from 'vitest';

import { describeEntryPoints } from '../../eslint/architecture-policy/checks-behavior.mjs';
import { checkPublicApi } from '../../eslint/architecture-policy/checks-dependencies.mjs';
import { checkModuleStructure } from '../../eslint/architecture-policy/checks-structure.mjs';
import { CHECKS, loadProject } from '../../eslint/architecture-policy/index.mjs';
import {
  KNOWN_MODULE_CYCLES,
  LEGACY_MODULES,
  MODULE_OVERRIDES,
} from '../../eslint/architecture-policy/policy.mjs';
import plugin from '../../eslint/plugins/architecture/index.mjs';

import { describeViolations } from './fixture-tree';

import type { Violation } from './fixture-tree';

/** The policy shapes this test reads; the policy is untyped ESM (see eslint/shims.d.ts). */
interface ModuleOverride {
  readonly reason: string;
  readonly extraRootFiles?: Readonly<Record<string, readonly string[]>>;
}
interface LegacyModule {
  readonly reason: string;
  readonly relax?: readonly string[];
}

const ROOT = process.cwd();
const project = loadProject(ROOT);

describe('architecture of this repository', () => {
  it('finds the modules it is meant to police', () => {
    expect(project.modules).toEqual(expect.arrayContaining(['auth', 'website']));
    expect(project.files.size).toBeGreaterThan(50);
  });

  for (const [name, check] of Object.entries<(p: unknown) => Violation[]>(CHECKS)) {
    it(`holds: ${name}`, () => {
      const violations = check(project);
      expect(violations, `\n${describeViolations(violations)}\n`).toEqual([]);
    });
  }

  it('gives every externally reachable entry point an explicit authorization category', () => {
    const entries = describeEntryPoints(project) as Array<{
      kind: string;
      name: string;
      category: string;
      ok: boolean;
    }>;
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.filter((e) => !e.ok).map((e) => `${e.kind}:${e.name}=${e.category}`)).toEqual(
      [],
    );
    // `protected` is the default and needs no review; every way AROUND authorization is listed here on purpose, so adding
    // a public or system entry point is a visible change in review (it also needs an `@authorization` tag with a reason).
    const exceptions = entries
      .filter((e) => e.category !== 'protected')
      .map((e) => `${e.kind}:${e.name}=${e.category}`)
      .sort();
    expect(exceptions).toEqual([
      'action:requestPasswordResetAction=public',
      'action:resetPasswordAction=public',
      'action:signInAction=public',
      'action:signOutAction=public',
      'action:signUpAction=public',
      'route-handler:GET src/app/api/health/route.ts=none',
      'use-case:BuildMapModel=public',
      'use-case:CanNestComponent=public',
      'use-case:CreateSystemPage=system',
      'use-case:GetComponentDefaultProps=public',
      'use-case:GetComponentReleaseInfo=public',
      'use-case:GetCurrentActor=public',
      'use-case:GetMappedDatasetRecords=public',
      'use-case:GetPublicWebsiteBySlug=public',
      'use-case:GetPublishedSnapshot=public',
      'use-case:ListComponentCatalog=public',
      'use-case:ListContent=public',
      'use-case:ListPagesForRelease=system',
      'use-case:RequestPasswordReset=public',
      'use-case:ResetPassword=public',
      'use-case:SignIn=public',
      'use-case:SignOut=public',
      'use-case:SignUp=public',
    ]);
  });

  it('keeps the policy exceptions small, explicit and justified', () => {
    // the one exception to the module layout: auth's single authorization service file in application/
    const extraRootFiles = Object.entries<ModuleOverride>(MODULE_OVERRIDES).flatMap(
      ([module, override]) =>
        Object.entries(override.extraRootFiles ?? {}).map(
          ([layer, files]) => `${module}/${layer}/${files.join(',')}`,
        ),
    );
    expect(extraRootFiles).toEqual(['auth/application/authorization-service.ts']);
    expect(Object.keys(MODULE_OVERRIDES)).toEqual(['auth']);
    for (const [name, override] of Object.entries<ModuleOverride>(MODULE_OVERRIDES)) {
      expect(override.reason.length, `${name} needs a reason`).toBeGreaterThan(40);
    }
    const authFiles = project
      .moduleFiles('auth')
      .filter((f: { local: string }) => f.local === 'application/authorization-service.ts');
    expect(authFiles).toHaveLength(1);
  });

  it('lists a legacy module only while it still needs the exemption (the list can only shrink)', () => {
    expect(Object.keys(LEGACY_MODULES).sort()).toEqual([]);
    for (const [name, legacy] of Object.entries<LegacyModule>(LEGACY_MODULES)) {
      expect(legacy.reason.length, `${name} needs a reason`).toBeGreaterThan(40);
      expect(project.modules, `${name} no longer exists: remove it from LEGACY_MODULES`).toContain(
        name,
      );
      for (const rule of legacy.relax ?? []) {
        if (rule.startsWith('architecture/')) {
          expect(Object.keys(plugin.rules), `${rule} is not an architecture rule`).toContain(
            rule.slice('architecture/'.length),
          );
        }
      }
      // lift the exemption: the structure family must find something to report, otherwise the entry is stale
      const saved = LEGACY_MODULES[name];
      delete (LEGACY_MODULES as Record<string, unknown>)[name];
      try {
        const own = [...checkModuleStructure(project), ...checkPublicApi(project)].filter(
          (v: Violation) => v.file?.startsWith(`src/modules/${name}/`) === true,
        );
        expect(
          own.length,
          `${name} follows the module layout now: remove it from LEGACY_MODULES`,
        ).toBeGreaterThan(0);
      } finally {
        (LEGACY_MODULES as Record<string, unknown>)[name] = saved;
      }
    }
  });

  it('lists a known module cycle only while it exists', () => {
    // `holds: module graph` already fails for an unlisted cycle and for a listed one that is gone; this pins the list.
    expect(KNOWN_MODULE_CYCLES).toEqual([]);
  });
});
