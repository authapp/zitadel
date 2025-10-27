-- Migration: 002_60 - Fix project_grants PRIMARY KEY constraint after schema migration
-- Description: Ensure PRIMARY KEY constraint exists after table was moved to projections schema
-- Date: 2025-10-27

DO $$
BEGIN
  -- Check if table exists
  IF EXISTS (SELECT FROM information_schema.tables 
             WHERE table_schema = 'projections' AND table_name = 'project_grants') THEN
    
    -- Drop old constraint if exists (from old table name)
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_grants_projection_pkey') THEN
      ALTER TABLE projections.project_grants DROP CONSTRAINT project_grants_projection_pkey;
    END IF;
    
    -- Add PRIMARY KEY constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_grants_pkey') THEN
      ALTER TABLE projections.project_grants ADD CONSTRAINT project_grants_pkey PRIMARY KEY (id, instance_id);
    END IF;
    
  END IF;
END $$;
