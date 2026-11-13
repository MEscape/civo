/**
 * Permissions are capabilities: "<resource>.<action>". They name what may
 * be done, never a route or a component.
 *
 * Permissions are grouped by resource, with related actions kept together.
 *
 * The union is closed on purpose. Adding a permission here is the only way
 * to introduce one, and every exhaustive check downstream (the role table,
 * tests) fails to compile until it is handled.
 */
export const PERMISSIONS = [
  // Platform
  'platform.admin.manage',

  // Websites
  'website.create',
  'website.list.all',
  'website.read',
  'website.update',
  'website.delete',

  // Themes
  'theme.update',

  // Releases
  'release.read',
  'release.publish',
  'release.rollback',

  // Data sources
  'datasource.create',
  'datasource.read',
  'datasource.update',
  'datasource.test',
  'datasource.delete',

  // Datasets
  'dataset.create',
  'dataset.read',
  'dataset.update',
  'dataset.delete',
  'dataset.map',

  // Pages
  'page.create',
  'page.read',
  'page.update',
  'page.delete',
  'page.restructure',

  // Bookings
  'booking.read',
  'booking.configure',
  'booking.manage',
  'booking.read.own',
  'booking.profile.own',
  'booking.claim.own',

  // Media
  'media.read',
  'media.upload',
  'media.delete',

  // Users
  'user.read',
  'user.manage',

  // Auditing
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];
