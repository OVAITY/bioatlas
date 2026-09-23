import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(path.join(root, file), "utf8");
      for (const line of text.split("\n")) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
        }
      }
    } catch {
      // optional env file
    }
  }
}

loadEnv();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const catalogue = JSON.parse(readFileSync(path.join(root, "data/structures/collections.json"), "utf8"));
const sql = postgres(databaseUrl, { max: 1 });

const SCALE_REMAP = {
  Brains: "Organs",
  "Human body": "Organisms",
  Development: "Organisms",
  Specimens: "Organisms",
  "Shared viewers": "Organisms",
  "Imaging volumes": "Organs",
};

const MODEL_LINKS = {
  "rcsb-pdb": ["alphafold-3", "alphafold-2", "esmfold", "boltz-1", "chai-1", "rfdiffusion"],
  pdbe: ["alphafold-3", "alphafold-2", "esmfold", "boltz-1", "chai-1", "rfdiffusion"],
  pdbj: ["alphafold-3", "esmfold", "boltz-1"],
  emdb: ["alphafold-3", "boltz-1"],
  "alphafold-db": ["alphafold-3", "alphafold-2", "alphafold-multimer"],
  "esm-atlas": ["esmfold", "esmfold2"],
  "swiss-model-repository": ["alphafold-3", "esmfold"],
  modelarchive: ["alphafold-3", "esmfold", "boltz-1"],
  "ncbi-structure": ["alphafold-3"],
  "allen-cell-explorer": ["scgpt", "geneformer"],
  "cell-image-library": ["scgpt", "geneformer"],
  "image-data-resource": ["scgpt", "geneformer"],
  "human-reference-atlas": ["scgpt", "geneformer"],
  "hubmap-data-portal": ["scgpt", "geneformer"],
};

function remapScale(scale) {
  return SCALE_REMAP[scale] || scale;
}

const RELATED_GROUPS = [
  ["rcsb-pdb", "pdbe", "pdbj", "emdb", "empiar", "pdb-101", "ncbi-structure"],
  ["alphafold-db", "esm-atlas", "swiss-model-repository", "modelarchive", "rcsb-pdb"],
  ["openorganelle", "allen-cell-explorer", "cryoet-data-portal", "bioimage-archive", "image-data-resource"],
  ["flywire-codex", "virtual-fly-brain", "neuprint"],
  ["allen-brain-map", "allen-developing-mouse-brain", "microns-explorer", "mouselight", "blue-brain-cell-atlas"],
  ["wormatlas", "wormwiring", "openworm-browser"],
  ["nih-3d", "visible-human-project", "bodyparts3d", "anatomytool", "open-anatomy", "sketchfab"],
  ["human-organ-atlas", "human-reference-atlas", "hubmap-data-portal", "lungmap", "gudmap", "facebase", "cardiac-atlas-project"],
  ["morphosource", "phenome10k", "digimorph", "morphomuseum", "aves-3d", "gb3d-type-fossils", "smithsonian-3d"],
  ["sketchfab", "wikimedia-commons", "print-marketplaces", "nih-3d"],
  ["ebrains-atlases", "bigbrain", "scalable-brain-atlas"],
];

async function findByName(type, name) {
  const rows = await sql`
    SELECT id FROM entities
    WHERE entity_type = ${type} AND lower(name) = ${name.toLowerCase()}
    LIMIT 1
  `;
  return rows[0]?.id || null;
}

async function ensureOrganization(org) {
  const existing = await findByName("organization", org.name);
  if (existing) {
    await sql`
      INSERT INTO organizations (entity_id, org_kind, website)
      VALUES (${existing}, ${org.orgKind}, ${org.website})
      ON CONFLICT (entity_id) DO UPDATE SET
        website = coalesce(organizations.website, EXCLUDED.website)
    `;
    return existing;
  }
  const slugOwner = await sql`SELECT id, entity_type FROM entities WHERE slug = ${org.slug} LIMIT 1`;
  if (slugOwner[0] && slugOwner[0].entity_type !== "organization") {
    throw new Error(`Organization slug ${org.slug} is already used by a ${slugOwner[0].entity_type}`);
  }
  const [entity] = await sql`
    INSERT INTO entities (
      entity_type, slug, name, summary, status, visibility,
      published_at, created_by, updated_by
    ) VALUES (
      'organization', ${org.slug}, ${org.name}, ${org.summary},
      'published', 'public', now(), 'structures', 'structures'
    )
    ON CONFLICT (slug) DO UPDATE SET
      summary = coalesce(entities.summary, EXCLUDED.summary),
      updated_by = 'structures'
    RETURNING id
  `;
  await sql`
    INSERT INTO organizations (entity_id, org_kind, website)
    VALUES (${entity.id}, ${org.orgKind}, ${org.website})
    ON CONFLICT (entity_id) DO UPDATE SET
      website = coalesce(organizations.website, EXCLUDED.website)
  `;
  return entity.id;
}

