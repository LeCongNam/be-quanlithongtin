# Prisma query rule

- Use `Prisma.$queryRaw` for database queries throughout the project.
- Do not use Prisma model delegate methods such as `findMany`, `findUnique`, `create`, `update`, or `delete`.
- Keep raw SQL parameterized with tagged-template interpolations; do not concatenate user input into SQL.
