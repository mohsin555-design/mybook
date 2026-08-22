# Agent Instructions

These instructions apply to the whole repository.

## Branches

- Do not always use a `codex/` branch prefix.
- Choose a branch name that describes the work:
  - `feature/...` for new user-facing functionality.
  - `fix/...` for bug fixes.
  - `docs/...` for documentation-only changes.
  - `chore/...` for maintenance, tooling, or cleanup.
  - `test/...` for test-only work.
- Keep branch names short, lowercase, and hyphen-separated.
- Before creating a branch, check the current branch and working tree state.

## Working Tree Safety

- Do not overwrite, revert, or delete changes made by the user unless explicitly asked.
- If unrelated files are already modified, leave them alone.
- Keep edits scoped to the requested task.
- Avoid broad formatting or refactors unless they are necessary for the change.

## Project Style

- Follow the existing React, TypeScript, Vite, and Tailwind patterns in this repo.
- Prefer existing components, helpers, and conventions before adding new abstractions.
- Do not add dependencies unless they are clearly needed.
- If a dependency is added, explain why it is needed.

## Vercel-Safe Checks

Before saying work is complete, run the checks that match the change. For normal code changes, prefer:

```sh
npm run lint
npm run typecheck
npm test -- --run
npm run build
```

For production-readiness, use:

```sh
npm run build:production
```

If any check fails, fix the issue before finishing. If a failure cannot be fixed in the current task, clearly report the failing command and the reason.

## Tests

- Add or update tests when behavior changes.
- Keep tests focused on the changed behavior.
- Do not remove tests to make checks pass unless the user explicitly asks and the reason is documented.

## Environment And Secrets

- Do not commit secrets, API keys, tokens, or local-only credentials.
- Use environment variables for configuration that differs between local and Vercel.
- Document any new required environment variable.

## Final Response

When finishing a task, include:

- A short summary of what changed.
- The checks that were run.
- Any known risks, skipped checks, or follow-up needed.
