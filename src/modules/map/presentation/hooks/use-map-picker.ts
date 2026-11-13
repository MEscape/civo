'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { listMapOptionsAction } from '../actions/list-map-options-action';

import type { MapOptionsDto } from '../dto/map-dto';

interface PickerState {
  readonly websiteId: string;
  readonly view: MapOptionsDto | null;
  readonly status: 'loading' | 'ready' | 'failed';
}

interface PickerRequest {
  readonly websiteId: string;
  isActive: boolean;
  isPending: boolean;
}

async function loadOptions(
  request: PickerRequest,
  setState: Dispatch<SetStateAction<PickerState | null>>,
) {
  const scope = request;
  if (scope.isPending) {
    return;
  }
  scope.isPending = true;
  // Defer setup so cleanup can cancel an unmounted or replaced picker before starting its action.
  await Promise.resolve();
  if (!request.isActive) {
    return;
  }
  const update = (status: PickerState['status'], view?: MapOptionsDto) => {
    if (request.isActive) {
      setState((previous) => ({
        websiteId: request.websiteId,
        view: view ?? (previous?.websiteId === request.websiteId ? previous.view : null),
        status,
      }));
    }
  };
  update('loading');
  try {
    const result = await listMapOptionsAction({ websiteId: request.websiteId });
    if (result.ok) {
      update('ready', result.data);
    } else {
      update('failed');
    }
  } catch {
    update('failed');
  } finally {
    scope.isPending = false;
  }
}

/** Options load on opening the picker, independently authorized against its explicit website. */
/** Initial loading also resolves the current selection's label while the picker remains closed. */
export function useMapPicker(websiteId: string) {
  const [state, setState] = useState<PickerState | null>(null);
  const currentRequest = useRef<PickerRequest | null>(null);
  useEffect(() => {
    const request = { websiteId, isActive: true, isPending: false };
    currentRequest.current = request;
    void loadOptions(request, setState);
    return () => {
      request.isActive = false;
    };
  }, [websiteId]);
  const current = state?.websiteId === websiteId ? state : null;
  return {
    items: current?.view?.items ?? [],
    isTruncated: current?.view?.isTruncated ?? false,
    hasFailed: current?.status === 'failed',
    isPending: current === null || current.status === 'loading',
    handleOpenChange: (isOpen: boolean) => {
      const request = currentRequest.current;
      if (!isOpen || request?.websiteId !== websiteId) {
        return;
      }
      void loadOptions(request, setState);
    },
  };
}
