-- Create unique_constraints table for enforcing business-level uniqueness
-- Matching Go implementation: internal/repository/eventsourcing/eventstore_v2.go

CREATE TABLE IF NOT EXISTS unique_constraints (
  unique_type TEXT NOT NULL,
  unique_field TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  CONSTRAINT unique_constraints_pkey PRIMARY KEY (unique_type, unique_field, instance_id)
);

-- Index for efficient lookup by instance
CREATE INDEX IF NOT EXISTS unique_constraints_instance_idx 
  ON unique_constraints(instance_id);

-- Index for efficient lookup by type
CREATE INDEX IF NOT EXISTS unique_constraints_type_idx 
  ON unique_constraints(unique_type, instance_id);

COMMENT ON TABLE unique_constraints IS 'Stores unique constraints for business rules enforcement at event level';
COMMENT ON COLUMN unique_constraints.unique_type IS 'Type/table name for the constraint (e.g., user_username, org_domain)';
COMMENT ON COLUMN unique_constraints.unique_field IS 'Unique value/key being constrained';
COMMENT ON COLUMN unique_constraints.instance_id IS 'Instance ID for multi-tenant isolation';
