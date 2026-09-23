CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE entity_embeddings (
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  embedding_model text NOT NULL,
  embedding vector(1536) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_id, embedding_model)
);

CREATE INDEX entity_embeddings_hnsw_idx
  ON entity_embeddings
  USING hnsw (embedding vector_cosine_ops);
