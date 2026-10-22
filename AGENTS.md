# Library System v2

React + Vite + Tailwind frontend with a separate TypeScript/Prisma API and MariaDB database.

## Development

- Start the API with `pnpm --dir server dev`.
- Start the frontend with `pnpm dev`; the default Vite port is `5173`.
- Run `pnpm build` for a production frontend build and `pnpm --dir server build` for the API.

## Project structure

- `src/` contains the React frontend.
- `server/` contains the TypeScript API, Prisma schema, migrations, and snapshot importer.
- `docs/` contains architecture and migration documentation.

## Code quality

- Use Tailwind utility classes for frontend styling.
- Export React components as default exports.
- Keep all new database changes in versioned Prisma migrations.
