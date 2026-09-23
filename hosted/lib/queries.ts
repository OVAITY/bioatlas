import {
  biorodeoSource,
  hasBiorodeoCatalogue,
  loadBiorodeoCatalogue,
  providerLogo,
} from "./biorodeo-catalogue";
import { isDatabaseConfigured, getSql } from "./db";
import {
  loadStructureCatalogueFile,
  structureAtlasMeta,
  structureCardsFromFile,
  type StructureCard,
} from "./structures-catalogue";

type Sql = ReturnType<typeof getSql>;

export type RelatedLink = {
  name: string;
  id: string | null;
  slug: string | null;
  entityType: string;
  published: boolean;
};

export type Neighbor = {
  id: string;
  slug: string;
  name: string;
  entityType: string;
  summary: string | null;
  relationType: string;
  direction: "from" | "to";
  legacyId: string | null;
};

function asLegacyKind(entityType: string) {
  if (entityType === "concept") return "term";
  if (entityType === "method") return "method";
  return entityType;
}

export async function getLegacyMap(sql: Sql, entityIds: string[]) {
  if (!entityIds.length) return new Map<string, string>();
  const rows = await sql`
    SELECT entity_id, value
    FROM entity_external_ids
    WHERE scheme = 'bioatlas_legacy' AND entity_id IN ${sql(entityIds)}
  `;
  return new Map(rows.map((row) => [row.entity_id as string, row.value as string]));
}

export async function resolveEntityRef(ref: string) {
  const sql = getSql();
  const byLegacy = await sql`
    SELECT e.*
    FROM entity_external_ids x
    JOIN entities e ON e.id = x.entity_id
    WHERE x.scheme = 'bioatlas_legacy' AND x.value = ${ref}
    LIMIT 1
  `;
  if (byLegacy[0]) return byLegacy[0];
  const bySlug = await sql`SELECT * FROM entities WHERE slug = ${ref} LIMIT 1`;
  return bySlug[0] || null;
}

async function relatedFor(sql: Sql, entityIds: string[]) {
  if (!entityIds.length) return new Map<string, RelatedLink[]>();
  const rows = await sql`
    SELECT
      r.from_entity_id,
      r.to_entity_id,
      n.id,
      n.name,
      n.slug,
      n.entity_type,
      n.status,
      n.visibility,
      x.value AS legacy_id
    FROM entity_relations r
    JOIN entities n ON n.id = r.to_entity_id
    LEFT JOIN entity_external_ids x
      ON x.entity_id = n.id AND x.scheme = 'bioatlas_legacy'
    WHERE r.from_entity_id IN ${sql(entityIds)}
      AND r.relation_type = 'related_to'
      AND r.status = 'published'
  `;
  const map = new Map<string, RelatedLink[]>();
  for (const row of rows) {
    const published = row.status === "published" && row.visibility === "public";
    const list = map.get(row.from_entity_id) || [];
    list.push({
      name: row.name,
      id: published
        ? (row.legacy_id as string | null) || `${asLegacyKind(row.entity_type)}-${row.slug}`
        : null,
      slug: published ? row.slug : null,
      entityType: row.entity_type,
      published,
    });
    map.set(row.from_entity_id, list);
  }
  return map;
}

