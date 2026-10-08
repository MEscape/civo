# Styling Rules

- Use the project's design system as the source of visual truth.
- Prefer shared design tokens over hard-coded visual values.
- Use shared UI primitives before creating new primitives.
- Module components compose shared UI; they do not redefine it.
- Avoid global styles except for application-wide foundations.
- Keep styling colocated with the component it styles.
- Do not use inline styles for static styling.
- Avoid arbitrary values when an existing design token applies.
- Keep responsive behavior within the component's styling contract.
- Keep dark-mode/theme behavior within the design-system conventions.
- Component variants must be explicit and typed.
- Do not duplicate CSS for visually identical components.
- Styling must meet contrast and motion requirements. See [`accessibility.md`](accessibility.md).
