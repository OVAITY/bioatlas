CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE entity_types (
  id text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL REFERENCES entity_types(id),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  summary text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'unlisted', 'internal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  created_by text,
  updated_by text,
  reviewed_by text,
  reviewed_at timestamptz,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) STORED
);

CREATE INDEX entities_type_status_idx ON entities (entity_type, status);
CREATE INDEX entities_search_idx ON entities USING gin (search_vector);
CREATE UNIQUE INDEX entities_type_name_idx ON entities (entity_type, lower(name));

CREATE TABLE entity_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias text NOT NULL,
  alias_kind text NOT NULL
    CHECK (alias_kind IN ('synonym', 'acronym', 'former_name', 'abbreviation')),
  is_primary boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX entity_aliases_unique_idx ON entity_aliases (entity_id, lower(alias));
CREATE INDEX entity_aliases_alias_idx ON entity_aliases (lower(alias));

CREATE TABLE entity_external_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  scheme text NOT NULL,
  value text NOT NULL,
  UNIQUE (scheme, value)
);

CREATE TABLE concepts (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  concept_kind text NOT NULL DEFAULT 'terminology'
    CHECK (concept_kind IN ('terminology', 'biological_entity', 'technology', 'discipline', 'workflow')),
  level text CHECK (level IN ('Foundation', 'Core', 'Advanced')),
  priority text CHECK (priority IN ('Essential', 'Core', 'Optional')),
  definition text,
  why_it_matters text,
  example text,
  common_confusion text
);

CREATE TABLE methods (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  purpose text,
  typical_inputs text,
  typical_outputs text,
  simplified_workflow text,
  strengths text,
  limitations text,
  key_qc_checks text,
  level text CHECK (level IN ('Foundation', 'Core', 'Advanced')),
  priority text CHECK (priority IN ('Essential', 'Core', 'Optional'))
);

CREATE TABLE models (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  release_date date,
  model_category text,
  architecture text,
  openness text CHECK (openness IN ('open', 'closed', 'dual')),
  license text,
  input_modalities text[],
  output_modalities text[],
  github_url text,
  model_url text,
  api_url text,
  card jsonb
);

CREATE TABLE organizations (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  org_kind text CHECK (org_kind IN ('company', 'academic', 'nonprofit', 'consortium', 'lab', 'government')),
  founded_on date,
  hq_country text,
  website text
);

CREATE TABLE people (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  orcid text
);

CREATE TABLE publications (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  publication_type text CHECK (publication_type IN ('journal', 'preprint', 'book', 'report', 'other')),
  published_on date,
  venue text,
  doi text,
  abstract text
);

CREATE TABLE datasets (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  license text,
  access_url text,
  version text
);

CREATE TABLE tools (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  tool_kind text CHECK (tool_kind IN ('software', 'instrument', 'platform', 'database')),
  license text,
  website text,
  repo_url text
);

CREATE TABLE biological_domains (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES entities(id)
);

CREATE TABLE use_cases (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  description text
);

CREATE TABLE events (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('funding', 'acquisition', 'partnership', 'launch', 'paper', 'model_release', 'other')),
  occurred_on date,
  body text,
  payload jsonb
);

CREATE TABLE sources (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  source_kind text NOT NULL
    CHECK (source_kind IN ('url', 'publication', 'dataset', 'agent_run', 'other')),
  url text,
  title text,
  accessed_at timestamptz,
  reliability text CHECK (reliability IN ('primary', 'secondary', 'unknown'))
);

CREATE UNIQUE INDEX sources_url_idx ON sources (url) WHERE url IS NOT NULL;

CREATE TABLE model_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name text NOT NULL,
  metric text,
  score text,
  dataset_id uuid REFERENCES entities(id),
  source_id uuid REFERENCES entities(id),
  evaluated_on date
);

CREATE TABLE relation_types (
  id text PRIMARY KEY,
  inverse_id text REFERENCES relation_types(id),
  description text NOT NULL
);

CREATE TABLE entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type text NOT NULL REFERENCES relation_types(id),
  confidence numeric CHECK (confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'in_review', 'published', 'archived')),
  notes text,
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_entity_id, to_entity_id, relation_type)
);

CREATE INDEX entity_relations_from_idx ON entity_relations (from_entity_id);
CREATE INDEX entity_relations_to_idx ON entity_relations (to_entity_id);

CREATE TABLE entity_sources (
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary'
    CHECK (role IN ('primary', 'supporting')),
  PRIMARY KEY (entity_id, source_id, role)
);