export async function getAtlasPayload() {
  const sql = getSql();
  const concepts = await sql`
    SELECT e.id, e.name, e.slug, c.*, x.value AS legacy_id, d.name AS domain
    FROM entities e
    JOIN concepts c ON c.entity_id = e.id
    LEFT JOIN entity_external_ids x ON x.entity_id = e.id AND x.scheme = 'bioatlas_legacy'
    LEFT JOIN entity_relations r
      ON r.from_entity_id = e.id AND r.relation_type = 'in_domain' AND r.status = 'published'
    LEFT JOIN entities d ON d.id = r.to_entity_id
    WHERE e.entity_type = 'concept' AND e.status = 'published' AND e.visibility = 'public'
    ORDER BY x.value
  `;
  const methods = await sql`
    SELECT e.id, e.name, e.slug, m.*, x.value AS legacy_id, d.name AS category
    FROM entities e
    JOIN methods m ON m.entity_id = e.id
    LEFT JOIN entity_external_ids x ON x.entity_id = e.id AND x.scheme = 'bioatlas_legacy'
    LEFT JOIN entity_relations r
      ON r.from_entity_id = e.id AND r.relation_type = 'in_domain' AND r.status = 'published'
    LEFT JOIN entities d ON d.id = r.to_entity_id
    WHERE e.entity_type = 'method' AND e.status = 'published' AND e.visibility = 'public'
    ORDER BY x.value
  `;
  const related = await relatedFor(sql, concepts.map((row) => row.id as string));

  const toolRows = await sql`
    SELECT r.from_entity_id, t.name
    FROM entity_relations r
    JOIN entities t ON t.id = r.to_entity_id
    WHERE r.relation_type = 'uses' AND r.status = 'published'
      AND t.entity_type = 'tool'
  `;
  const toolsByMethod = new Map<string, string[]>();
  for (const row of toolRows) {
    const list = toolsByMethod.get(row.from_entity_id) || [];
    list.push(row.name);
    toolsByMethod.set(row.from_entity_id, list);
  }

  const sourceRows = await sql`
    SELECT es.entity_id, s.url
    FROM entity_sources es
    JOIN sources s ON s.entity_id = es.source_id
    WHERE es.role = 'primary'
  `;
  const sourceByEntity = new Map(sourceRows.map((row) => [row.entity_id as string, row.url as string | null]));

  const aliasRows = await sql`
    SELECT entity_id, alias FROM entity_aliases WHERE alias_kind = 'acronym'
  `;
  const acronyms = new Map(aliasRows.map((row) => [row.entity_id as string, row.alias as string]));

  const glossary = concepts
    .filter((row) => row.legacy_id)
    .map((row) => {
      const links = related.get(row.id as string) || [];
      const legacyNum = Number(String(row.legacy_id).replace("term-", ""));
      return {
        ID: legacyNum,
        Term: row.name,
        Acronym: acronyms.get(row.id as string) || null,
        Domain: row.domain || null,
        Level: row.level,
        Definition: row.definition,
        "Why it matters": row.why_it_matters,
        Example: row.example,
        "Related concepts": links.map((link) => link.name).join("; ") || null,
        related: links,
        "Common confusion": row.common_confusion,
        Priority: row.priority,
        Status: "Not started",
        "Confidence (1-5)": null,
        "Personal notes": null,
        "Source URL": sourceByEntity.get(row.id as string) || null,
        slug: row.slug,
      };
    });

  const methodologies = methods
    .filter((row) => row.legacy_id)
    .map((row) => {
      const legacyNum = Number(String(row.legacy_id).replace("method-", ""));
      return {
        ID: legacyNum,
        Methodology: row.name,
        Acronym: acronyms.get(row.id as string) || null,
        Category: row.category || null,
        Level: row.level,
        Purpose: row.purpose,
        "Typical inputs": row.typical_inputs,
        "Simplified workflow": row.simplified_workflow,
        "Typical outputs": row.typical_outputs,
        Strengths: row.strengths,
        "Limitations / risks": row.limitations,
        "Key QC checks": row.key_qc_checks,
        "Common tools / platforms": (toolsByMethod.get(row.id as string) || []).join(", ") || null,
        Priority: row.priority,
        Status: "Not started",
        "Personal notes": null,
        "Source URL": sourceByEntity.get(row.id as string) || null,
        slug: row.slug,
      };
    });

  const stages = await sql`
    SELECT s.*, e.name AS entity_name, e.entity_type, se.role
    FROM learning_stages s
    JOIN learning_paths p ON p.id = s.path_id
    LEFT JOIN stage_entities se ON se.stage_id = s.id
    LEFT JOIN entities e ON e.id = se.entity_id AND e.status = 'published'
    WHERE p.slug = 'bioatlas'
    ORDER BY s.stage_n
  `;
  const stageMap = new Map<number, Record<string, unknown>>();
  for (const row of stages) {
    const current = stageMap.get(row.stage_n) || {
      Stage: row.stage_n,
      Theme: row.theme,
      Goal: row.goal,
      "Core concepts to master": row.core_concepts_text,
      "Methods to recognize": row.methods_text,
      "Practical exercise": row.practical_exercise,
      "Suggested hours": row.suggested_hours,
      Status: "Not started",
      "Evidence of completion": null,
      matched_terms: [] as string[],
      matched_methodologies: [] as string[],
    };
    if (row.role === "core_concept" && row.entity_name) {
      (current.matched_terms as string[]).push(row.entity_name);
    }
    if (row.role === "method_to_recognize" && row.entity_name) {
      (current.matched_methodologies as string[]).push(row.entity_name);
    }
    stageMap.set(row.stage_n, current);
  }

  const bibliography = await sql`
    SELECT e.name, s.url, e.summary
    FROM entities e
    JOIN sources s ON s.entity_id = e.id
    WHERE e.entity_type = 'source'
      AND e.status = 'published' AND e.visibility = 'public'
      AND e.name NOT LIKE 'http%'
      AND s.url IS NOT NULL
    ORDER BY e.name
  `;

  const [modelRows, collectionRows, eventRows, recentEvents] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM entities WHERE entity_type = 'model' AND status = 'published' AND visibility = 'public'`,
    sql`SELECT count(*)::int AS n FROM entities WHERE entity_type = 'collection' AND status = 'published' AND visibility = 'public'`,
    sql`SELECT count(*)::int AS n FROM entities WHERE entity_type = 'event' AND status = 'published' AND visibility = 'public'`,
    sql`
      SELECT e.slug, e.name, e.summary, ev.event_type, ev.occurred_on
      FROM entities e
      JOIN events ev ON ev.entity_id = e.id
      WHERE e.status = 'published' AND e.visibility = 'public'
      ORDER BY ev.occurred_on DESC NULLS LAST, e.name
      LIMIT 3
    `,
  ]);

  const modelCount = hasBiorodeoCatalogue()
    ? loadBiorodeoCatalogue().models.length
    : Number(modelRows[0]?.n || 0);
  const collectionCount = Number(collectionRows[0]?.n || 0) || structureCardsFromFile().length;
  const eventCount = Number(eventRows[0]?.n || 0);

  return {
    glossary,
    methodologies,
    learningPath: [...stageMap.values()],
    sources: bibliography.map((row) => ({
      Source: row.name,
      "Best for": row.summary,
      URL: row.url,
    })),
    recentEvents,
    meta: {
      glossaryCount: glossary.length,
      methodologyCount: methodologies.length,
      stageCount: stageMap.size,
      modelCount,
      collectionCount,
      eventCount,
    },
  };
}

export async function getVideosPayload() {
  const sql = getSql();
  const rows = await sql`
    SELECT x.value AS legacy_id, m.title, m.url, m.channel
    FROM entity_media em
    JOIN media_assets m ON m.id = em.media_id
    JOIN entity_external_ids x ON x.entity_id = em.entity_id AND x.scheme = 'bioatlas_legacy'
    WHERE m.kind = 'video'
  `;
  const videos: Record<string, { videoTitle: string; videoUrl: string; channel: string }> = {};
  for (const row of rows) {
    videos[row.legacy_id] = {
      videoTitle: row.title,
      videoUrl: row.url,
      channel: row.channel || "",
    };
  }
  return videos;
}

export async function getNeighbors(ref: string, depth = 1): Promise<{ center: Record<string, unknown> | null; neighbors: Neighbor[] }> {
  const center = await resolveEntityRef(ref);
  if (!center) return { center: null, neighbors: [] };
  const sql = getSql();
  const seen = new Set<string>([center.id]);
  let frontier = [center.id as string];
  const neighbors: Neighbor[] = [];

  for (let level = 0; level < Math.max(1, Math.min(depth, 2)); level += 1) {
    if (!frontier.length) break;
    const rows = await sql`
      SELECT
        r.relation_type,
        r.from_entity_id,
        r.to_entity_id,
        e.id,
        e.slug,
        e.name,
        e.entity_type,
        e.summary,
        x.value AS legacy_id
      FROM entity_relations r
      JOIN entities e ON e.id = CASE
        WHEN r.from_entity_id IN ${sql(frontier)} THEN r.to_entity_id
        ELSE r.from_entity_id
      END
      LEFT JOIN entity_external_ids x ON x.entity_id = e.id AND x.scheme = 'bioatlas_legacy'
      WHERE r.status = 'published'
        AND e.status = 'published'
        AND e.visibility = 'public'
        AND (r.from_entity_id IN ${sql(frontier)} OR r.to_entity_id IN ${sql(frontier)})
    `;
    const next: string[] = [];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      next.push(row.id);
      neighbors.push({
        id: row.legacy_id || row.slug,
        slug: row.slug,
        name: row.name,
        entityType: row.entity_type,
        summary: row.summary,
        relationType: row.relation_type,
        direction: frontier.includes(row.from_entity_id) ? "from" : "to",
        legacyId: row.legacy_id,
      });
    }
    frontier = next;
  }

  const legacy = await sql`
    SELECT value FROM entity_external_ids
    WHERE entity_id = ${center.id} AND scheme = 'bioatlas_legacy'
    LIMIT 1
  `;

  return {
    center: {
      id: legacy[0]?.value || center.slug,
      slug: center.slug,
      name: center.name,
      entityType: center.entity_type,
      summary: center.summary,
    },
    neighbors,
  };
}

export async function searchEntities(query: string, embedding?: number[]) {
  const sql = getSql();
  const trimmed = query.trim();
  if (!trimmed && !embedding?.length) return [];

  if (embedding?.length === 1536) {
    try {
      const vector = `[${embedding.join(",")}]`;
      return await sql`
        SELECT e.slug, e.name, e.entity_type, e.summary, x.value AS legacy_id,
               1 - (emb.embedding <=> ${vector}::vector) AS rank
        FROM entity_embeddings emb
        JOIN entities e ON e.id = emb.entity_id
        LEFT JOIN entity_external_ids x ON x.entity_id = e.id AND x.scheme = 'bioatlas_legacy'
        WHERE e.status = 'published' AND e.visibility = 'public'
        ORDER BY emb.embedding <=> ${vector}::vector
        LIMIT 20
      `;
    } catch {
      // Fall through to full-text search when pgvector is unavailable.
    }
  }

  if (!trimmed) return [];
  return sql`
    SELECT e.slug, e.name, e.entity_type, e.summary, x.value AS legacy_id,
           ts_rank(e.search_vector, websearch_to_tsquery('english', ${trimmed})) AS rank
    FROM entities e
    LEFT JOIN entity_external_ids x ON x.entity_id = e.id AND x.scheme = 'bioatlas_legacy'
    WHERE e.status = 'published' AND e.visibility = 'public'
      AND e.search_vector @@ websearch_to_tsquery('english', ${trimmed})
    ORDER BY rank DESC, e.name
    LIMIT 30
  `;
}

export async function listPublishedByType(entityType: string) {
  const sql = getSql();
  return sql`
    SELECT e.id, e.slug, e.name, e.summary, e.entity_type, e.published_at
    FROM entities e
    WHERE e.entity_type = ${entityType}
      AND e.status = 'published' AND e.visibility = 'public'
    ORDER BY e.name
  `;
}

export async function getModelCatalogue() {
  if (hasBiorodeoCatalogue()) {
    return loadBiorodeoCatalogue().models;
  }
  const sql = getSql();
  const rows = await sql`
    SELECT
      e.id, e.slug, e.name, e.summary,
      m.release_date, m.model_category, m.architecture, m.openness, m.license,
      m.input_modalities, m.output_modalities, m.github_url, m.model_url, m.api_url
    FROM entities e
    JOIN models m ON m.entity_id = e.id
    WHERE e.status = 'published' AND e.visibility = 'public'
    ORDER BY m.release_date DESC NULLS LAST, e.name
  `;
  const slugs = rows.map((row) => row.slug as string);
  const neighborMap = await getNeighborsForSlugs(slugs);
  return rows.map((row) => ({
    ...row,
    neighbors: neighborMap.get(row.slug as string) || [],
  }));
}

async function getNeighborsForSlugs(slugs: string[]) {
  const map = new Map<string, Neighbor[]>();
  await Promise.all(slugs.map(async (slug) => {
    const graph = await getNeighbors(slug, 1);
    map.set(slug, graph.neighbors);
  }));
  return map;
}

export async function getRunProviders() {
  if (hasBiorodeoCatalogue()) {
    return loadBiorodeoCatalogue().providers;
  }
  const sql = getSql();
  const rows = await sql`
    SELECT e.slug, e.name, e.summary, t.website, t.tool_kind
    FROM entities e
    JOIN tools t ON t.entity_id = e.id
    JOIN entity_external_ids x ON x.entity_id = e.id AND x.scheme = 'biorodeo_provider'
    WHERE e.status = 'published' AND e.visibility = 'public'
    ORDER BY e.name
  `;
  return rows.map((row) => ({
    ...row,
    logo: providerLogo(row.slug as string),
  }));
}

export function bioRodeoAttribution() {
  return biorodeoSource();
}

function asTextArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function relatedModelNeighbors(slugs: string[]): Neighbor[] {
  if (!slugs.length) return [];
  const models = hasBiorodeoCatalogue() ? loadBiorodeoCatalogue().models : [];
  return slugs.map((slug) => {
    const model = models.find((item) => item.slug === slug);
    return {
      id: slug,
      slug,
      name: model?.name || slug,
      entityType: "model",
      summary: model?.summary || null,
      relationType: "relevant_model",
      direction: "from" as const,
      legacyId: null,
    };
  });
}

function hydrateStructureCard(card: StructureCard, neighbors: Neighbor[] = []) {
  const modelSlugs = new Set(card.related_models);
  const relatedModels = [
    ...neighbors.filter((neighbor) => neighbor.entityType === "model" || neighbor.relationType === "relevant_model"),
    ...relatedModelNeighbors(card.related_models).filter((model) => !neighbors.some((neighbor) => neighbor.slug === model.slug)),
  ];
  return {
    ...card,
    neighbors: neighbors.filter((neighbor) => !modelSlugs.has(neighbor.slug) && neighbor.relationType !== "relevant_model"),
    related_models: relatedModels,
  };
}

export function getStructureAtlas() {
  return structureAtlasMeta();
}

export async function getStructureCatalogue(): Promise<Array<ReturnType<typeof hydrateStructureCard>>> {
  const fallback = () => structureCardsFromFile().map((card) => hydrateStructureCard(card));
  if (!isDatabaseConfigured()) return fallback();
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        e.slug, e.name, e.summary,
        c.scale, c.access, c.media_kind, c.website, c.is_hub,
        c.best_for, c.scales, c.resource_types, c.modalities, c.data_types,
        c.capabilities, c.tags, c.species
      FROM entities e
      JOIN collections c ON c.entity_id = e.id
      WHERE e.status = 'published' AND e.visibility = 'public'
      ORDER BY e.name
    `;
    if (!rows.length) return fallback();
    const fileCards = new Map(structureCardsFromFile().map((card) => [card.slug, card]));
    const slugs = rows.map((row) => row.slug as string);
    const neighborMap = await collectionNeighbors(sql, slugs);
    return rows.map((row) => {
      const file = fileCards.get(row.slug as string);
      const card: StructureCard = {
        slug: row.slug as string,
        name: row.name as string,
        summary: (row.summary as string | null) || "",
        scale: file?.scale || (row.scale as string) || "Molecules",
        scales: file?.scales?.length ? file.scales : (asTextArray(row.scales).length ? asTextArray(row.scales) : [row.scale as string]),
        access: row.access as string,
        media_kind: row.media_kind as string,
        website: row.website as string,
        is_hub: Boolean(row.is_hub),
        best_for: file?.best_for || (row.best_for as string | null) || "",
        resource_types: file?.resource_types?.length ? file.resource_types : asTextArray(row.resource_types),
        modalities: file?.modalities?.length ? file.modalities : asTextArray(row.modalities),
        data_types: file?.data_types?.length ? file.data_types : asTextArray(row.data_types),
        capabilities: file?.capabilities?.length ? file.capabilities : asTextArray(row.capabilities),
        tags: file?.tags?.length ? file.tags : asTextArray(row.tags),
        species: file?.species?.length ? file.species : asTextArray(row.species),
        related_resources: file?.related_resources || [],
        related_models: file?.related_models || [],
        learning_topics: file?.learning_topics || [],
      };
      return hydrateStructureCard(card, neighborMap.get(row.slug as string) || []);
    });
  } catch (error) {
    console.error("Structure catalogue fell back to the curated file.", error);
    return fallback();
  }
}

