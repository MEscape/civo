import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/icons';

export interface AuthSubmitButtonProps {
  readonly isPending: boolean;
  readonly label: string;
  /** What it says while the request runs. */
  readonly pendingLabel: string;
}

/** The one big action of an auth form: full width, and busy while the request runs. */
export function AuthSubmitButton({ isPending, label, pendingLabel }: AuthSubmitButtonProps) {
  return (
    <Button type="submit" size="lg" disabled={isPending} className="w-full">
      {isPending && (
        <Spinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      )}
      {isPending ? pendingLabel : label}
    </Button>
  );
}
