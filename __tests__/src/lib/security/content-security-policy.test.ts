import { describe, expect, it } from 'vitest';

import { contentSecurityPolicy } from '@lib/security';

const PRODUCTION = {
  isProduction: true,
  storageUrls: ['https://eu.storage.example.com', 'https://eu.storage.example.com/civo-public'],
  hasMap: true,
} as const;

function directive(policy: string, name: string): string[] {
  const found = policy.split('; ').find((entry) => entry.startsWith(`${name} `));
  return found === undefined ? [] : found.slice(name.length + 1).split(' ');
}

describe('contentSecurityPolicy', () => {
  it('keeps the directives that need no host: no plugins, no framing either way, workers only from here or a blob', () => {
    const policy = contentSecurityPolicy(PRODUCTION);
    for (const fixed of [
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "frame-src 'none'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ]) {
      expect(policy).toContain(fixed);
    }
  });

  it('lets the browser reach this site, the storage it uploads to, and Mapbox, and nothing else', () => {
    const sources = directive(contentSecurityPolicy(PRODUCTION), 'connect-src');

    expect(sources).toEqual([
      "'self'",
      'https://eu.storage.example.com',
      'https://api.mapbox.com',
      'https://*.tiles.mapbox.com',
      'https://events.mapbox.com',
    ]);
  });

  it('names the storage by origin, so a bucket path in the address does not narrow or widen it', () => {
    const sources = directive(contentSecurityPolicy(PRODUCTION), 'connect-src');

    expect(sources.filter((source) => source.includes('storage'))).toEqual([
      'https://eu.storage.example.com',
    ]);
  });

  it('does not open Mapbox to a site that draws no maps', () => {
    const policy = contentSecurityPolicy({ ...PRODUCTION, hasMap: false });

    expect(policy).not.toContain('mapbox.com');
  });

  it('allows images from this site, inline pictures, the storage and any https host', () => {
    const sources = directive(contentSecurityPolicy(PRODUCTION), 'img-src');

    expect(sources).toEqual([
      "'self'",
      'data:',
      'blob:',
      'https:',
      'https://eu.storage.example.com',
    ]);
  });

  it('adds a local, plain-http storage as an image and connect source in development, plus the reload socket', () => {
    const policy = contentSecurityPolicy({
      isProduction: false,
      storageUrls: ['http://localhost:8333', undefined],
      hasMap: false,
    });

    expect(directive(policy, 'connect-src')).toEqual([
      "'self'",
      'http://localhost:8333',
      'ws:',
      'wss:',
    ]);
    expect(directive(policy, 'img-src')).toContain('http://localhost:8333');
  });

  it('opens no socket in production', () => {
    expect(contentSecurityPolicy(PRODUCTION)).not.toMatch(/\bwss?:(?!\/\/)/);
  });

  it('upgrades insecure requests in production only', () => {
    expect(contentSecurityPolicy(PRODUCTION)).toContain('upgrade-insecure-requests');
    expect(contentSecurityPolicy({ ...PRODUCTION, isProduction: false })).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('adds no script policy: a nonce would force every page to render per request', () => {
    const policy = contentSecurityPolicy(PRODUCTION);

    expect(policy).not.toContain('script-src');
    expect(policy).not.toContain('default-src');
  });

  it('skips an address that is not a URL instead of failing every page', () => {
    const policy = contentSecurityPolicy({ ...PRODUCTION, storageUrls: ['not a url', undefined] });

    expect(directive(policy, 'connect-src')[1]).toBe('https://api.mapbox.com');
  });
});