CREATE TABLE relation_sources (
  relation_id uuid NOT NULL REFERENCES entity_relations(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  PRIMARY KEY (relation_id, source_id)
);

CREATE TABLE entity_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  revision_n integer NOT NULL,
  snapshot jsonb NOT NULL,
  changed_by text,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, revision_n)
);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('video', 'image', 'article')),
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  channel text,
  source_id uuid REFERENCES entities(id)
);

CREATE TABLE entity_media (
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'explains',
  PRIMARY KEY (entity_id, media_id)
);

CREATE TABLE learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text
);

CREATE TABLE learning_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  stage_n integer NOT NULL,
  theme text NOT NULL,
  goal text,
  core_concepts_text text,
  methods_text text,
  practical_exercise text,
  suggested_hours integer,
  UNIQUE (path_id, stage_n)
);

CREATE TABLE stage_entities (
  stage_id uuid NOT NULL REFERENCES learning_stages(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('core_concept', 'method_to_recognize')),
  PRIMARY KEY (stage_id, entity_id, role)
);

CREATE TABLE ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  stats jsonb
);

CREATE TABLE ingestion_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES ingestion_runs(id) ON DELETE SET NULL,
  proposed_entity_type text NOT NULL REFERENCES entity_types(id),
  proposed_name text NOT NULL,
  proposed_slug text,
  proposed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_entity_id uuid REFERENCES entities(id),
  match_method text,
  match_confidence numeric CHECK (match_confidence BETWEEN 0 AND 1),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'merged')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ingestion_candidates_status_idx ON ingestion_candidates (status);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entities_set_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO entity_types (id, description) VALUES
  ('concept', 'Life-science concept, term, technology, discipline or workflow'),
  ('method', 'Laboratory or computational method'),
  ('model', 'AI or foundation model'),
  ('organization', 'Company, lab, university, consortium or other organization'),
  ('person', 'Individual researcher or contributor'),
  ('publication', 'Paper, preprint or other scientific work'),
  ('dataset', 'Training, benchmark or reference dataset'),
  ('tool', 'Software, instrument, platform or database'),
  ('biological_domain', 'Scientific domain or discipline grouping'),
  ('use_case', 'Application or problem a method or model addresses'),
  ('event', 'Intelligence item: launch, funding, partnership, paper or other development'),
  ('source', 'Citable provenance origin');

INSERT INTO relation_types (id, inverse_id, description) VALUES
  ('related_to', 'related_to', 'General relatedness'),
  ('part_of', NULL, 'Source is part of target'),
  ('has_part', 'part_of', 'Source contains target'),
  ('enables', NULL, 'Source enables target'),
  ('enabled_by', 'enables', 'Source is enabled by target'),
  ('uses', NULL, 'Source uses target'),
  ('used_by', 'uses', 'Source is used by target'),
  ('developed_by', NULL, 'Source was developed by target'),
  ('develops', 'developed_by', 'Source develops target'),
  ('described_in', NULL, 'Source is described in target'),
  ('describes', 'described_in', 'Source describes target'),
  ('trained_on', NULL, 'Source was trained on target'),
  ('trains', 'trained_on', 'Source is a training set for target'),
  ('addresses', NULL, 'Source addresses target domain or problem'),
  ('addressed_by', 'addresses', 'Source is addressed by target'),
  ('in_domain', NULL, 'Source belongs to a biological domain'),
  ('has_domain_member', 'in_domain', 'Domain contains source'),
  ('involves', NULL, 'Event or work involves target'),
  ('involved_in', 'involves', 'Source is involved in target'),
  ('authored_by', NULL, 'Source was authored by target'),
  ('authored', 'authored_by', 'Source authored target'),
  ('successor_of', NULL, 'Source succeeds target'),
  ('preceded_by', 'successor_of', 'Source precedes target');

UPDATE relation_types SET inverse_id = 'has_part' WHERE id = 'part_of';
UPDATE relation_types SET inverse_id = 'used_by' WHERE id = 'uses';
UPDATE relation_types SET inverse_id = 'develops' WHERE id = 'developed_by';
UPDATE relation_types SET inverse_id = 'describes' WHERE id = 'described_in';
UPDATE relation_types SET inverse_id = 'trains' WHERE id = 'trained_on';
UPDATE relation_types SET inverse_id = 'addressed_by' WHERE id = 'addresses';
UPDATE relation_types SET inverse_id = 'involved_in' WHERE id = 'involves';
UPDATE relation_types SET inverse_id = 'authored' WHERE id = 'authored_by';
UPDATE relation_types SET inverse_id = 'preceded_by' WHERE id = 'successor_of';
UPDATE relation_types SET inverse_id = 'has_domain_member' WHERE id = 'in_domain';
