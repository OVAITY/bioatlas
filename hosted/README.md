# BioAtlas packaged application

This directory contains the Next.js application for [The OVAITY BioAtlas](../README.md). It is configured for deployment on Vercel.

## Requirements

- Node.js `>=22.13.0`
- npm

## Commands

```bash
npm ci
npm run dev
npm run lint
npm test
npm run build
```

Set `DATABASE_URL` in `.env.local` (see `.env.example`). From the repository root, `docker compose up -d` starts Postgres with pgvector on port `5434`. Then run `npm run db:setup` before `npm run dev`.

Workbook import, model-atlas, and 3D-structure seed scripts live in `scripts/` with the SQL migrations in `drizzle/`. Video-review records remain in `data/`. The Structures page reads `data/structures/collections.json` when the database has not been seeded yet.