async function ensureCollection(row) {
  const existing = await findByName("collection", row.name);
  const id = existing || await insertCollectionEntity(row);
  await sql`
    UPDATE entities
    SET summary = ${row.summary}, status = 'published', visibility = 'public', updated_by = 'structures'
    WHERE id = ${id}
  `;
  const scale = remapScale(row.scale);
  await sql`
    INSERT INTO collections (entity_id, scale, access, media_kind, website, is_hub, scales)
    VALUES (${id}, ${scale}, ${row.access}, ${row.mediaKind}, ${row.website}, ${Boolean(row.isHub)}, ${sql.array([scale])})
    ON CONFLICT (entity_id) DO UPDATE SET
      scale = EXCLUDED.scale,
      access = EXCLUDED.access,
      media_kind = EXCLUDED.media_kind,
      website = EXCLUDED.website,
      is_hub = EXCLUDED.is_hub,
      scales = EXCLUDED.scales
  `;
  await sql`
    INSERT INTO entity_external_ids (entity_id, scheme, value)
    VALUES (${id}, 'website', ${row.website})
    ON CONFLICT (scheme, value) DO NOTHING
  `;
  return id;
}

async function insertCollectionEntity(row) {
  const slugOwner = await sql`SELECT id, entity_type FROM entities WHERE slug = ${row.slug} LIMIT 1`;
  if (slugOwner[0] && slugOwner[0].entity_type !== "collection") {
    throw new Error(`Collection slug ${row.slug} is already used by a ${slugOwner[0].entity_type}`);
  }
  const [entity] = await sql`
    INSERT INTO entities (
      entity_type, slug, name, summary, status, visibility,
      published_at, created_by, updated_by
    ) VALUES (
      'collection', ${row.slug}, ${row.name}, ${row.summary},
      'published', 'public', now(), 'structures', 'structures'
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      summary = EXCLUDED.summary,
      updated_by = 'structures'
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

try {
  const collectionSlugs = new Set(catalogue.collections.map((row) => row.slug));
  const orgIds = new Map();
  for (const org of catalogue.organizations) {
    const key = org.slug;
    if (collectionSlugs.has(org.slug)) org.slug = `${org.slug}-org`;
    const id = await ensureOrganization(org);
    const [current] = await sql`SELECT slug FROM entities WHERE id = ${id}`;
    if (collectionSlugs.has(current.slug)) {
      await sql`UPDATE entities SET slug = ${org.slug} WHERE id = ${id}`;
    }
    orgIds.set(key, id);
  }

  const methodRows = await sql`
    SELECT id, name FROM entities
    WHERE entity_type = 'method' AND status = 'published'
  `;
  const methodsByName = new Map(methodRows.map((row) => [row.name.toLowerCase(), row.id]));

  const modelRows = await sql`
    SELECT id, slug FROM entities
    WHERE entity_type = 'model' AND status = 'published'
  `;
  const modelsBySlug = new Map(modelRows.map((row) => [row.slug, row.id]));

  const collectionIds = new Map();
  for (const row of catalogue.collections) {
    const id = await ensureCollection(row);
    collectionIds.set(row.slug, id);
    for (const orgSlug of row.organizations || []) {
      const orgId = orgIds.get(orgSlug);
      if (!orgId) throw new Error(`${row.slug} references unknown organization ${orgSlug}`);
      await relate(id, orgId, "developed_by");
    }
    for (const methodName of row.methods || []) {
      await relate(id, methodsByName.get(methodName.toLowerCase()), "uses");
    }
    for (const modelSlug of MODEL_LINKS[row.slug] || []) {
      await relate(id, modelsBySlug.get(modelSlug), "relevant_model");
    }
  }

  for (const group of RELATED_GROUPS) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        await relate(collectionIds.get(group[i]), collectionIds.get(group[j]), "related_to");
      }
    }
  }

  console.log(`seeded ${collectionIds.size} structure collections and ${orgIds.size} organizations`);
} finally {
  await sql.end();
}