async function collectionNeighbors(sql: Sql, slugs: string[]) {
  const map = new Map<string, Neighbor[]>();
  if (!slugs.length) return map;
  const rows = await sql`
    SELECT
      a.slug AS collection_slug,
      b.id,
      b.slug,
      b.name,
      b.entity_type,
      b.summary,
      r.relation_type,
      CASE WHEN r.from_entity_id = a.id THEN 'from' ELSE 'to' END AS direction,
      x.value AS legacy_id
    FROM entities a
    JOIN entity_relations r
      ON r.from_entity_id = a.id OR r.to_entity_id = a.id
    JOIN entities b ON b.id = CASE
      WHEN r.from_entity_id = a.id THEN r.to_entity_id
      ELSE r.from_entity_id
    END
    LEFT JOIN entity_external_ids x
      ON x.entity_id = b.id AND x.scheme = 'bioatlas_legacy'
    WHERE a.slug IN ${sql(slugs)}
      AND a.entity_type = 'collection'
      AND r.status = 'published'
      AND b.status = 'published'
      AND b.visibility = 'public'
      AND b.id <> a.id
  `;
  for (const row of rows) {
    const slug = row.collection_slug as string;
    const list = map.get(slug) || [];
    list.push({
      id: (row.legacy_id as string | null) || (row.slug as string),
      slug: row.slug as string,
      name: row.name as string,
      entityType: row.entity_type as string,
      summary: (row.summary as string | null) || null,
      relationType: row.relation_type as string,
      direction: row.direction as "from" | "to",
      legacyId: (row.legacy_id as string | null) || null,
    });
    map.set(slug, list);
  }
  return map;
}

