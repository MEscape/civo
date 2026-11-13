# Würzburg implementation assumptions

## Decisions

- 2026-11-06: The Designer Agent instructions are `docs/agents/designer-agent.md`. The supplied master prompt refers to sections absent from that file. Follow its actual evidence, severity and report rules together with the explicit requirements in the master prompt.
- Website identity is tenant identity. Reuse the existing website, builder, release, data-sources, map and booking modules; do not introduce a parallel city renderer.
- Use npm, the repository's package manager. On this Windows host use `npm.cmd` because PowerShell blocks `npm.ps1`.
- Only the existing roles are seedable: `platform_admin`, `admin`, `editor`, `contributor`, `viewer`, `employee`. Publisher, approver and citizen roles are proposals until implemented and authorized by repository policy.
- Booking `HELD` is not a waitlist. Do not relabel unsupported states as implemented.
- The reference site is a development demonstration, not an official municipal service. Fictional content, contacts and booking offers must say so. Legal demonstration text is not an approved legal statement.
- Source availability does not establish permission to reuse it. An unknown license blocks public redistribution until clarified.
- Do not put personal names, emails or phone numbers from public records into fixtures. Preserve institutional/aggregate/geographic data and record any projection used.
- Preserve existing local environment files. Never commit their contents or log connection strings.
- The initial Git branch has no commits and the entire supplied repository is untracked. The user subsequently instructed **no commits**. Keep the work in the workspace and record milestones in this directory without Git mutations.

## Open evidence gaps

- No official Würzburg brand specification has yet been verified. Any proposed civic palette is a demonstration, not a claim of official branding.
- Whole-catalog visual, keyboard and screen-reader acceptance requires a running application and browser evidence.
- Source enumeration is bounded to the catalog returned at the recorded capture time. Newly published resources require another discovery run.

## Implementation decisions and remaining constraints

- The demonstration palette is `#8F1838`, `#42554F`, `#A76521`; it is not asserted to be official Würzburg branding. Existing self-hosted fonts are reused. Four-brand automated text contrast passed; full focus/UI contrast remains unverified.
- German reference copy is seeded. Existing English platform messages cover new controls, but a translated English city website is not implemented.
- Synthetic examples currently exercise otherwise unconnected civic components. This does not establish that real municipal sources do not exist; it remains a master-brief gap and is disclosed publicly.
- Component Lab stays outside the public release and inside the protected builder. There is no standalone all-state lab route or claim that every state was tested.
- Bound `ContentOrigin` values carry nested snapshot/synthetic/live provenance. No snapshot is described as live data.
- Versioned source JSON and an administrative provenance sidecar reuse existing storage. The sidecar excludes later non-seed IDs and is not a universal audit log.
- Scoped reset, fresh database migration, migration down and operational rollback remain unverified. Production URL security checks were preserved after the build rejected local HTTP services.

## Current scope override: citizen site, 2026-11-06

The latest user request supersedes the original all-components/public-demo requirement. Publish fewer task-focused civic pages, integrate maps within topics and keep generated component/booking fixtures internal. Public records must be real. Do not invent official appointments, legal approval, employees or civic datasets. Fictional employee names are permitted for local booking fixtures.

Advisory robots rules no longer block explicitly requested public API probes. The capture flag records that instruction. Access controls, real source terms, rate budgets and browser privacy remain enforced.

Use a compact typographic hero until a suitable licensed city image is needed and approved. No invented city photograph or third-party image request is introduced. Legal/operator details were requested asynchronously; they remain required for public launch.

## Continuation decisions, 2026-11-09

The master prompt was supplied again. The user chose:

- **Scope:** keep the 12-page citizen site. Cover every catalog component through the protected Component Lab and through extra topic pages only where real data justifies them.
- **Commits:** still none. Milestones stay logged in [PROGRESS.md](PROGRESS.md).
- **Start point:** continue from the existing recon, register, fixtures, seed and pages.
- **Priority order:** no-script public content (WUE-030), more regional/federal data sources, formal layout primitives and rhythm presets, then maps and bookings depth.
