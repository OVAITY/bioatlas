import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(root, file);
    if (!existsSync(fullPath)) continue;
    for (const line of readFileSync(fullPath, "utf8").split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    }
  }
}

loadEnv();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 1 });

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function findByName(type, name) {
  const rows = await sql`
    SELECT id FROM entities
    WHERE entity_type = ${type} AND lower(name) = ${name.toLowerCase()}
    LIMIT 1
  `;
  return rows[0]?.id || null;
}

async function ensureEntity(row) {
  const existing = await findByName(row.entityType, row.name);
  if (existing) return existing;
  const [entity] = await sql`
    INSERT INTO entities (
      entity_type, slug, name, summary, status, visibility,
      published_at, created_by, updated_by
    ) VALUES (
      ${row.entityType}, ${row.slug || slugify(row.name)}, ${row.name}, ${row.summary},
      'published', 'public', now(), 'seed', 'seed'
    )
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `;
  return entity.id;
}

async function relate(fromId, toId, type) {
  if (!fromId || !toId || fromId === toId) return;
  await sql`
    INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, status)
    VALUES (${fromId}, ${toId}, ${type}, 'published')
    ON CONFLICT (from_entity_id, to_entity_id, relation_type) DO NOTHING
  `;
}

async function addExternalId(entityId, scheme, value) {
  await sql`
    INSERT INTO entity_external_ids (entity_id, scheme, value)
    VALUES (${entityId}, ${scheme}, ${value})
    ON CONFLICT (scheme, value) DO NOTHING
  `;
}

