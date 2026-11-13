import { registerHooks } from 'node:module';

/**
 * CLI seeds execute trusted server modules without React Server Components.
 * Only the build-time server-only marker is replaced; client code is never run here.
 * Keep this registration confined to the explicitly imported development CLI runtime.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') {
      return nextResolve(specifier, {
        ...context,
        conditions: [...context.conditions, 'react-server'],
      });
    }
    return nextResolve(specifier, context);
  },
});
