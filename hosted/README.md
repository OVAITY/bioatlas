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

The application currently requires no environment variables. See the repository-root `.env.example` for the safe placeholder policy.

Content extraction and video-review utilities live in `scripts/`; their review records live in `data/`, while browser-consumed data is written to `public/data/`.