try {
  const orgs = [
    {
      name: "Google DeepMind",
      summary: "Research lab that developed AlphaFold and other scientific machine-learning systems.",
      orgKind: "company",
      website: "https://deepmind.google/",
    },
    {
      name: "Meta FAIR",
      summary: "Fundamental AI research group that released the ESM protein language models.",
      orgKind: "lab",
      website: "https://ai.meta.com/research/",
    },
    {
      name: "EvolutionaryScale",
      summary: "Company developing frontier protein generative models, including ESM3.",
      orgKind: "company",
      website: "https://www.evolutionaryscale.ai/",
    },
    {
      name: "Microsoft Research",
      summary: "Research organization that published BioGPT and other biomedical language models.",
      orgKind: "lab",
      website: "https://www.microsoft.com/en-us/research/",
    },
    {
      name: "Institute for Protein Design",
      summary: "University of Washington institute that developed RFdiffusion and related protein-design methods.",
      orgKind: "academic",
      website: "https://www.ipd.uw.edu/",
    },
    {
      name: "Arc Institute",
      summary: "Nonprofit scientific research organization developing virtual cell and genomic models, including Evo 2.",
      orgKind: "nonprofit",
      website: "https://arcinstitute.org/",
    },
  ];

  const orgIds = {};
  for (const org of orgs) {
    const id = await ensureEntity({
      entityType: "organization",
      name: org.name,
      summary: org.summary,
      slug: slugify(org.name),
    });
    await sql`
      INSERT INTO organizations (entity_id, org_kind, website)
      VALUES (${id}, ${org.orgKind}, ${org.website})
      ON CONFLICT (entity_id) DO UPDATE SET website = EXCLUDED.website
    `;
    orgIds[org.name] = id;
  }

  const datasets = [
    {
      name: "PDB",
      summary: "The Protein Data Bank, the global archive of experimentally determined macromolecular structures.",
      accessUrl: "https://www.wwpdb.org/",
    },
    {
      name: "UniProt",
      summary: "Comprehensive protein sequence and function resource used to train many protein models.",
      accessUrl: "https://www.uniprot.org/",
    },
    {
      name: "PubMed",
      summary: "Biomedical literature corpus often used to train scientific language models.",
      accessUrl: "https://pubmed.ncbi.nlm.nih.gov/",
    },
  ];
  const datasetIds = {};
  for (const dataset of datasets) {
    const id = await ensureEntity({
      entityType: "dataset",
      name: dataset.name,
      summary: dataset.summary,
      slug: slugify(dataset.name),
    });
    await sql`
      INSERT INTO datasets (entity_id, access_url)
      VALUES (${id}, ${dataset.accessUrl})
      ON CONFLICT (entity_id) DO UPDATE SET access_url = EXCLUDED.access_url
    `;
    datasetIds[dataset.name] = id;
  }

  const useCaseRows = [
    { name: "Protein structure prediction", description: "Infer 3D structure from amino-acid sequence." },
    { name: "Protein design", description: "Generate sequences or backbones with desired functions." },
    { name: "Biomedical literature understanding", description: "Answer questions and extract facts from scientific text." },
    { name: "Single-cell representation learning", description: "Learn cell-state embeddings from transcriptomic profiles." },
  ];
  const useCaseIds = {};
  for (const useCase of useCaseRows) {
    const id = await ensureEntity({
      entityType: "use_case",
      name: useCase.name,
      summary: useCase.description,
      slug: slugify(useCase.name),
    });
    await sql`
      INSERT INTO use_cases (entity_id, description)
      VALUES (${id}, ${useCase.description})
      ON CONFLICT (entity_id) DO UPDATE SET description = EXCLUDED.description
    `;
    useCaseIds[useCase.name] = id;
  }

  const publications = [
    {
      name: "Highly accurate protein structure prediction with AlphaFold",
      venue: "Nature",
      publishedOn: "2021-07-15",
      doi: "10.1038/s41586-021-03819-2",
    },
    {
      name: "Evolutionary-scale prediction of atomic-level protein structure with a language model",
      venue: "Science",
      publishedOn: "2023-03-16",
      doi: "10.1126/science.ade2574",
    },
    {
      name: "Accurate structure prediction of biomolecular interactions with AlphaFold 3",
      venue: "Nature",
      publishedOn: "2024-05-08",
      doi: "10.1038/s41586-024-07487-w",
    },
    {
      name: "BioGPT: generative pre-trained transformer for biomedical text generation and mining",
      venue: "Briefings in Bioinformatics",
      publishedOn: "2022-09-14",
      doi: "10.1093/bib/bbac409",
    },
    {
      name: "De novo design of protein structure and function with RFdiffusion",
      venue: "Nature",
      publishedOn: "2023-07-11",
      doi: "10.1038/s41586-023-06415-8",
    },
  ];
  const publicationIds = {};
  for (const paper of publications) {
    const id = await ensureEntity({
      entityType: "publication",
      name: paper.name,
      summary: `${paper.venue} (${paper.publishedOn.slice(0, 4)}).`,
      slug: slugify(paper.name),
    });
    await sql`
      INSERT INTO publications (entity_id, publication_type, published_on, venue, doi)
      VALUES (${id}, 'journal', ${paper.publishedOn}, ${paper.venue}, ${paper.doi})
      ON CONFLICT (entity_id) DO UPDATE SET doi = EXCLUDED.doi
    `;
    await addExternalId(id, "doi", paper.doi);
    publicationIds[paper.name] = id;
  }

  const models = [
    {
      name: "AlphaFold 2",
      summary: "Deep-learning system for predicting protein 3D structure from sequence.",
      releaseDate: "2021-07-15",
      category: "protein structure",
      architecture: "Evoformer + structure module",
      openness: "open",
      license: "Apache-2.0 / CC BY 4.0 for predictions",
      inputs: ["protein sequence"],
      outputs: ["3D structure", "confidence"],
      githubUrl: "https://github.com/google-deepmind/alphafold",
      org: "Google DeepMind",
      paper: "Highly accurate protein structure prediction with AlphaFold",
      datasets: ["PDB"],
      useCases: ["Protein structure prediction"],
      concepts: ["Protein", "Proteomics"],
      domain: "Proteins & Proteomics",
    },
    {
      name: "ESM-2",
      summary: "Protein language model trained at evolutionary scale; the basis for ESMFold.",
      releaseDate: "2022-07-21",
      category: "protein language model",
      architecture: "Transformer language model",
      openness: "open",
      license: "MIT",
      inputs: ["protein sequence"],
      outputs: ["embeddings", "structure prediction"],
      githubUrl: "https://github.com/facebookresearch/esm",
      org: "Meta FAIR",
      paper: "Evolutionary-scale prediction of atomic-level protein structure with a language model",
      datasets: ["UniProt"],
      useCases: ["Protein structure prediction"],
      concepts: ["Protein"],
      domain: "Proteins & Proteomics",
    },
    {
      name: "AlphaFold 3",
      summary: "Next-generation biomolecular structure model that predicts complexes including proteins, nucleic acids and ligands.",
      releaseDate: "2024-05-08",
      category: "multimodal biomolecular structure",
      architecture: "Pairformer + diffusion module",
      openness: "closed",
      license: "Restricted server access",
      inputs: ["protein sequence", "DNA", "RNA", "ligand"],
      outputs: ["complex structure"],
      modelUrl: "https://alphafoldserver.com/",
      org: "Google DeepMind",
      paper: "Accurate structure prediction of biomolecular interactions with AlphaFold 3",
      datasets: ["PDB"],
      useCases: ["Protein structure prediction"],
      concepts: ["Protein"],
      domain: "Proteins & Proteomics",
      predecessor: "AlphaFold 2",
    },
    {
      name: "ESM3",
      summary: "Generative protein model that reasons over sequence, structure and function.",
      releaseDate: "2024-06-25",
      category: "protein generative model",
      architecture: "Multimodal generative transformer",
      openness: "dual",
      license: "Open weights for smaller variants; API for frontier model",
      inputs: ["protein sequence", "structure tokens", "function tokens"],
      outputs: ["sequence", "structure", "function"],
      githubUrl: "https://github.com/evolutionaryscale/esm",
      org: "EvolutionaryScale",
      datasets: ["UniProt", "PDB"],
      useCases: ["Protein design"],
      concepts: ["Protein"],
      domain: "Proteins & Proteomics",
    },
    {
      name: "BioGPT",
      summary: "Generative transformer pretrained on biomedical literature.",
      releaseDate: "2022-09-14",
      category: "biomedical LLM",
      architecture: "GPT-style transformer",
      openness: "open",
      license: "MIT",
      inputs: ["text"],
      outputs: ["text"],
      githubUrl: "https://github.com/microsoft/BioGPT",
      org: "Microsoft Research",
      paper: "BioGPT: generative pre-trained transformer for biomedical text generation and mining",
      datasets: ["PubMed"],
      useCases: ["Biomedical literature understanding"],
      domain: "AI & Computational Research",
    },
    {
      name: "RFdiffusion",
      summary: "Diffusion model for de novo protein backbone generation conditioned on functional motifs.",
      releaseDate: "2023-07-11",
      category: "protein design",
      architecture: "RoseTTAFold-based diffusion",
      openness: "open",
      license: "BSD",
      inputs: ["motifs", "constraints"],
      outputs: ["protein backbone"],
      githubUrl: "https://github.com/RosettaCommons/RFdiffusion",
      org: "Institute for Protein Design",
      paper: "De novo design of protein structure and function with RFdiffusion",
      datasets: ["PDB"],
      useCases: ["Protein design"],
      concepts: ["Protein"],
      domain: "Proteins & Proteomics",
    },
    {
      name: "Evo 2",
      summary: "Biological foundation model for DNA, RNA and protein sequence modeling at long context.",
      releaseDate: "2025-02-19",
      category: "genomic foundation model",
      architecture: "StripedHyena 2",
      openness: "open",
      license: "Apache-2.0",
      inputs: ["DNA", "RNA", "protein sequence"],
      outputs: ["sequence", "embeddings"],
      githubUrl: "https://github.com/ArcInstitute/evo2",
      org: "Arc Institute",
      useCases: ["Biomedical literature understanding"],
      domain: "AI & Computational Research",
    },
  ];

  const modelIds = {};
  for (const model of models) {
    const id = await ensureEntity({
      entityType: "model",
      name: model.name,
      summary: model.summary,
      slug: slugify(model.name),
    });
    await sql`
      INSERT INTO models (
        entity_id, release_date, model_category, architecture, openness, license,
        input_modalities, output_modalities, github_url, model_url
      ) VALUES (
        ${id}, ${model.releaseDate}, ${model.category}, ${model.architecture},
        ${model.openness}, ${model.license}, ${model.inputs}, ${model.outputs},
        ${model.githubUrl || null}, ${model.modelUrl || null}
      )
      ON CONFLICT (entity_id) DO UPDATE SET
        model_category = EXCLUDED.model_category,
        architecture = EXCLUDED.architecture
    `;
    modelIds[model.name] = id;
    await relate(id, orgIds[model.org], "developed_by");
    if (model.paper) await relate(id, publicationIds[model.paper], "described_in");
    for (const datasetName of model.datasets || []) {
      await relate(id, datasetIds[datasetName], "trained_on");
    }
    for (const useCaseName of model.useCases || []) {
      await relate(id, useCaseIds[useCaseName], "enables");
    }
    for (const conceptName of model.concepts || []) {
      const conceptId = await findByName("concept", conceptName);
      if (conceptId) await relate(id, conceptId, "related_to");
    }
    if (model.domain) {
      const domainId = await findByName("biological_domain", model.domain);
      if (domainId) await relate(id, domainId, "addresses");
    }
  }

  await relate(modelIds["AlphaFold 3"], modelIds["AlphaFold 2"], "successor_of");

  await sql`
    INSERT INTO model_benchmarks (model_id, name, metric, score, dataset_id)
    VALUES
      (${modelIds["AlphaFold 2"]}, 'CASP14', 'GDT_TS', 'state-of-the-art (2020)', ${datasetIds.PDB}),
      (${modelIds["ESM-2"]}, 'CASP14 / CAMEO', 'TM-score', 'competitive with AlphaFold2 on many single chains', ${datasetIds.PDB})
    ON CONFLICT DO NOTHING
  `;

  const events = [
    {
      name: "AlphaFold 2 published and open-sourced",
      summary: "DeepMind published AlphaFold 2 in Nature and released code and predictions.",
      eventType: "model_release",
      occurredOn: "2021-07-15",
      involves: ["AlphaFold 2", "Google DeepMind"],
    },
    {
      name: "AlphaFold 3 paper",
      summary: "AlphaFold 3 extended structure prediction to complexes of proteins, nucleic acids and ligands.",
      eventType: "paper",
      occurredOn: "2024-05-08",
      involves: ["AlphaFold 3", "Google DeepMind"],
    },
    {
      name: "ESM3 announced by EvolutionaryScale",
      summary: "EvolutionaryScale introduced ESM3, a generative model over protein sequence, structure and function.",
      eventType: "launch",
      occurredOn: "2024-06-25",
      involves: ["ESM3", "EvolutionaryScale"],
    },
  ];

  for (const event of events) {
    const id = await ensureEntity({
      entityType: "event",
      name: event.name,
      summary: event.summary,
      slug: slugify(event.name),
    });
    await sql`
      INSERT INTO events (entity_id, event_type, occurred_on, body)
      VALUES (${id}, ${event.eventType}, ${event.occurredOn}, ${event.summary})
      ON CONFLICT (entity_id) DO UPDATE SET event_type = EXCLUDED.event_type
    `;
    for (const involved of event.involves) {
      const target =
        modelIds[involved] ||
        orgIds[involved] ||
        (await findByName("organization", involved)) ||
        (await findByName("model", involved));
      await relate(id, target, "involves");
    }
  }

  console.log("seeded model atlas and intelligence events");
} finally {
  await sql.end();
}
