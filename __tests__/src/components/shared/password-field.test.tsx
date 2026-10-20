import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { PasswordField } from '@components/shared/password-field';

import enApp from '@i18n/messages/en.json';

function renderField(props: Partial<Parameters<typeof PasswordField>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ app: enApp }} timeZone="UTC">
      <PasswordField id="pw" label="Password" {...props} />
    </NextIntlClientProvider>,
  );
}

describe('the password field', () => {
  it('hides what is typed until the person asks to see it', () => {
    renderField();
    const input = screen.getByLabelText('Password');

    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('warns while Caps Lock is on and stops warning once the field is left', () => {
    renderField();
    const input = screen.getByLabelText('Password');

    // The test DOM has no Caps Lock: the key event reports it the way a browser does.
    const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    event.getModifierState = (key) => key === 'CapsLock';
    act(() => {
      input.dispatchEvent(event);
    });
    expect(screen.getByText('Caps Lock is on.')).toBeInTheDocument();
    expect(input).toHaveAccessibleDescription('Caps Lock is on.');

    fireEvent.blur(input);
    expect(screen.queryByText('Caps Lock is on.')).not.toBeInTheDocument();
  });

  it('describes the input by its hint, its error and the guidance beneath it', () => {
    renderField({
      hint: 'A hint',
      error: 'Too short',
      guidanceId: 'rules',
      children: <p id="rules">Rules</p>,
    });
    const input = screen.getByLabelText('Password');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('A hint Too short Rules');
  });
});
