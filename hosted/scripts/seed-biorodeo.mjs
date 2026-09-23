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

function opennessFromScore(score) {
  if (score >= 80) return "open";
  if (score >= 40) return "dual";
  return "closed";
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
      'published', 'public', now(), 'biorodeo', 'biorodeo'
    )
    ON CONFLICT (slug) DO UPDATE SET
      summary = coalesce(entities.summary, EXCLUDED.summary),
      updated_by = 'biorodeo'
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

async function cite(entityId, sourceId) {
  await sql`
    INSERT INTO entity_sources (entity_id, source_id, role)
    VALUES (${entityId}, ${sourceId}, 'supporting')
    ON CONFLICT DO NOTHING
  `;
}

try {
  await sql`
    INSERT INTO relation_types (id, inverse_id, description) VALUES
      ('available_on', NULL, 'Source can be run or downloaded from target'),
      ('hosts', 'available_on', 'Source hosts or serves target')
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`UPDATE relation_types SET inverse_id = 'hosts' WHERE id = 'available_on'`;

  const sourceId = await ensureEntity({
    entityType: "source",
    name: "bio.rodeo",
    slug: "bio-rodeo",
    summary: "Opinionated catalogue of biological foundation models, ranked and scored for openness by Pulsatance. 2,500+ models, refreshed weekly.",
  });
  await sql`
    INSERT INTO sources (entity_id, source_kind, url, title, reliability)
    VALUES (${sourceId}, 'url', 'https://bio.rodeo/', 'bio.rodeo — The Analyst for Bio AI', 'secondary')
    ON CONFLICT (entity_id) DO UPDATE SET url = EXCLUDED.url, title = EXCLUDED.title
  `;
  await addExternalId(sourceId, "url", "https://bio.rodeo/");

  const providers = [
    {
      name: "Hugging Face",
      slug: "hugging-face",
      summary: "Open repository for protein, DNA, RNA, single-cell and pathology foundation-model weights, with managed inference endpoints. 262 models listed on bio.rodeo.",
      website: "https://huggingface.co/",
      page: "https://bio.rodeo/providers/hugging-face",
      count: 262,
    },
    {
      name: "Zenodo",
      slug: "zenodo",
      summary: "CERN-hosted open research archive used to deposit biological foundation-model weights. 23 models listed on bio.rodeo.",
      website: "https://zenodo.org/",
      page: "https://bio.rodeo/providers/zenodo",
      count: 23,
    },
    {
      name: "NVIDIA BioNeMo / NIM",
      slug: "nvidia-bionemo-nim",
      summary: "GPU-accelerated inference for structure prediction, protein design, docking and genomics, as hosted endpoints or self-hosted microservices. 18 models listed on bio.rodeo.",
      website: "https://www.nvidia.com/en-us/clara/bionemo/",
      page: "https://bio.rodeo/providers/nvidia-bionemo-nim",
      count: 18,
    },
    {
      name: "Benchling Model Hub",
      slug: "benchling-model-hub",
      summary: "Managed structure prediction on registry data inside the electronic lab notebook, or from a standalone benchling.ai account. 14 models listed on bio.rodeo.",
      website: "https://www.benchling.com/",
      page: "https://bio.rodeo/providers/benchling-model-hub",
      count: 14,
    },
    {
      name: "Amazon Web Services",
      slug: "amazon-web-services",
      summary: "AWS Marketplace and SageMaker JumpStart deploy biological foundation models onto managed endpoints in the subscriber's own account. 11 models listed on bio.rodeo.",
      website: "https://aws.amazon.com/marketplace/",
      page: "https://bio.rodeo/providers/amazon-web-services",
      count: 11,
    },
    {
      name: "Scigantic",
      slug: "scigantic",
      summary: "Managed notebooks for fine-tuning open protein, DNA and molecule models from labelled sequence data, with linked cloud storage. 11 models listed on bio.rodeo.",
      website: "https://www.scigantic.com/",
      page: "https://bio.rodeo/providers/scigantic",
      count: 11,
    },
    {
      name: "Google Cloud Model Garden",
      slug: "google-cloud-model-garden",
      summary: "Managed cloud endpoints for deploying and fine-tuning biological foundation models, billed per token or per node-hour. 8 models listed on bio.rodeo.",
      website: "https://cloud.google.com/model-garden",
      page: "https://bio.rodeo/providers/google-cloud-model-garden",
      count: 8,
    },
  ];

  const providerIds = {};
  for (const provider of providers) {
    const id = await ensureEntity({
      entityType: "tool",
      name: provider.name,
      slug: provider.slug,
      summary: provider.summary,
    });
    await sql`
      INSERT INTO tools (entity_id, tool_kind, website)
      VALUES (${id}, 'platform', ${provider.website})
      ON CONFLICT (entity_id) DO UPDATE SET website = EXCLUDED.website, tool_kind = 'platform'
    `;
    await addExternalId(id, "biorodeo_provider", provider.slug);
    await cite(id, sourceId);
    providerIds[provider.name] = id;
  }

  const models = [
    {
      name: "scKITE",
      slug: "sckite",
      org: "China Agricultural University",
      orgKind: "academic",
      releaseDate: "2026-09-14",
      category: "single-cell",
      summary: "Single-cell foundation model pretrained with cell-annotation and gene-regulon supervision on 179,067 profiles, then transferred as a frozen encoder.",
      openness: opennessFromScore(38),
      score: 38,
      page: "https://bio.rodeo/models/sckite",
    },
    {
      name: "ABCP_finder",
      slug: "abcp-finder",
      org: "Indian Institute of Information Technology Allahabad",
      orgKind: "academic",
      releaseDate: "2026-09-13",
      category: "protein",
      summary: "Anticancer peptide prediction specialized to breast cancer, running an MLP head over frozen ProtBERT embeddings of short peptide sequences.",
      openness: opennessFromScore(50),
      score: 50,
      page: "https://bio.rodeo/models/abcp-finder",
    },
    {
      name: "OmniTCR",
      slug: "omnitcr",
      org: "West China Hospital of Sichuan University",
      orgKind: "academic",
      releaseDate: "2026-09-13",
      category: "protein language model",
      summary: "T cell receptor foundation model that scores peptide-MHC-TCR recognition and generates pMHC-conditioned CDR3β candidates from one shared backbone.",
      openness: opennessFromScore(36),
      score: 36,
      page: "https://bio.rodeo/models/omnitcr",
    },
    {
      name: "PANDA",
      slug: "panda-protein-design",
      org: "Tianjin Institute of Industrial Biotechnology",
      orgKind: "academic",
      releaseDate: "2026-09-13",
      category: "protein design",
      summary: "All-atom de novo protein design that denoises sequence and structure as a single Cartesian process, reading residue identity from atomic occupancy.",
      openness: "closed",
      page: "https://bio.rodeo/models/panda",
    },
    {
      name: "ShEPhERD-2",
      slug: "shepherd-2",
      org: "MIT",
      orgKind: "academic",
      releaseDate: "2026-09-12",
      category: "small molecule",
      summary: "3D small-molecule generation conditioned on an interaction profile of shape, electrostatics and directional pharmacophores rather than a pocket.",
      openness: opennessFromScore(93),
      score: 93,
      page: "https://bio.rodeo/models/shepherd-2",
    },
    {
      name: "MANAS-2",
      slug: "manas-2",
      org: "Mannas AI",
      orgKind: "company",
      releaseDate: "2026-09-12",
      category: "biosignals",
      summary: "EEG foundation model whose masked autoencoder adds an RMS-energy constraint on the decoder, sharpening spectral structure in frozen latents.",
      openness: opennessFromScore(19),
      score: 19,
      page: "https://bio.rodeo/models/manas-2",
    },
    {
      name: "Plasma Protein-Token Transformer",
      slug: "plasma-protein-token-transformer",
      org: "University of Pennsylvania",
      orgKind: "academic",
      releaseDate: "2026-09-12",
      category: "proteomics",
      summary: "Plasma proteomics foundation model for prospective disease risk prediction across 144 diseases. Unmeasured proteins are omitted rather than imputed.",
      openness: "closed",
      page: "https://bio.rodeo/models/plasma-protein-token-transformer",
    },
    {
      name: "GenEHR",
      slug: "genehr",
      org: "Harvard Medical School",
      orgKind: "academic",
      releaseDate: "2026-09-11",
      category: "biomedical LLM",
      summary: "Generative EHR foundation model that forecasts which clinical events come next and when, then adapts to pan-cancer risk stratification.",
      openness: "closed",
      page: "https://bio.rodeo/models/genehr",
    },
    {
      name: "Fluxion",
      slug: "fluxion",
      org: "Aithyra",
      orgKind: "lab",
      releaseDate: "2026-09-11",
      category: "protein / small molecule",
      summary: "Enzyme reaction mechanism generation from sequence, catalytic residues and substrate SMILES, sampling multi-step electron-flow trajectories.",
      openness: opennessFromScore(31),
      score: 31,
      page: "https://bio.rodeo/models/fluxion",
    },
    {
      name: "DNT",
      slug: "dnt",
      org: "Sheba Medical Center",
      orgKind: "academic",
      releaseDate: "2026-09-11",
      category: "genomic foundation model",
      summary: "Diploid genomic language model that writes both homologues as one token stream, so zygosity, allele dosage and cis-trans phase reach the encoder.",
      openness: "closed",
      page: "https://bio.rodeo/models/dnt",
    },
  ];

  for (const model of models) {
    const orgId = await ensureEntity({
      entityType: "organization",
      name: model.org,
      slug: slugify(model.org),
      summary: `${model.org} is listed on bio.rodeo as a developer of ${model.name}.`,
    });
    await sql`
      INSERT INTO organizations (entity_id, org_kind)
      VALUES (${orgId}, ${model.orgKind})
      ON CONFLICT (entity_id) DO NOTHING
    `;
    await cite(orgId, sourceId);

    const id = await ensureEntity({
      entityType: "model",
      name: model.name,
      slug: model.slug,
      summary: model.summary,
    });
    await sql`
      INSERT INTO models (
        entity_id, release_date, model_category, openness, model_url, card
      ) VALUES (
        ${id}, ${model.releaseDate}, ${model.category}, ${model.openness}, ${model.page},
        ${sql.json({ source: "bio.rodeo", openness_score: model.score || null, catalog_url: model.page })}
      )
      ON CONFLICT (entity_id) DO UPDATE SET
        release_date = EXCLUDED.release_date,
        model_category = EXCLUDED.model_category,
        openness = EXCLUDED.openness,
        model_url = EXCLUDED.model_url,
        card = EXCLUDED.card
    `;
    await addExternalId(id, "biorodeo_model", model.slug);
    await relate(id, orgId, "developed_by");
    await cite(id, sourceId);
  }

  const hostedOnHuggingFace = ["ESM-2", "ESM3", "BioGPT", "Evo 2"];
  for (const name of hostedOnHuggingFace) {
    const modelId = await findByName("model", name);
    if (modelId && providerIds["Hugging Face"]) {
      await relate(modelId, providerIds["Hugging Face"], "available_on");
      await cite(modelId, sourceId);
    }
  }

  const nvidiaModels = ["AlphaFold 2", "RFdiffusion"];
  for (const name of nvidiaModels) {
    const modelId = await findByName("model", name);
    if (modelId && providerIds["NVIDIA BioNeMo / NIM"]) {
      await relate(modelId, providerIds["NVIDIA BioNeMo / NIM"], "available_on");
    }
  }

  console.log(`seeded ${models.length} bio.rodeo models and ${providers.length} run providers`);
} finally {
  await sql.end();
}
