ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_scale_check;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS best_for text,
  ADD COLUMN IF NOT EXISTS scales text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS resource_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS modalities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS data_types text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capabilities text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS species text[] NOT NULL DEFAULT '{}';

UPDATE collections SET scale = CASE scale
  WHEN 'Brains' THEN 'Organs'
  WHEN 'Human body' THEN 'Organisms'
  WHEN 'Development' THEN 'Organisms'
  WHEN 'Specimens' THEN 'Organisms'
  WHEN 'Shared viewers' THEN 'Organisms'
  WHEN 'Imaging volumes' THEN 'Organs'
  ELSE scale
END
WHERE scale NOT IN (
  'Molecules', 'Organelles', 'Cells', 'Tissues', 'Organs', 'Organisms', 'Populations'
);

UPDATE collections SET scales = ARRAY[scale] WHERE scales = '{}' OR scales IS NULL;

ALTER TABLE collections ADD CONSTRAINT collections_scale_check
  CHECK (scale IN (
    'Molecules',
    'Organelles',
    'Cells',
    'Tissues',
    'Organs',
    'Organisms',
    'Populations'
  ));

INSERT INTO relation_types (id, inverse_id, description) VALUES
  ('relevant_model', NULL, 'Resource is commonly explored alongside this AI model')
ON CONFLICT (id) DO NOTHING;
