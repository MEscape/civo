import { Switch } from '@components/ui/switch';

import type { ControlProps } from './control-props';

export function SwitchControl({ id, value, onChange, onCommit }: ControlProps) {
  return (
    <Switch
      id={id}
      checked={Boolean(value)}
      onCheckedChange={(isOn) => {
        onChange(isOn);
        onCommit();
      }}
    />
  );
}
