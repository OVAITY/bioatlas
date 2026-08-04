# Contributing to The OVAITY BioAtlas

Contributions are welcome, particularly from scientists, educators, bioinformaticians, laboratory professionals and interdisciplinary learners.

## Before proposing a change

1. Search the existing entries before proposing a duplicate.
2. Use clear, concise and neutral definitions.
3. Prefer scientifically established terminology.
4. Provide a reliable source URL when the data model supports it.
5. Avoid promotional, institution-specific or clinical-advice wording.
6. Clearly distinguish a scientific concept from a laboratory or computational method.
7. Explain the proposed change and its scientific rationale in the pull request.

## Content source and generated files

The canonical content source is `OVAITY_Life_Science_Glossary.xlsx`:

- `Glossary` contains concept and terminology entries.
- `Methodologies` contains laboratory and computational methods.
- `Learning Path` defines the guided learning stages.
- `Sources` records supporting source information.

`hosted/public/data/data.js` is generated from that workbook. Update the workbook first, then regenerate the browser data:

```bash
cd hosted/scripts
python3 extract_data.py
```

The extraction script requires Python 3 and `openpyxl`. Review the generated diff before submitting it.

## Concept entries

Concept entries use a unique positive numeric `ID` and the following fields:

- `Term`, `Acronym`, `Domain`, `Level` and `Definition`
- `Why it matters`, `Example`, `Related concepts` and `Common confusion`
- `Priority`, `Status`, `Confidence (1-5)`, `Personal notes` and `Source URL`

`Term`, `Domain`, `Level`, `Definition`, `Priority` and `Status` should be present. Use one of the levels `Foundation`, `Core` or `Advanced`, and one of the priorities `Essential`, `Core` or `Optional`. Do not reuse an existing ID.

## Method entries

Method entries also use a unique positive numeric `ID`. Their structured fields include:

- `Methodology`, `Category`, `Level`, `Purpose` and `Typical inputs`
- `Simplified workflow`, `Typical outputs`, `Strengths` and `Limitations / risks`
- `Key QC checks`, `Common tools / platforms`, `When to learn`, `Priority`, `Status`, `Personal notes` and `Source URL`

Use the same allowed level and priority values as concept entries. `When to learn` should match an existing learning-stage label such as `Stage 2`.

## Video resources

Curated videos used by the application are stored in `hosted/public/data/videos.js`. Review information is stored in `hosted/data/video-review.json`; the local search checkpoint is intentionally ignored. A video should directly explain the concept or method, come from a credible educational or scientific source and avoid promotional or misleading framing.

## Preview and validation

Preview and validate the application with its packaged development workflow:

```bash
cd hosted
npm ci
npm run dev
npm run lint
npm test
npm run build
```

## Pull requests

Open a pull request that explains what changed, why it improves BioAtlas and which sources support content changes. Include screenshots only when the interface changes materially.

By contributing, you agree that submitted source code is licensed under Apache License 2.0 and submitted BioAtlas content is licensed under Creative Commons Attribution 4.0 International, as applicable.

## Scientific responsibility

BioAtlas is educational and informational. Contributions must not present the project as a substitute for professional, clinical, regulatory or laboratory guidance.
