'use client';

import { useEffect, useEffectEvent, useState, useTransition } from 'react';

import { useSearchParams } from 'next/navigation';

import { testDataSourceConnectionAction } from '../actions/test-data-source-connection-action';

import type { DataSourceDto } from '../dto/data-source-dto';

export type TestMessage =
  { readonly kind: 'healthy' } | { readonly kind: 'failed'; readonly code: string };

/** The connection test of one source: its result, and the test a freshly connected source runs by itself. */
export function useSourceConnection(source: DataSourceDto) {
  const [isPending, startTransition] = useTransition();
  const [testMessage, setTestMessage] = useState<TestMessage | null>(null);

  async function runTest() {
    const result = await testDataSourceConnectionAction(source.id);
    if (!result.ok) {
      setTestMessage({ kind: 'failed', code: result.error.code });
    } else {
      const { outcome } = result.data;
      setTestMessage(
        outcome.isHealthy ? { kind: 'healthy' } : { kind: 'failed', code: outcome.errorCode },
      );
    }
  }

  // Connecting a source sends the person here with `test=1`: the test they would do next runs by itself.
  const isOpenedForTest = useSearchParams().get('test') === '1' && source.status === 'UNKNOWN';
  const testOnOpen = useEffectEvent(runTest);
  useEffect(() => {
    if (isOpenedForTest) {
      const address = new URL(window.location.href);
      address.searchParams.delete('test');
      window.history.replaceState(null, '', address);
      startTransition(testOnOpen);
    }
  }, [isOpenedForTest]);

  return {
    isPending,
    testMessage,
    isUntested: source.status === 'UNKNOWN' && testMessage === null,
    handleTestConnection: () => {
      setTestMessage(null);
      startTransition(runTest);
    },
  };
}
