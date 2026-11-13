import { describe, expect, it } from 'vitest';

import { checkModuleGraph } from '../../eslint/policy/checks-dependencies.mjs';
import { loadProject } from '../../eslint/policy/index.mjs';
import { resolveSpecifier } from '../../eslint/policy/paths.mjs';

const project = loadProject(process.cwd());
const modules = new Set(['website', 'auth', 'audit']);

describe('website, auth and audit dependency direction', () => {
  it('keeps audit independent, supplies auth access to audit, and wires website through both public APIs', () => {
    const edges = new Map([...modules].map((module) => [module, new Set<string>()]));
    for (const file of project.files.values()) {
      if (file.info.area !== 'module' || !modules.has(file.info.module)) {
        continue;
      }
      for (const dependency of file.imports) {
        if (dependency.isTypeOnly) {
          continue;
        }
        const target = resolveSpecifier(file.path, dependency.specifier);
        if (
          target.kind === 'internal' &&
          target.area === 'module' &&
          target.module !== file.info.module &&
          modules.has(target.module)
        ) {
          edges.get(file.info.module)?.add(target.module);
        }
      }
    }
    expect(
      Object.fromEntries(
        [...edges].map(([module, dependencies]) => [module, [...dependencies].sort()]),
      ),
    ).toEqual({ website: ['audit', 'auth'], auth: ['audit'], audit: [] });
    expect(checkModuleGraph(project)).toEqual([]);
  });
});
