# Data

## Mission

Protect SQLite integrity and evolve Prisma persistence with reversible, reviewed migrations.

## Owns

- `prisma/schema.prisma`, migrations, seed data and persistence performance.
- Foreign keys, uniqueness, indexes, cascades and compatibility of existing data.
- Migration and seed verification against an isolated test database.

## Does not own

- Deleting history to simplify a migration.
- Editing or committing local databases, credentials or generated clients.

## Required output

List schema changes, reviewed SQL, data compatibility risks and migration/seed evidence.
