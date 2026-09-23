INSERT INTO relation_types (id, inverse_id, description) VALUES
  ('available_on', NULL, 'Source can be run or downloaded from target'),
  ('hosts', 'available_on', 'Source hosts or serves target')
ON CONFLICT (id) DO NOTHING;

UPDATE relation_types SET inverse_id = 'hosts' WHERE id = 'available_on';
