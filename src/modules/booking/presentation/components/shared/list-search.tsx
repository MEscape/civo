import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

export interface ListSearchProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
}

/** The search box above a long list. */
export function ListSearch({ id, value, onChange }: ListSearchProps) {
  const t = useTranslations('booking');

  return (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor={id} className="sr-only">
        {t('list.search')}
      </Label>
      <Input
        id={id}
        type="search"
        value={value}
        placeholder={t('list.search')}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </div>
  );
}
