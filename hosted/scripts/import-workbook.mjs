import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

function loadWindowExport(text) {
  const match = text.match(/window\.\w+\s*=\s*([\s\S]*);\s*$/);
  if (!match) {
    throw new Error("Could not parse a window.* JavaScript data export");
  }
  return JSON.parse(match[1]);
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/,|;/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function slugify(value, fallback = "entity") {
  const slug = String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || fallback;
}

function textOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

const usedSlugs = new Set();

async function uniqueSlug(base) {
  let slug = slugify(base);
  let n = 2;
  while (usedSlugs.has(slug)) {
    slug = `${slugify(base).slice(0, 70)}-${n}`;
    n += 1;
  }
  usedSlugs.add(slug);
  return slug;
}

async function insertEntity(row) {
  const [entity] = await sql`
    INSERT INTO entities (
      entity_type, slug, name, summary, status, visibility,
      published_at, created_by, updated_by
    ) VALUES (
      ${row.entityType}, ${row.slug}, ${row.name}, ${row.summary},
      ${row.status}, ${row.visibility || "public"},
      ${row.status === "published" ? new Date() : null},
      ${row.createdBy || "import"}, ${row.createdBy || "import"}
    )
    RETURNING id
  `;
  return entity.id;
}

async function addExternalId(entityId, scheme, value) {
  await sql`
    INSERT INTO entity_external_ids (entity_id, scheme, value)
    VALUES (${entityId}, ${scheme}, ${value})
    ON CONFLICT (scheme, value) DO NOTHING
  `;
}

async function addAlias(entityId, alias, kind) {
  if (!alias) return;
  await sql`
    INSERT INTO entity_aliases (entity_id, alias, alias_kind, is_primary)
    VALUES (${entityId}, ${alias}, ${kind}, ${kind === "acronym"})
    ON CONFLICT DO NOTHING
  `;
}

async function relate(fromId, toId, type, notes = null) {
  if (!fromId || !toId || fromId === toId) return;
  await sql`
    INSERT INTO entity_relations (from_entity_id, to_entity_id, relation_type, status, notes)
    VALUES (${fromId}, ${toId}, ${type}, 'published', ${notes})
    ON CONFLICT (from_entity_id, to_entity_id, relation_type) DO NOTHING
  `;
}

async function upsertSource(title, url, bestFor = null) {
  const key = url || title;
  if (!key) return null;
  const existing = url
    ? await sql`SELECT entity_id FROM sources WHERE url = ${url} LIMIT 1`
    : [];
  if (existing.length) return existing[0].entity_id;

  const slug = await uniqueSlug(title || url);
  const id = await insertEntity({
    entityType: "source",
    slug,
    name: title || url,
    summary: bestFor || title || url,
    status: "published",
    createdBy: "import",
  });
  await sql`
    INSERT INTO sources (entity_id, source_kind, url, title, reliability)
    VALUES (${id}, 'url', ${url}, ${title || url}, 'secondary')
  `;
  return id;
}

try {
  const data = loadWindowExport(await readFile(path.join(root, "public/data/data.js"), "utf8"));
  const videos = loadWindowExport(await readFile(path.join(root, "public/data/videos.js"), "utf8"));

  await sql.unsafe(`
    TRUNCATE
      ingestion_candidates, ingestion_runs,
      stage_entities, learning_stages, learning_paths,
      entity_media, media_assets,
      relation_sources, entity_sources, entity_relations,
      entity_aliases, entity_external_ids, entity_revisions,
      model_benchmarks, concepts, methods, models, organizations,
      people, publications, datasets, tools, biological_domains,
      use_cases, events, sources, entity_embeddings, entities
    RESTART IDENTITY CASCADE
  `);

  const existingSlugs = await sql`SELECT slug FROM entities`;
  for (const row of existingSlugs) usedSlugs.add(row.slug);

  const domainIds = new Map();
  const nameIndex = new Map();
  const legacyIds = new Map();

  const domainNames = new Set();
  for (const term of data.glossary) {
    if (term.Domain) domainNames.add(String(term.Domain).trim());
  }
  for (const method of data.methodologies) {
    if (method.Category) domainNames.add(String(method.Category).trim());
  }

  for (const name of [...domainNames].sort()) {
    const slug = await uniqueSlug(name);
    const id = await insertEntity({
      entityType: "biological_domain",
      slug,
      name,
      summary: `${name} concepts and methods in BioAtlas.`,
      status: "published",
    });
    await sql`INSERT INTO biological_domains (entity_id) VALUES (${id})`;
    domainIds.set(name.toLowerCase(), id);
    nameIndex.set(`biological_domain:${name.toLowerCase()}`, id);
  }

  for (const source of data.sources) {
    await upsertSource(source.Source, source.URL, source["Best for"]);
  }

  for (const term of data.glossary) {
    const name = textOrNull(term.Term);
    if (!name) continue;
    const slug = await uniqueSlug(name);
    const id = await insertEntity({
      entityType: "concept",
      slug,
      name,
      summary: textOrNull(term.Definition),
      status: "published",
    });
    await sql`
      INSERT INTO concepts (
        entity_id, concept_kind, level, priority, definition,
        why_it_matters, example, common_confusion
      ) VALUES (
        ${id}, 'terminology', ${textOrNull(term.Level)}, ${textOrNull(term.Priority)},
        ${textOrNull(term.Definition)}, ${textOrNull(term["Why it matters"])},
        ${textOrNull(term.Example)}, ${textOrNull(term["Common confusion"])}
      )
    `;
    const legacy = `term-${term.ID}`;
    await addExternalId(id, "bioatlas_legacy", legacy);
    await addAlias(id, textOrNull(term.Acronym), "acronym");
    const domainId = domainIds.get(String(term.Domain || "").toLowerCase());
    if (domainId) await relate(id, domainId, "in_domain");
    const sourceId = await upsertSource(null, textOrNull(term["Source URL"]));
    if (sourceId) {
      await sql`
        INSERT INTO entity_sources (entity_id, source_id, role)
        VALUES (${id}, ${sourceId}, 'primary')
        ON CONFLICT DO NOTHING
      `;
    }
    nameIndex.set(`concept:${name.toLowerCase()}`, id);
    legacyIds.set(legacy, id);
  }

  for (const method of data.methodologies) {
    const name = textOrNull(method.Methodology);
    if (!name) continue;
    const slug = await uniqueSlug(name);
    const id = await insertEntity({
      entityType: "method",
      slug,
      name,
      summary: textOrNull(method.Purpose),
      status: "published",
    });
    await sql`
      INSERT INTO methods (
        entity_id, purpose, typical_inputs, typical_outputs, simplified_workflow,
        strengths, limitations, key_qc_checks, level, priority
      ) VALUES (
        ${id}, ${textOrNull(method.Purpose)}, ${textOrNull(method["Typical inputs"])},
        ${textOrNull(method["Typical outputs"])}, ${textOrNull(method["Simplified workflow"])},
        ${textOrNull(method.Strengths)}, ${textOrNull(method["Limitations / risks"])},
        ${textOrNull(method["Key QC checks"])}, ${textOrNull(method.Level)},
        ${textOrNull(method.Priority)}
      )
    `;
    const legacy = `method-${method.ID}`;
    await addExternalId(id, "bioatlas_legacy", legacy);
    await addAlias(id, textOrNull(method.Acronym), "acronym");
    const domainId = domainIds.get(String(method.Category || "").toLowerCase());
    if (domainId) await relate(id, domainId, "in_domain");
    const sourceId = await upsertSource(null, textOrNull(method["Source URL"]));
    if (sourceId) {
      await sql`
        INSERT INTO entity_sources (entity_id, source_id, role)
        VALUES (${id}, ${sourceId}, 'primary')
        ON CONFLICT DO NOTHING
      `;
    }
    for (const toolName of splitList(method["Common tools / platforms"])) {
      const key = `tool:${toolName.toLowerCase()}`;
      let toolId = nameIndex.get(key);
      if (!toolId) {
        const toolSlug = await uniqueSlug(toolName);
        toolId = await insertEntity({
          entityType: "tool",
          slug: toolSlug,
          name: toolName,
          summary: `${toolName} is referenced as a common tool or platform for ${name}.`,
          status: "published",
        });
        await sql`
          INSERT INTO tools (entity_id, tool_kind)
          VALUES (${toolId}, 'platform')
        `;
        nameIndex.set(key, toolId);
      }
      await relate(id, toolId, "uses");
    }
    nameIndex.set(`method:${name.toLowerCase()}`, id);
    nameIndex.set(`concept:${name.toLowerCase()}`, nameIndex.get(`concept:${name.toLowerCase()}`) || id);
    legacyIds.set(legacy, id);
  }

  async function resolveOrStub(name) {
    const lower = name.toLowerCase();
    const existing =
      nameIndex.get(`concept:${lower}`) ||
      nameIndex.get(`method:${lower}`) ||
      nameIndex.get(`biological_domain:${lower}`);
    if (existing) return existing;
    const slug = await uniqueSlug(name);
    const id = await insertEntity({
      entityType: "concept",
      slug,
      name,
      summary: "Referenced from a related-concept link. Definition pending editorial review.",
      status: "draft",
    });
    await sql`
      INSERT INTO concepts (entity_id, concept_kind)
      VALUES (${id}, 'terminology')
    `;
    nameIndex.set(`concept:${lower}`, id);
    return id;
  }

  for (const term of data.glossary) {
    const fromId = nameIndex.get(`concept:${String(term.Term || "").toLowerCase()}`);
    if (!fromId) continue;
    for (const related of splitList(term["Related concepts"])) {
      const toId = await resolveOrStub(related);
      await relate(fromId, toId, "related_to");
    }
  }

  const [pathRow] = await sql`
    INSERT INTO learning_paths (slug, name, description)
    VALUES (
      'bioatlas',
      'The OVAITY BioAtlas',
      'Eight-stage path from basic biology to AI-assisted research.'
    )
    RETURNING id
  `;

  for (const stage of data.learningPath) {
    const [stageRow] = await sql`
      INSERT INTO learning_stages (
        path_id, stage_n, theme, goal, core_concepts_text, methods_text,
        practical_exercise, suggested_hours
      ) VALUES (
        ${pathRow.id}, ${stage.Stage}, ${stage.Theme}, ${stage.Goal},
        ${stage["Core concepts to master"]}, ${stage["Methods to recognize"]},
        ${stage["Practical exercise"]}, ${stage["Suggested hours"] || null}
      )
      RETURNING id
    `;
    for (const termName of stage.matched_terms || []) {
      const entityId = nameIndex.get(`concept:${termName.toLowerCase()}`);
      if (entityId) {
        await sql`
          INSERT INTO stage_entities (stage_id, entity_id, role)
          VALUES (${stageRow.id}, ${entityId}, 'core_concept')
          ON CONFLICT DO NOTHING
        `;
      }
    }
    for (const methodName of stage.matched_methodologies || []) {
      const entityId = nameIndex.get(`method:${methodName.toLowerCase()}`);
      if (entityId) {
        await sql`
          INSERT INTO stage_entities (stage_id, entity_id, role)
          VALUES (${stageRow.id}, ${entityId}, 'method_to_recognize')
          ON CONFLICT DO NOTHING
        `;
      }
    }
  }

  const mediaByUrl = new Map();
  for (const [legacy, video] of Object.entries(videos)) {
    if (!video?.videoUrl) continue;
    let mediaId = mediaByUrl.get(video.videoUrl);
    if (!mediaId) {
      const [media] = await sql`
        INSERT INTO media_assets (kind, title, url, channel)
        VALUES ('video', ${video.videoTitle}, ${video.videoUrl}, ${video.channel || null})
        ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title
        RETURNING id
      `;
      mediaId = media.id;
      mediaByUrl.set(video.videoUrl, mediaId);
    }
    const entityId = legacyIds.get(legacy);
    if (entityId) {
      await sql`
        INSERT INTO entity_media (entity_id, media_id, role)
        VALUES (${entityId}, ${mediaId}, 'explains')
        ON CONFLICT DO NOTHING
      `;
    }
  }

  const counts = await sql`
    SELECT entity_type, count(*)::int AS n
    FROM entities
    GROUP BY entity_type
    ORDER BY entity_type
  `;
  console.log("imported entities:");
  for (const row of counts) {
    console.log(`  ${row.entity_type}: ${row.n}`);
  }
} finally {
  await sql.end();
}
