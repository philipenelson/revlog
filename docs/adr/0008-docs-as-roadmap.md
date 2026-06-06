# Markdown docs as the project roadmap and spec system

## Status

accepted

## Decision

Track all features, specs, and milestones as Markdown files in `docs/` rather than using a dedicated issue tracker (Linear, GitHub Issues, Jira, Notion).

```
docs/
├── adr/          ← one file per architecture decision
├── specs/        ← one subfolder per feature area; one file per feature
│   └── auth/
│       └── login.md
└── milestones/   ← one file per release (v1.md, v2.md, …)
```

## Rules

- Every architecture or stack decision requires an ADR before implementation.
- Every feature requires a spec with use cases and acceptance criteria before implementation.
- Every use case must appear in at least one milestone file.
- A use case may appear in multiple milestones when it is being iterated (e.g. basic version in V1, enhanced version in V2).
- A feature is not done until its acceptance criteria checklist is fully checked off and automated tests exist.

## Reasons

- **Portfolio project** — keeping everything in the repository makes the decision-making process visible to anyone reading the codebase, which is the primary audience.
- **No external dependency** — no account, no subscription, no migration if the tool changes pricing.
- **Co-located with code** — specs and ADRs are versioned alongside the implementation they describe; they drift less than external tools.
- **Simple enough** — for a solo or small-team project, a flat checklist in a Markdown file is faster to update than a ticket tracker.

## Trade-offs accepted

- No assignment, due dates, or status workflows beyond the `[ ]` / `[~]` / `[x]` convention.
- No notifications or integrations with CI/CD.
- Searching across milestones requires `grep` or editor search rather than a query interface.

## V2 consideration

If the project grows to involve multiple contributors or requires integration with CI (e.g. auto-closing items on merge), evaluate migrating milestones to GitHub Issues while keeping ADRs and specs as Markdown files in the repo.
