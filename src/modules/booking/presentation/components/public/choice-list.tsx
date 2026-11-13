import { Check } from '@components/icons/icons';
import { Button } from '@components/ui/button';

export interface Choice {
  readonly id: string;
  /** Already translated, as is everything below. */
  readonly title: string;
  readonly lines: readonly string[];
}

export interface ChoiceListProps {
  readonly choices: readonly Choice[];
  /** The choice made before, if the visitor came back to this step. */
  readonly chosenId: string | null;
  readonly disabled: boolean;
  readonly onChoose: (id: string) => void;
}

/**
 * One choice out of a few, each a whole-width button: pressing it chooses and moves on. The title is
 * the button's name; the lines under it (how long, where) describe it. A choice made earlier is
 * told by a tick and a tint as well as the border.
 */
export function ChoiceList({ choices, chosenId, disabled, onChoose }: ChoiceListProps) {
  return (
    <ul className="space-y-3">
      {choices.map((choice) => {
        const isChosen = choice.id === chosenId;

        return (
          <li key={choice.id}>
            <Button
              type="button"
              variant="outline"
              aria-label={choice.title}
              aria-pressed={isChosen}
              aria-describedby={`choice-${choice.id}`}
              disabled={disabled}
              onClick={() => {
                onChoose(choice.id);
              }}
              className="h-auto min-h-11 w-full items-start justify-between gap-3 px-4 py-3 text-start whitespace-normal aria-pressed:border-primary aria-pressed:bg-canvas"
            >
              <span className="flex min-w-0 flex-col gap-1 [overflow-wrap:anywhere]">
                <span className="text-base font-semibold text-copy">{choice.title}</span>
                <span id={`choice-${choice.id}`} className="space-y-0.5 text-sm text-copy-muted">
                  {choice.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </span>
              {isChosen && (
                <Check className="mt-0.5 size-5 shrink-0 text-primary-copy" aria-hidden="true" />
              )}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
