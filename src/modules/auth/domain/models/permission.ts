/**
 * Permissions are capabilities: "<resource>.<action>". They name what may
 * be done, never a route or a component.
 *
 * The union is closed on purpose. Adding a permission here is the only way
 * to introduce one, and every exhaustive check downstream (the role table,
 * tests) fails to compile until it is handled.
 */
export const PERMISSIONS = [
  'website.create',
  'website.read',
  'website.update',
  'website.delete',
  'theme.update',
  'release.read',
  'release.publish',
  'release.rollback',
  'datasource.create',
  'datasource.read',
  'datasource.test',
  'datasource.delete',
  'dataset.create',
  'dataset.read',
  'dataset.update',
  'dataset.delete',
  'dataset.map',
  'page.create',
  'page.read',
  'page.update',
  'page.delete',
  'page.restructure',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
