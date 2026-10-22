# Phase 7 — Automated quality checks

The repository now has a required quality workflow at `.github/workflows/quality.yml`.

It runs for every push and pull request and performs these checks:

- starts a disposable MariaDB service;
- applies all Prisma migrations;
- verifies the migrated database through a real Prisma connection;
- runs the API unit and authorization/circulation contract tests;
- builds the frontend and API for production;
- installs Chromium and runs the frontend Playwright smoke test;
- starts the API and checks its health endpoint.

Run the same checks locally with:

```bash
pnpm install
pnpm --dir server install
pnpm --dir server prisma:generate
pnpm --dir server test
pnpm build
pnpm --dir server build
pnpm exec playwright install chromium
pnpm e2e
```

Deployment environments should require the `quality` job to pass before deployment. Branch protection or the deployment platform's required-check setting must be enabled in the repository settings; the workflow itself cannot enable that repository policy.
