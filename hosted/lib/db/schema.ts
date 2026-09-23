import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const entityTypes = pgTable("entity_types", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
});

export const entities = pgTable(
  "entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull().references(() => entityTypes.id),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    summary: text("summary"),
    status: text("status").notNull().default("draft"),
    visibility: text("visibility").notNull().default("public"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("entities_type_status_idx").on(table.entityType, table.status),
    uniqueIndex("entities_type_name_idx").on(table.entityType, table.name),
  ],
);

export const entityAliases = pgTable("entity_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
  aliasKind: text("alias_kind").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
});

export const entityExternalIds = pgTable("entity_external_ids", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  scheme: text("scheme").notNull(),
  value: text("value").notNull(),
});

export const concepts = pgTable("concepts", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  conceptKind: text("concept_kind").notNull().default("terminology"),
  level: text("level"),
  priority: text("priority"),
  definition: text("definition"),
  whyItMatters: text("why_it_matters"),
  example: text("example"),
  commonConfusion: text("common_confusion"),
});

export const methods = pgTable("methods", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  purpose: text("purpose"),
  typicalInputs: text("typical_inputs"),
  typicalOutputs: text("typical_outputs"),
  simplifiedWorkflow: text("simplified_workflow"),
  strengths: text("strengths"),
  limitations: text("limitations"),
  keyQcChecks: text("key_qc_checks"),
  level: text("level"),
  priority: text("priority"),
});

export const models = pgTable("models", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  releaseDate: date("release_date"),
  modelCategory: text("model_category"),
  architecture: text("architecture"),
  openness: text("openness"),
  license: text("license"),
  inputModalities: text("input_modalities").array(),
  outputModalities: text("output_modalities").array(),
  githubUrl: text("github_url"),
  modelUrl: text("model_url"),
  apiUrl: text("api_url"),
  card: jsonb("card"),
});

export const collections = pgTable("collections", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  scale: text("scale").notNull(),
  access: text("access").notNull(),
  mediaKind: text("media_kind").notNull(),
  website: text("website").notNull(),
  isHub: boolean("is_hub").notNull().default(false),
  bestFor: text("best_for"),
  scales: text("scales").array().notNull().default([]),
  resourceTypes: text("resource_types").array().notNull().default([]),
  modalities: text("modalities").array().notNull().default([]),
  dataTypes: text("data_types").array().notNull().default([]),
  capabilities: text("capabilities").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  species: text("species").array().notNull().default([]),
});

export const organizations = pgTable("organizations", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  orgKind: text("org_kind"),
  foundedOn: date("founded_on"),
  hqCountry: text("hq_country"),
  website: text("website"),
});

export const people = pgTable("people", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  orcid: text("orcid"),
});

export const publications = pgTable("publications", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  publicationType: text("publication_type"),
  publishedOn: date("published_on"),
  venue: text("venue"),
  doi: text("doi"),
  abstract: text("abstract"),
});

export const datasets = pgTable("datasets", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  license: text("license"),
  accessUrl: text("access_url"),
  version: text("version"),
});

export const tools = pgTable("tools", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  toolKind: text("tool_kind"),
  license: text("license"),
  website: text("website"),
  repoUrl: text("repo_url"),
});

export const biologicalDomains = pgTable("biological_domains", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references(() => entities.id),
});

export const useCases = pgTable("use_cases", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  description: text("description"),
});

export const events = pgTable("events", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  occurredOn: date("occurred_on"),
  body: text("body"),
  payload: jsonb("payload"),
});

export const sources = pgTable("sources", {
  entityId: uuid("entity_id").primaryKey().references(() => entities.id, { onDelete: "cascade" }),
  sourceKind: text("source_kind").notNull(),
  url: text("url"),
  title: text("title"),
  accessedAt: timestamp("accessed_at", { withTimezone: true }),
  reliability: text("reliability"),
});

export const modelBenchmarks = pgTable("model_benchmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  modelId: uuid("model_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  metric: text("metric"),
  score: text("score"),
  datasetId: uuid("dataset_id").references(() => entities.id),
  sourceId: uuid("source_id").references(() => entities.id),
  evaluatedOn: date("evaluated_on"),
});

export const relationTypes = pgTable("relation_types", {
  id: text("id").primaryKey(),
  inverseId: text("inverse_id"),
  description: text("description").notNull(),
});

export const entityRelations = pgTable(
  "entity_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fromEntityId: uuid("from_entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    toEntityId: uuid("to_entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull().references(() => relationTypes.id),
    confidence: numeric("confidence"),
    status: text("status").notNull().default("published"),
    notes: text("notes"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("entity_relations_from_idx").on(table.fromEntityId),
    index("entity_relations_to_idx").on(table.toEntityId),
  ],
);

export const entitySources = pgTable(
  "entity_sources",
  {
    entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("primary"),
  },
  (table) => [primaryKey({ columns: [table.entityId, table.sourceId, table.role] })],
);

export const relationSources = pgTable(
  "relation_sources",
  {
    relationId: uuid("relation_id").notNull().references(() => entityRelations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.relationId, table.sourceId] })],
);

export const entityRevisions = pgTable("entity_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
  revisionN: integer("revision_n").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  changedBy: text("changed_by"),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  channel: text("channel"),
  sourceId: uuid("source_id").references(() => entities.id),
});

export const entityMedia = pgTable(
  "entity_media",
  {
    entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").notNull().references(() => mediaAssets.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("explains"),
  },
  (table) => [primaryKey({ columns: [table.entityId, table.mediaId] })],
);

export const learningPaths = pgTable("learning_paths", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
});

export const learningStages = pgTable("learning_stages", {
  id: uuid("id").defaultRandom().primaryKey(),
  pathId: uuid("path_id").notNull().references(() => learningPaths.id, { onDelete: "cascade" }),
  stageN: integer("stage_n").notNull(),
  theme: text("theme").notNull(),
  goal: text("goal"),
  coreConceptsText: text("core_concepts_text"),
  methodsText: text("methods_text"),
  practicalExercise: text("practical_exercise"),
  suggestedHours: integer("suggested_hours"),
});

export const stageEntities = pgTable(
  "stage_entities",
  {
    stageId: uuid("stage_id").notNull().references(() => learningStages.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
  },
  (table) => [primaryKey({ columns: [table.stageId, table.entityId, table.role] })],
);

export const ingestionRuns = pgTable("ingestion_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentName: text("agent_name").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: text("status").notNull().default("running"),
  stats: jsonb("stats"),
});

export const ingestionCandidates = pgTable(
  "ingestion_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => ingestionRuns.id, { onDelete: "set null" }),
    proposedEntityType: text("proposed_entity_type").notNull().references(() => entityTypes.id),
    proposedName: text("proposed_name").notNull(),
    proposedSlug: text("proposed_slug"),
    proposedPayload: jsonb("proposed_payload").notNull().default({}),
    matchEntityId: uuid("match_entity_id").references(() => entities.id),
    matchMethod: text("match_method"),
    matchConfidence: numeric("match_confidence"),
    status: text("status").notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ingestion_candidates_status_idx").on(table.status)],
);

export const entityEmbeddings = pgTable(
  "entity_embeddings",
  {
    entityId: uuid("entity_id").notNull().references(() => entities.id, { onDelete: "cascade" }),
    embeddingModel: text("embedding_model").notNull(),
    embedding: text("embedding").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.entityId, table.embeddingModel] })],
);
