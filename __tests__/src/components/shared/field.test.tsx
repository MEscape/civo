import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  CheckboxField,
  describedByIds,
  FieldHint,
  FieldMessage,
  TextareaField,
  TextField,
} from '@components/shared/field';

describe('accessible form fields', () => {
  it('associates the label, hint, error, and caller-provided guidance with a text control', () => {
    render(
      <>
        <p id="guidance">Additional guidance</p>
        <TextField
          id="name"
          label="Name"
          hint="Use a public name"
          error="Name is required"
          aria-describedby="guidance"
          isValid
        />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Use a public name Name is required Additional guidance',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
  });

  it('removes stale invalid and described-by states when errors and hints disappear', () => {
    const { rerender } = render(<TextField id="name" label="Name" error="Required" hint="Help" />);
    rerender(<TextField id="name" label="Name" isValid />);
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps native checkbox interaction and ties validation feedback to the checkbox', () => {
    const change = vi.fn();
    render(
      <CheckboxField
        id="terms"
        label="Agree"
        hint="Required to continue"
        error="Please agree"
        onChange={change}
      />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Agree' });
    expect(checkbox).toHaveAccessibleDescription('Required to continue Please agree');
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(change).toHaveBeenCalledOnce();
  });

  it('does not render empty hints or error announcements', () => {
    const { container } = render(
      <>
        <FieldHint id="hint" hint="" />
        <FieldMessage id="error" message="" />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(describedByIds('', false, null, undefined)).toBeUndefined();
    expect(describedByIds('hint', false, 'external')).toBe('hint external');
  });

  it('wires a textarea like a text field', () => {
    render(<TextareaField id="about" label="About" hint="A short summary" error="Too long" />);
    const textarea = screen.getByRole('textbox', { name: 'About' });
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(textarea).toHaveAccessibleDescription('A short summary Too long');
  });
});
