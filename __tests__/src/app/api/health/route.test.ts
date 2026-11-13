import { describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/health/route';

vi.mock('next/server', () => ({ connection: async () => undefined }));

describe('GET /api/health', () => {
  it('answers liveness without cacheable or database-dependent information', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
