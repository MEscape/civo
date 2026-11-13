'use client';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

export interface StaleNoticeProps {
  /** Already translated: what the notice says, for the thing that was changed meanwhile. */
  readonly title: string;
  readonly body: string;
  readonly reloadLabel: string;
}

/** Somebody else saved first: the input stays on screen, and reloading shows what they saved. */
export function StaleNotice({ title, body, reloadLabel }: StaleNoticeProps) {
  const router = useRouter();

  return (
    <Alert variant="danger" role="alert">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{body}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.refresh();
          }}
        >
          {reloadLabel}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
