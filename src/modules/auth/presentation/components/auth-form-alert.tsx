import { Alert } from '@components/ui/alert';
import { AlertTriangle } from '@components/ui/icons';

export interface AuthFormAlertProps {
  readonly id: string;
  /** The translated reason a form was refused; nothing is drawn without one. */
  readonly message: string | null;
}

/** Why the whole form was refused (wrong credentials, too many attempts), above its button where the eye is. */
export function AuthFormAlert({ id, message }: AuthFormAlertProps) {
  if (message === null) {
    return null;
  }
  return (
    <Alert variant="danger" id={id}>
      <AlertTriangle className="size-4" aria-hidden="true" />
      <div className="text-sm">{message}</div>
    </Alert>
  );
}
