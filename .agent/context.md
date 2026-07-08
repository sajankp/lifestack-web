# Lifestack Web — Agent Context

> This file is the canonical source of project conventions for AI coding agents.
> It is tool-agnostic. Entry-point files for specific tools (CLAUDE.md, AGENTS.md, etc.) reference or include this content.

## Project Overview

- React 19, TypeScript, Vite
- State management: Zustand
- HTTP client: Axios with interceptors
- Styling: Tailwind CSS + shadcn/ui components
- API validation: Zod schemas (all domain services parse responses)
- Package manager: npm

## Quick Commands

- Run dev server: `npm run dev`
- Run tests: `npm test -- --run`
- Run tests in watch mode: `npm test`
- Build production: `npm run build`
- Lint: `npm run lint`
- Create feature branch: `git checkout -b feat/<name>`
- Open PR: `gh pr create --base main --head <branch>`

## Commit Prefixes

Use these prefixes for all commits:

- `docs:` — specs, ADRs, documentation
- `test:` — new or updated tests
- `feat:` — feature implementation
- `refactor:` — structure-only cleanup (no behavior change)
- `fix:` — bug fixes
- `chore:` — tooling, config, CI, dependencies

## Development Workflow

Follow this sequence for all feature work:

1. **Specification** — Create `docs/specs/NNN-*.md`. Get explicit user approval before coding.
2. **Test-First (Red)** — Create feature branch. Add failing or coverage-extending tests first. Confirm they enforce the intended behavior.
3. **Implementation (Green)** — Implement the minimum required behavior. Follow the approved spec exactly. Pause if the spec is ambiguous.
4. **Verify** — Run full frontend validation (`test`, `build`, `lint`). Mark spec as `Implemented`.
5. **PR** — Open pull request and hand off with a validation summary.

### Phase guardrails

- Do NOT start implementation before spec approval.
- Do NOT request PR review before verification passes.
- Escalate when spec intent and implementation diverge.
- Keep frontend-only stack decisions in frontend docs/specs.

## PR Review Process

When processing pull requests:

1. List open PRs: `gh pr list --state open`
2. Fetch review comments: `bash .agent/scripts/fetch-review-comments.sh`
3. Triage each comment using the matrix below
4. Apply fixes and run tests locally
5. Reply to each thread explaining what changed
6. Resolve threads: `bash .agent/scripts/resolve-review-threads.sh --mode outdated --dry-run` then `bash .agent/scripts/resolve-review-threads.sh --mode outdated`
7. Request re-review

### Triage matrix

- **Accept**: bug fix, risk fix, spec-consistent, project-pattern consistent
- **Reject**: speculative preference, style-only churn, spec conflict
- **Discuss**: architecture-impacting, API contract change, cross-module tradeoff

### Comment templates

When replying to review threads:

```text
Addressed in <commit_sha>:
- <change 1>
- <change 2>
Validation:
- <test command>
```

When rejecting a suggestion:

```text
Not applying this suggestion because it conflicts with <spec/file>. Proposed alternative: <alternative>.
```

### Thread resolution scripts

```bash
# Resolve outdated threads (safe, do dry-run first):
bash .agent/scripts/resolve-review-threads.sh --mode outdated --dry-run
bash .agent/scripts/resolve-review-threads.sh --mode outdated

# Resolve a specific thread:
bash .agent/scripts/resolve-specific-threads.sh --thread <thread_id> --dry-run
bash .agent/scripts/resolve-specific-threads.sh --thread <thread_id>
```

## Testing checklist

Before marking any implementation as done:

- [ ] Tests updated for new behavior
- [ ] `npm test -- --run` passes
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] UI covers empty, loading, error, and success states where relevant

## Escalation triggers

Stop and ask the user when:

- Review feedback conflicts with the approved spec
- A fix requires architecture changes beyond the spec scope
- CI failures imply missing scope rather than a bug

## Handoff template

When handing off completed work:

```text
Implemented per spec <spec-id>.
Validation:
- npm test -- --run
- npm run build
- npm run lint
PR ready for review.
```

## Troubleshooting

- Protected main blocks push → Push feature branch and open PR instead
- Flaky UI assertions → Prefer role-based queries and explicit waits in tests
- Pre-commit failure → Fix hooks, recommit, re-verify with `git status`
