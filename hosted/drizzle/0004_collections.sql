INSERT INTO entity_types (id, description) VALUES
  ('collection', 'Browsable collection of 3D models, atlases or imaging volumes')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE collections (
  entity_id uuid PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  scale text NOT NULL
    CHECK (scale IN (
      'Molecules',
      'Cells',
      'Brains',
      'Human body',
      'Development',
      'Specimens',
      'Shared viewers',
      'Imaging volumes'
    )),
  access text NOT NULL
    CHECK (access IN (
      'Open',
      'Open, non-commercial',
      'Free to browse',
      'Paid',
      'Mixed'
    )),
  media_kind text NOT NULL
    CHECK (media_kind IN ('coordinates', 'mesh', 'volume', 'mixed')),
  website text NOT NULL,
  is_hub boolean NOT NULL DEFAULT false
);