export async function getKnowledgeGraph() {
  const sql = getSql();
  const entities = await sql`
    SELECT e.id, e.slug, e.name, e.entity_type, e.summary, x.value AS legacy_id
    FROM entities e
    LEFT JOIN entity_external_ids x ON x.entity_id = e.id AND x.scheme = 'bioatlas_legacy'
    WHERE e.status = 'published' AND e.visibility = 'public'
      AND e.entity_type <> 'source'
  `;
  const relations = await sql`
    SELECT a.slug AS "from", b.slug AS "to", r.relation_type
    FROM entity_relations r
    JOIN entities a ON a.id = r.from_entity_id
    JOIN entities b ON b.id = r.to_entity_id
    WHERE r.status = 'published'
      AND a.status = 'published' AND b.status = 'published'
      AND a.visibility = 'public' AND b.visibility = 'public'
      AND a.entity_type <> 'source' AND b.entity_type <> 'source'
  `;

  const nodes = new Map<string, Record<string, unknown>>();
  for (const row of entities) {
    nodes.set(row.slug as string, {
      key: row.slug,
      slug: row.slug,
      name: row.name,
      entityType: row.entity_type,
      summary: row.summary,
      legacyId: row.legacy_id,
    });
  }
  const edges: { from: string; to: string; relationType: string }[] = relations.map((row) => ({
    from: row.from as string,
    to: row.to as string,
    relationType: row.relation_type as string,
  }));

  if (hasBiorodeoCatalogue()) {
    const catalogue = loadBiorodeoCatalogue();
    for (const provider of catalogue.providers) {
      if (!nodes.has(provider.slug)) {
        nodes.set(provider.slug, {
          key: provider.slug,
          slug: provider.slug,
          name: provider.name,
          entityType: "tool",
          summary: provider.summary,
          legacyId: null,
        });
      }
    }
    const ranked = [...catalogue.models].sort((a, b) => (b.citations_count || 0) - (a.citations_count || 0));
    const picked = new Map<string, (typeof ranked)[number]>();
    for (const model of ranked.slice(0, 40)) picked.set(model.slug, model);
    const seenCategory = new Set<string>();
    for (const model of ranked) {
      const category = model.model_category || "other";
      if (seenCategory.has(category)) continue;
      seenCategory.add(category);
      picked.set(model.slug, model);
    }
    for (const model of picked.values()) {
      if (!nodes.has(model.slug)) {
        nodes.set(model.slug, {
          key: model.slug,
          slug: model.slug,
          name: model.name,
          entityType: "model",
          summary: model.summary,
          legacyId: null,
        });
      }
      for (const neighbor of model.neighbors || []) {
        const key = neighbor.slug;
        if (!key) continue;
        if (!nodes.has(key)) {
          nodes.set(key, {
            key,
            slug: key,
            name: neighbor.name,
            entityType: neighbor.entityType,
            summary: neighbor.summary,
            legacyId: neighbor.legacyId,
          });
        }
        edges.push({ from: model.slug, to: key, relationType: neighbor.relationType || "related_to" });
      }
    }
  }

  // Annotate / backfill 3D structure portals so Intelligence can surface them.
  try {
    const catalogue = loadStructureCatalogueFile();
    const cards = structureCardsFromFile();
    const collectionSlugs = new Set(cards.map((card) => card.slug));
    const existingCollections = [...nodes.values()].filter((node) => node.entityType === "collection");
    if (existingCollections.length < 8) {
      for (const card of cards) {
        if (!nodes.has(card.slug)) {
          nodes.set(card.slug, {
            key: card.slug,
            slug: card.slug,
            name: card.name,
            entityType: "collection",
            summary: card.summary,
            legacyId: null,
            isHub: card.is_hub,
          });
        }
      }
      for (const org of catalogue.organizations) {
        let slug = org.slug;
        if (collectionSlugs.has(slug)) slug = `${slug}-org`;
        if (!nodes.has(slug)) {
          nodes.set(slug, {
            key: slug,
            slug,
            name: org.name,
            entityType: "organization",
            summary: org.summary,
            legacyId: null,
          });
        }
      }
      for (const row of catalogue.collections) {
        for (const orgSlug of row.organizations || []) {
          const to = collectionSlugs.has(orgSlug) ? `${orgSlug}-org` : orgSlug;
          if (!nodes.has(row.slug) || !nodes.has(to)) continue;
          edges.push({ from: row.slug, to, relationType: "developed_by" });
        }
      }
      const byScale = new Map<string, string[]>();
      for (const card of cards) {
        const list = byScale.get(card.scale) || [];
        list.push(card.slug);
        byScale.set(card.scale, list);
      }
      for (const group of byScale.values()) {
        const hubs = group.filter((slug) => cards.find((card) => card.slug === slug)?.is_hub);
        const seeds = hubs.length ? hubs : group.slice(0, 1);
        for (const hub of seeds) {
          for (const other of group) {
            if (hub === other) continue;
            edges.push({ from: hub, to: other, relationType: "related_to" });
          }
        }
      }
    }
    for (const card of cards) {
      const node = nodes.get(card.slug);
      if (node && node.entityType === "collection" && card.is_hub) node.isHub = true;
    }
  } catch (error) {
    console.error("Structure catalogue could not be merged into the knowledge graph.", error);
  }

  const uniqueEdges = [];
  const seenEdges = new Set<string>();
  for (const edge of edges) {
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) continue;
    const id = `${edge.from}|${edge.to}|${edge.relationType}`;
    if (seenEdges.has(id)) continue;
    seenEdges.add(id);
    uniqueEdges.push(edge);
  }

  return {
    nodes: [...nodes.values()],
    edges: uniqueEdges,
    stats: {
      nodeCount: nodes.size,
      edgeCount: uniqueEdges.length,
    },
  };
}

export async function getEventFeed() {
  const sql = getSql();
  const rows = await sql`
    SELECT e.id, e.slug, e.name, e.summary, ev.event_type, ev.occurred_on, ev.body
    FROM entities e
    JOIN events ev ON ev.entity_id = e.id
    WHERE e.status = 'published' AND e.visibility = 'public'
    ORDER BY ev.occurred_on DESC NULLS LAST, e.name
  `;
  const feed = [];
  for (const row of rows) {
    const graph = await getNeighbors(row.slug as string, 1);
    feed.push({ ...row, neighbors: graph.neighbors });
  }
  return feed;
}
