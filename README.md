# blockbench

Not-Notion :)

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in real Postgres connection strings:

```bash
cp .env.example .env
```

You need both variables:

- `DATABASE_URL`: the pooled/runtime connection string
- `DIRECT_URL`: the direct connection string for Prisma migrations

The scaffold docs assume Supabase, but any reachable PostgreSQL instance should work if you provide valid URLs.

3. Create the schema:

```bash
npx prisma migrate dev --name init
```

4. Seed demo data:

```bash
npx prisma db seed
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes

- `npm run dev` uses webpack by default. In this repo, Turbopack currently fails to load the generated Prisma client during development.
- `npm install` now runs `prisma generate` automatically via `postinstall`.
- If the homepage fails with `ECONNREFUSED`, your database URL is missing or the database is not reachable.
