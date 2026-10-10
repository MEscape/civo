import type { ReactElement } from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WEBSITE_VALIDATION_CODES } from '@modules/website/application/contracts/website-constraints';
import { DEFAULT_WEBSITE_THEME } from '@modules/website/domain/models/website-theme';
import { updateWebsiteAction } from '@modules/website/presentation/actions/update-website-action';
import { GeneralSettingsForm } from '@modules/website/presentation/components/general-settings-form';
import type { WebsiteDto } from '@modules/website/presentation/dto/website-dto';
import { toWebsiteEdit } from '@modules/website/presentation/forms/to-website-edit';
import deWebsite from '@modules/website/presentation/i18n/de.json';
import enWebsite from '@modules/website/presentation/i18n/en.json';
import { generalSettingsSchema } from '@modules/website/presentation/schemas/general-settings-schema';

vi.mock('@modules/website/presentation/actions/update-website-action', () => ({
  updateWebsiteAction: vi.fn(),
}));

const update = vi.mocked(updateWebsiteAction);

function renderForm(ui: ReactElement, locale: 'en' | 'de' = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? enWebsite : deWebsite}
      timeZone="UTC"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

function websiteDto(overrides: { name: string; description: string | null }): WebsiteDto {
  return {
    id: 'site-1',
    slug: 'exampleville',
    templateKey: null,
    theme: DEFAULT_WEBSITE_THEME,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('generalSettingsSchema', () => {
  it('accepts a name and an empty description', () => {
    expect(generalSettingsSchema.safeParse({ name: 'Exampleville', description: '' }).success).toBe(
      true,
    );
  });

  it('rejects a name that is too short, with a stable code instead of prose', () => {
    const result = generalSettingsSchema.safeParse({ name: 'A', description: '' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(WEBSITE_VALIDATION_CODES.nameTooShort);
  });

  it('rejects a description that is too long', () => {
    const result = generalSettingsSchema.safeParse({
      name: 'Exampleville',
      description: 'x'.repeat(5_000),
    });

    expect(result.error?.issues[0]?.message).toBe(WEBSITE_VALIDATION_CODES.descriptionTooLong);
  });
});

describe('toWebsiteEdit', () => {
  it('addresses the website by id and sends the edited fields', () => {
    expect(toWebsiteEdit('site-1', { name: 'Exampleville', description: 'A town' })).toEqual({
      id: 'site-1',
      name: 'Exampleville',
      description: 'A town',
    });
  });

  it('clears the description with null instead of storing an empty text', () => {
    expect(
      toWebsiteEdit('site-1', { name: 'Exampleville', description: '  ' }).description,
    ).toBeNull();
  });
});

describe('GeneralSettingsForm', () => {
  beforeEach(() => {
    update.mockReset();
  });

  const props = {
    websiteId: 'site-1',
    slug: 'exampleville',
    initialValues: { name: 'Exampleville', description: 'A town' },
  } as const;

  it('shows the stored values and the slug as read-only', () => {
    renderForm(<GeneralSettingsForm {...props} />);

    expect(screen.getByLabelText('Name')).toHaveValue('Exampleville');
    expect(screen.getByLabelText('Description')).toHaveValue('A town');
    expect(screen.getByLabelText('Slug')).toHaveValue('exampleville');
    expect(screen.getByLabelText('Slug')).toHaveAttribute('readonly');
  });

  it('cannot be saved before something changed', () => {
    renderForm(<GeneralSettingsForm {...props} />);

    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('sends the changes through the update action and confirms', async () => {
    update.mockResolvedValue({
      ok: true,
      data: websiteDto({ name: 'Town of Exampleville', description: 'A town' }),
    });
    renderForm(<GeneralSettingsForm {...props} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Town of Exampleville' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({
        id: 'site-1',
        name: 'Town of Exampleville',
        description: 'A town',
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Changes saved.');
  });

  it('does not call the action while the name is invalid, and says why next to the field', async () => {
    renderForm(<GeneralSettingsForm {...props} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await Promise.resolve();
    });

    expect(update).not.toHaveBeenCalled();
    const name = screen.getByLabelText('Name');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('keeps what was typed and shows the server error when the update fails', async () => {
    update.mockResolvedValue({
      ok: false,
      error: { code: 'website.errors.persistenceFailed', message: 'failed' },
    });
    renderForm(<GeneralSettingsForm {...props} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Another name' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await Promise.resolve();
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Another name');
  });

  it('speaks German in the German locale', () => {
    renderForm(<GeneralSettingsForm {...props} />, 'de');

    expect(screen.getByRole('button', { name: 'Änderungen speichern' })).toBeInTheDocument();
    expect(screen.getByLabelText('Beschreibung')).toBeInTheDocument();
  });
});
