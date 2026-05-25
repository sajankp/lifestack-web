---
name: development-workflow
description: Use when delivering a new feature or architectural change that needs spec-first execution, explicit approval gates, test-first implementation, full verification, and PR handoff.
---

# Development Workflow Agent

Use this agent for feature work and architectural changes.

## Applicability

- Frontend-focused in `lifestack-web`.
- For backend-heavy work, use the backend copy in `lifestack-api`.

## Quick Commands

```bash
git checkout -b feat/<name>
npm test -- --run
npm run build
npm run lint
gh pr create --base main --head <branch>
```

## 1-Minute Checklist

- Confirm approved spec exists before coding.
- Create branch and write/update tests first.
- Implement minimal scope per spec.
- Run full validation commands for this repo.
- Open PR and hand off with a clear validation summary.

## Scope

- Spec-first delivery
- Test-first implementation (Red-Green-Refactor mindset)
- Verification and PR preparation

## Core Flow

Spec -> Tests (failing/updated) -> Implement -> Verify -> PR

## Phase Guardrails

- Do not start implementation before spec approval.
- Do not request review before verification passes.
- Escalate when spec intent and implementation reality diverge.
- Keep frontend-only stack decisions in frontend docs/specs.

## Phases

1. Specification
- Create `docs/specs/NNN-*.md`
- Request explicit approval before coding
- Add ADR if architectural choice is non-obvious

2. Test-First (Red)
- Create feature branch
- Mark spec `Approved`
- Add failing or coverage-extending tests first
- Confirm tests enforce intended behavior

3. Implementation (Green)
- Implement minimum required behavior
- Follow approved spec exactly
- Pause for user decision if spec ambiguity appears

4. Verify and PR
- Run full frontend validation (`test`, `build`, `lint`)
- Mark spec `Implemented`
- Open PR and hand off to PR review workflow
- For review-thread cleanup during handoff:
  - `bash .agent/scripts/resolve-review-threads.sh --mode outdated --dry-run`
  - `bash .agent/scripts/resolve-review-threads.sh --mode outdated`

## Commit Prefixes

- `docs:` specs/ADR/docs
- `test:` failing or updated tests
- `feat:` feature implementation
- `refactor:` structure-only cleanup
- `fix:` bug fixes
- `chore:` tooling/config/CI/deps

## Handoff Template

```text
Implemented per spec <spec-id>.
Validation:
- npm test -- --run
- npm run build
- npm run lint
PR ready for /pr-review workflow.
```

## Troubleshooting

- Protected main blocks push:
  - Push feature branch and open PR.
- Flaky UI assertions:
  - Prefer role-based queries and explicit waits in tests.
- Pre-commit failure:
  - Fix hooks, recommit, and re-verify `git status`.

## Reference

Primary workflow doc: `../../workflows/development-workflow.md`
