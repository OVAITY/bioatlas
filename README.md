# The OVAITY BioAtlas

> Explore the language of life science.

**BioAtlas is a free, open knowledge base for life science. It is not the OVAITY Scientific Intelligence Platform.**

BioAtlas helps people explore unfamiliar scientific fields, build foundational knowledge and understand how concepts, terminology and laboratory methods relate to one another.

**Looking for the Scientific Intelligence Platform?**

👉 [Join the OVAITY waitlist](https://www.ovaity.com/#waitlist)

## About

BioAtlas began as a structured learning resource for people entering life sciences from other disciplines. It is also intended for scientists, students, researchers, laboratory professionals and interdisciplinary teams who need a clear route into unfamiliar terminology and methods.

BioAtlas is developed by [OVAITY](https://www.ovaity.com). It can be explored freely; joining the OVAITY waitlist is not required to use it.

## Current scope

The collection covers biological concepts, scientific terminology, laboratory and computational methods, research disciplines and an eight-stage learning path. Counts displayed in the application are calculated from the current data rather than maintained separately in this README.

## Features

- Full-text search across concepts, methods and definitions
- Filters for entry type, knowledge level, priority, scientific domain and video availability
- Dedicated concept and methodology detail views
- Guided in-depth learning sessions
- Curated explanatory videos where suitable resources are available
- Responsive light and dark interfaces
- A clear handoff from the free BioAtlas resource to OVAITY's Scientific Intelligence Platform

## Repository structure

| Path | Purpose |
| --- | --- |
| `hosted/app/` | Next.js application shell, metadata and design system |
| `hosted/public/` | Browser assets and generated BioAtlas data |
| `hosted/data/` | Curated video-review records used by the enrichment workflow |
| `hosted/scripts/` | Workbook extraction and video-review utilities |
| `hosted/tests/` | Rendered application and CTA checks |
| `OVAITY_Life_Science_Glossary.xlsx` | Source workbook for BioAtlas content |

## Getting started

The application requires Node.js `>=22.13.0`, npm, and PostgreSQL 16 with pgvector. Docker Compose starts the database on host port `5434`.

```bash
docker compose up -d
cp hosted/.env.example hosted/.env.local
cd hosted
npm ci
npm run db:setup
npm run dev
```

`db:setup` applies migrations, imports the glossary workbook extract, and seeds the model atlas, intelligence events, and 3D structure portals. Use the local URL printed by the development server.

### Checks

Run the existing project checks from `hosted/`:

```bash
npm run lint
npm test
npm run build
```

## Adding or editing entries

BioAtlas content is stored in PostgreSQL. The Excel workbook remains the historical glossary source and is imported with `npm run db:import` from `hosted/`. After import, edit the database rather than regenerating `hosted/public/data/data.js` for the public site.

Entry fields, accepted values, identifier rules and the preview workflow are documented in [CONTRIBUTING.md](CONTRIBUTING.md).

## Scientific accuracy

BioAtlas is an educational and informational resource. Although contributions should be grounded in reliable scientific sources, its content may contain errors or become outdated. It is not a substitute for professional, clinical, regulatory or laboratory guidance.

## From knowledge to scientific work

BioAtlas helps people explore and understand the language of life science. OVAITY is building the Scientific Intelligence Platform that helps research teams connect their projects, experiments, data, analyses and decisions.

[Join the OVAITY waitlist](https://www.ovaity.com/#waitlist)

## Licensing

This repository uses two licences:

- Source code is licensed under the [Apache License 2.0](LICENSE).
- Original BioAtlas glossary, methodology and learning-path content is licensed under [Creative Commons Attribution 4.0 International](LICENSE-CONTENT.md).

Third-party linked resources remain subject to their respective owners' terms. OVAITY and BioAtlas names, logos and other brand identifiers are not licensed for reuse except as necessary for attribution or permitted by applicable law. See [NOTICE](NOTICE) for attribution details.

## Contributing

Contributions are welcome, particularly from scientists, educators, bioinformaticians, laboratory professionals and interdisciplinary learners. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.
