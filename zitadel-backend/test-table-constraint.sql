-- Check if project_grants table and constraints exist
SELECT 
  tc.table_schema,
  tc.table_name, 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name LIKE '%project_grant%'
ORDER BY tc.table_name, kcu.ordinal_position;
