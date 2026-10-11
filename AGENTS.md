# Database query rule

- The project does not use an ORM: query MySQL through `DbService` (`src/database/db.service.ts`, driver `mysql2`) with plain SQL.
- Use `db.query`/`db.queryOne` for SELECT, `db.execute`/`db.executeOne` for INSERT/UPDATE/DELETE, `db.call('sp_...', [...])` for stored procedures, `db.transaction`/`db.procTransaction` for transactions.
- Keep raw SQL parameterized (`?` placeholders or the `sql` tagged template); do not concatenate user input into SQL. `raw()` is only for whitelisted column names.
- See `CLAUDE.md` for details.
