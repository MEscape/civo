import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MapOptionsDto } from '@modules/map/presentation/dto/map-dto';
import { useMapPicker } from '@modules/map/presentation/hooks/use-map-picker';

import type { ActionResult } from '@lib/result';

const { listMapOptionsAction } = vi.hoisted(() => ({ listMapOptionsAction: vi.fn() }));
vi.mock('@modules/map/presentation/actions/list-map-options-action', () => ({
  listMapOptionsAction,
}));

const OPTIONS: MapOptionsDto = {
  items: [{ id: 'town-hall', name: 'Town hall' }],
  isTruncated: false,
};

function deferred() {
  let resolve!: (result: ActionResult<MapOptionsDto>) => void;
  const promise = new Promise<ActionResult<MapOptionsDto>>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => listMapOptionsAction.mockReset());

describe('useMapPicker', () => {
  it('loads saved map labels for the explicit website before opening the picker', async () => {
    listMapOptionsAction.mockResolvedValue({ ok: true, data: OPTIONS });
    const { result } = renderHook(() => useMapPicker('website-a'));

    await waitFor(() => {
      expect(result.current.items).toEqual(OPTIONS.items);
    });
    expect(listMapOptionsAction).toHaveBeenCalledWith({ websiteId: 'website-a' });
    expect(result.current.isPending).toBe(false);
    expect(result.current.hasFailed).toBe(false);
  });

  it('keeps one request in flight when the picker opens during initial loading', async () => {
    const pending = deferred();
    listMapOptionsAction.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useMapPicker('website-a'));
    await waitFor(() => {
      expect(listMapOptionsAction).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.handleOpenChange(true);
      result.current.handleOpenChange(false);
      result.current.handleOpenChange(true);
    });
    await act(async () => {
      pending.resolve({ ok: true, data: OPTIONS });
    });

    expect(listMapOptionsAction).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual(OPTIONS.items);
  });

  it('ignores a late old website response and retains the current website options', async () => {
    const old = deferred();
    listMapOptionsAction.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
      ok: true,
      data: { items: [{ id: 'library', name: 'Library' }], isTruncated: true },
    });
    const { result, rerender } = renderHook((websiteId) => useMapPicker(websiteId), {
      initialProps: 'website-a',
    });
    await waitFor(() => {
      expect(listMapOptionsAction).toHaveBeenCalledWith({ websiteId: 'website-a' });
    });
    rerender('website-b');
    expect(result.current.items).toEqual([]);
    await waitFor(() => {
      expect(result.current.items[0]?.name).toBe('Library');
    });

    await act(async () => {
      old.resolve({ ok: true, data: OPTIONS });
    });

    expect(result.current.items[0]?.name).toBe('Library');
    expect(result.current.isTruncated).toBe(true);
    expect(result.current.isPending).toBe(false);
  });

  it('retries a failed request when opened and suppresses duplicate opens while pending', async () => {
    const retry = deferred();
    listMapOptionsAction
      .mockResolvedValueOnce({ ok: false, error: { code: 'map.source_failed' } })
      .mockReturnValueOnce(retry.promise);
    const { result } = renderHook(() => useMapPicker('website-a'));
    await waitFor(() => {
      expect(result.current.hasFailed).toBe(true);
    });

    act(() => {
      result.current.handleOpenChange(false);
      result.current.handleOpenChange(true);
      result.current.handleOpenChange(true);
    });
    await waitFor(() => {
      expect(result.current.isPending).toBe(true);
    });
    expect(listMapOptionsAction).toHaveBeenCalledTimes(2);
    await act(async () => {
      retry.resolve({ ok: true, data: OPTIONS });
    });

    expect(result.current.items).toEqual(OPTIONS.items);
    expect(result.current.hasFailed).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('handles a rejected request and ignores a response after unmount', async () => {
    listMapOptionsAction.mockRejectedValueOnce(new Error('Network unavailable'));
    const failed = renderHook(() => useMapPicker('website-a'));
    await waitFor(() => {
      expect(failed.result.current.hasFailed).toBe(true);
    });
    failed.unmount();

    const pending = deferred();
    listMapOptionsAction.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useMapPicker('website-b'));
    await waitFor(() => {
      expect(listMapOptionsAction).toHaveBeenCalledWith({ websiteId: 'website-b' });
    });
    unmount();
    await act(async () => {
      pending.resolve({ ok: true, data: OPTIONS });
    });

    expect(result.current.items).toEqual([]);
  });
});
